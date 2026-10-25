import sys
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import HTTPException
from google.genai.errors import APIError
from services import gemini_evaluator
import main


def api_error(code, status, message, details=None, retry_after=None):
    response_json = {
        "error": {
            "code": code,
            "status": status,
            "message": message,
            "details": details or [],
        }
    }
    response = SimpleNamespace(headers={"Retry-After": retry_after} if retry_after else {})
    return APIError(code, response_json, response=response)


class FakeModels:
    def __init__(self, results):
        self.results = iter(results)
        self.calls = 0

    def generate_content(self, **_kwargs):
        self.calls += 1
        result = next(self.results)
        if isinstance(result, Exception):
            raise result
        return result


class GeminiErrorHandlingTests(unittest.TestCase):
    def test_429_reasons_are_classified_without_retrying_exhausted_quota(self):
        quota = api_error(429, "RESOURCE_EXHAUSTED", "Quota exceeded for this project")
        model_limit = api_error(
            429,
            "RESOURCE_EXHAUSTED",
            "Request limit exceeded",
            details=[
                {
                    "quotaMetric": "GenerateRequestsPerMinutePerModel",
                    "quotaDimensions": {"model": "gemini-3.5-flash"},
                }
            ],
        )
        billing = api_error(403, "PERMISSION_DENIED", "Billing is disabled")

        self.assertEqual(gemini_evaluator._classify_gemini_error(quota).category, "quota_exhausted")
        self.assertEqual(gemini_evaluator._classify_gemini_error(model_limit).category, "model_limit")
        self.assertEqual(gemini_evaluator._classify_gemini_error(billing).category, "billing_restricted")

        models = FakeModels([quota, object()])
        with patch.object(gemini_evaluator.time, "sleep") as sleep:
            with self.assertRaises(gemini_evaluator.GeminiEvaluationError) as caught:
                gemini_evaluator._generate_content_with_retry(
                    SimpleNamespace(models=models), "gemini-test", "prompt", None
                )

        self.assertEqual(caught.exception.http_status, 429)
        self.assertIn("quota appears exhausted", str(caught.exception))
        self.assertEqual(models.calls, 1)
        sleep.assert_not_called()

        for blocked_error in (model_limit, billing):
            blocked_models = FakeModels([blocked_error, object()])
            with self.subTest(category=gemini_evaluator._classify_gemini_error(blocked_error).category):
                with self.assertRaises(gemini_evaluator.GeminiEvaluationError):
                    gemini_evaluator._generate_content_with_retry(
                        SimpleNamespace(models=blocked_models), "gemini-test", "prompt", None
                    )
                self.assertEqual(blocked_models.calls, 1)

    def test_rate_limit_retries_once_when_retry_after_is_short_and_safe(self):
        throttled = api_error(
            429,
            "RESOURCE_EXHAUSTED",
            "Requests per minute limit exceeded",
            details=[{"reason": "RATE_LIMIT_EXCEEDED"}],
            retry_after="1",
        )
        result = object()
        models = FakeModels([throttled, result])

        with self.assertLogs("codeassess.gemini", level="WARNING") as captured, patch.object(
            gemini_evaluator.time, "sleep"
        ) as sleep:
            actual = gemini_evaluator._generate_content_with_retry(
                SimpleNamespace(models=models), "gemini-test", "prompt", None
            )

        self.assertIs(actual, result)
        self.assertEqual(models.calls, 2)
        sleep.assert_called_once_with(1.0)
        self.assertIn("reason=RATE_LIMIT_EXCEEDED", captured.output[0])
        self.assertIn("retry_after_seconds=1.0", captured.output[0])

    def test_error_sanitization_masks_credentials_and_retry_after_date_is_parsed(self):
        sanitized = gemini_evaluator._sanitized_error_text(
            "authorization: Bearer secret-token API_KEY=AIza" + "A" * 35
        )
        self.assertNotIn("secret-token", sanitized)
        self.assertNotIn("AIza", sanitized)
        self.assertGreaterEqual(
            gemini_evaluator._parse_retry_after("Wed, 21 Oct 2037 07:28:00 GMT") or 0,
            1,
        )

    def test_transient_service_retries_are_bounded_and_unknown_429_is_not_retried(self):
        unavailable = api_error(503, "UNAVAILABLE", "Service temporarily unavailable")
        persistent_models = FakeModels([unavailable, unavailable, unavailable])

        with patch.object(gemini_evaluator.time, "sleep") as sleep:
            with self.assertRaises(gemini_evaluator.GeminiEvaluationError):
                gemini_evaluator._generate_content_with_retry(
                    SimpleNamespace(models=persistent_models), "gemini-test", "prompt", None
                )

        self.assertEqual(persistent_models.calls, 2)
        sleep.assert_called_once_with(0.5)

        ambiguous = api_error(429, "RESOURCE_EXHAUSTED", "Request rejected")
        ambiguous_models = FakeModels([ambiguous, object()])
        with self.assertRaises(gemini_evaluator.GeminiEvaluationError) as caught:
            gemini_evaluator._generate_content_with_retry(
                SimpleNamespace(models=ambiguous_models), "gemini-test", "prompt", None
            )

        self.assertEqual(caught.exception.http_status, 429)
        self.assertIn("did not identify the limit", str(caught.exception))
        self.assertEqual(ambiguous_models.calls, 1)

    def test_feedback_failure_keeps_java_evidence_and_does_not_rerun_submission(self):
        request = main.FeedbackRequest(
            submissionId="submission-test",
            question={"title": "Example"},
            code="public class Main {}",
            execution={"status": "success", "stdout": "5"},
            testCases=[
                {
                    "input": "1",
                    "expectedOutput": "5",
                    "actualOutput": "4",
                    "passed": False,
                }
            ],
        )
        failure = gemini_evaluator.GeminiEvaluationError(
            "Gemini quota appears exhausted. Your Java results are preserved.",
            http_status=429,
            retry_after_seconds=3,
        )

        with patch.object(main, "evaluate_with_gemini", side_effect=failure) as evaluate, patch.object(
            main, "submit_code", side_effect=AssertionError("Java submission must not rerun")
        ) as submit:
            with self.assertRaises(HTTPException) as caught:
                main.evaluate_code(request)

        self.assertEqual(caught.exception.status_code, 429)
        self.assertEqual(caught.exception.headers["Retry-After"], "3")
        self.assertEqual(request.testCases[0].actualOutput, "4")
        self.assertEqual(request.testCases[0].expectedOutput, "5")
        evaluate.assert_called_once_with(request)
        submit.assert_not_called()

    def test_concurrent_feedback_for_one_submission_is_rejected(self):
        request = main.FeedbackRequest(
            submissionId="submission-concurrent",
            question={"title": "Example"},
            code="public class Main {}",
            execution={"status": "success"},
        )
        entered = threading.Event()
        release = threading.Event()
        result = SimpleNamespace()

        def block_feedback(_request):
            entered.set()
            release.wait(timeout=2)
            return result

        with patch.object(main, "evaluate_with_gemini", side_effect=block_feedback) as evaluate:
            worker = threading.Thread(target=main.evaluate_code, args=(request,))
            worker.start()
            self.assertTrue(entered.wait(timeout=2))
            with self.assertRaises(HTTPException) as caught:
                main.evaluate_code(request)
            release.set()
            worker.join(timeout=2)

        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(evaluate.call_count, 1)


if __name__ == "__main__":
    unittest.main()
