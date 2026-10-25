import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import main
from services.question_bank import QuestionBankError, load_question_bank, parse_question_bank


class QuestionBankEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def test_list_endpoint_returns_the_eight_existing_public_problems(self):
        response = self.client.get("/api/problems")

        self.assertEqual(response.status_code, 200)
        problems = response.json()
        self.assertEqual(len(problems), 8)
        self.assertEqual([problem["id"] for problem in problems], list(range(1, 9)))
        self.assertEqual(problems[0]["title"], "Find Maximum Element in an Array")
        self.assertEqual(problems[7]["title"], "Fibonacci Using Recursion")

    def test_detail_endpoint_returns_one_problem_with_interface_fields(self):
        response = self.client.get("/api/problems/1")

        self.assertEqual(response.status_code, 200)
        problem = response.json()
        self.assertEqual(problem["id"], 1)
        self.assertEqual(problem["testCaseCount"], 3)
        self.assertEqual(problem["exampleInput"], "5\n10 25 7 99 32")
        self.assertEqual(problem["exampleOutput"], "99")
        self.assertEqual(set(problem), {
            "id",
            "testCaseCount",
            "number",
            "title",
            "difficulty",
            "topic",
            "marks",
            "status",
            "description",
            "input",
            "output",
            "exampleInput",
            "exampleOutput",
            "constraints",
            "testCases",
            "starterCode",
        })

    def test_unknown_id_returns_clear_not_found_error(self):
        response = self.client.get("/api/problems/999")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Problem with ID 999 was not found.")

    def test_public_responses_do_not_expose_authoritative_cases_or_starter_solutions(self):
        public_problems = self.client.get("/api/problems").json()
        bank = load_question_bank()

        self.assertTrue(bank.questions[0].testCases)
        self.assertTrue(bank.questions[0].starterCode["Java"])
        for public_problem in public_problems:
            self.assertEqual(public_problem["testCases"], [])
            self.assertEqual(
                public_problem["starterCode"],
                {"Python": "", "Java": "", "C": "", "C++": ""},
            )
            self.assertNotIn("hiddenTestCases", public_problem)
            self.assertNotIn("referenceSolution", public_problem)
            self.assertNotIn("referenceSolutions", public_problem)

    def test_submission_uses_backend_tests_identified_by_problem_id(self):
        response = self.client.post(
            "/api/submit",
            json={
                "problemId": 1,
                "question": {"title": "Find Maximum Element in an Array"},
                "code": (
                    "import java.util.*; public class Main { "
                    "public static void main(String[] args) { Scanner s = new Scanner(System.in); "
                    "int n = s.nextInt(); int max = Integer.MIN_VALUE; "
                    "for (int i = 0; i < n; i++) max = Math.max(max, s.nextInt()); "
                    "System.out.println(max); } }"
                ),
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["verdict"], "accepted")
        self.assertEqual(result["testCasesPassed"], 3)
        self.assertEqual(result["testCasesTotal"], 3)
        self.assertEqual([case["expectedOutput"] for case in result["testCases"]], ["99", "8", "-1"])

    def test_submission_rejects_client_supplied_test_cases(self):
        response = self.client.post(
            "/api/submit",
            json={
                "problemId": 1,
                "question": {"title": "Find Maximum Element in an Array"},
                "code": "public class Main {}",
                "testCases": [{"input": "1", "expected": "client value"}],
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("testCases", response.text)

    def test_bank_validation_rejects_duplicate_ids_and_invalid_records(self):
        raw_bank = load_question_bank().model_dump()
        duplicate_bank = {
            "questions": raw_bank["questions"] + [raw_bank["questions"][0]]
        }
        with self.assertRaisesRegex(QuestionBankError, "duplicate IDs: 1"):
            parse_question_bank(duplicate_bank)

        invalid_difficulty = load_question_bank().model_dump()
        invalid_difficulty["questions"][0]["difficulty"] = "Expert"
        with self.assertRaisesRegex(QuestionBankError, "difficulty"):
            parse_question_bank(invalid_difficulty)

        mismatched_example = load_question_bank().model_dump()
        mismatched_example["questions"][0]["exampleOutput"] = "not an expected output"
        with self.assertRaisesRegex(QuestionBankError, "exampleInput and exampleOutput"):
            parse_question_bank(mismatched_example)

        missing_case_field = load_question_bank().model_dump()
        del missing_case_field["questions"][0]["testCases"][0]["expected"]
        with self.assertRaisesRegex(QuestionBankError, "expected"):
            parse_question_bank(missing_case_field)

        missing_id = load_question_bank().model_dump()
        del missing_id["questions"][0]["id"]
        with self.assertRaisesRegex(QuestionBankError, "id"):
            parse_question_bank(missing_id)


if __name__ == "__main__":
    unittest.main()
