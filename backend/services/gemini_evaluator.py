from __future__ import annotations

import json
import os
from pathlib import Path
import re
from typing import Any, List, Literal, Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Load .env from workspace root and backend folder
_WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_WORKSPACE_ROOT / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class QuestionPayload(BaseModel):
    title: str = ""
    description: str = ""
    inputFormat: Optional[str] = ""
    outputFormat: Optional[str] = ""
    constraints: Optional[str] = ""


class ExecutionPayload(BaseModel):
    status: Literal["success", "compile_error", "runtime_error", "timeout"] = "success"
    stdout: Optional[str] = ""
    stderr: Optional[str] = ""
    compileError: Optional[str] = ""
    executionTimeMs: Optional[int] = 0


class TestCaseResult(BaseModel):
    input: str = ""
    expectedOutput: str = ""
    actualOutput: Optional[str] = ""
    passed: bool = False


class EvaluateRequest(BaseModel):
    question: QuestionPayload
    code: str
    execution: ExecutionPayload
    testCases: List[TestCaseResult] = Field(default_factory=list)


class EvaluationResponse(BaseModel):
    totalScore: int
    syntaxScore: int
    logicScore: int
    testCaseScore: int
    timeComplexityScore: int
    spaceComplexityScore: int
    codeQualityScore: int
    correctness: str
    timeComplexity: str
    spaceComplexity: str
    testCasesPassed: int
    testCasesTotal: int
    strengths: List[str]
    issues: List[str]
    suggestions: List[str]
    summary: str


SYSTEM_INSTRUCTION = """You are an AI programming assessment evaluator.
Evaluate a student's Java solution against the provided programming problem.
You are not the compiler and you must not invent execution results.
The supplied compiler output, runtime output and test case results are authoritative.

Evaluate:
- syntax correctness (max 10 marks)
- logical correctness (max 30 marks)
- test case results (max 30 marks)
- time complexity (max 10 marks)
- space complexity (max 10 marks)
- code quality (max 10 marks)

Total score is the exact sum of the above category scores (max 100):
totalScore = syntaxScore + logicScore + testCaseScore + timeComplexityScore + spaceComplexityScore + codeQualityScore

Give fair educational feedback.
Use the supplied evidence.
Do not assume that code is correct merely because it looks plausible.
Do not claim a test passed unless the supplied test result says it passed.
If compilation failed, explain the actual compiler error.
If runtime failed, explain the supplied runtime error.
If test cases failed, explain the likely logical cause.

Scoring bounds:
- syntaxScore: 0 to 10
- logicScore: 0 to 30
- testCaseScore: 0 to 30 (must align with passed/total test cases)
- timeComplexityScore: 0 to 10
- spaceComplexityScore: 0 to 10
- codeQualityScore: 0 to 10
- totalScore: 0 to 100

Return ONLY the requested JSON structure.
"""


def _get_api_key() -> str:
    # Refresh env from file in case it was updated
    load_dotenv(_WORKSPACE_ROOT / ".env", override=False)
    load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

    api_key = (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("GEMINI_KEY")
    )
    if not api_key or api_key.strip() in ("", "YOUR_KEY_HERE", "YOUR_GEMINI_API_KEY_HERE"):
        raise ValueError(
            "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in the backend .env file."
        )
    return api_key.strip()


def _sanitize_json_text(text: str) -> str:
    text = text.strip()
    # Strip markdown code fences if present
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text


def evaluate_with_gemini(payload: EvaluateRequest) -> EvaluationResponse:
    api_key = _get_api_key()
    configured_model = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash").strip()
    candidate_models = [configured_model, "gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-pro"]
    # De-duplicate while preserving order
    models_to_try = list(dict.fromkeys(candidate_models))

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    total_tests = len(payload.testCases)
    passed_tests = sum(1 for tc in payload.testCases if tc.passed)

    # Format test case evidence cleanly
    formatted_test_cases = []
    for idx, tc in enumerate(payload.testCases, start=1):
        formatted_test_cases.append(
            f"Test Case #{idx}:\n"
            f"  Input: {tc.input}\n"
            f"  Expected Output: {tc.expectedOutput}\n"
            f"  Actual Output: {tc.actualOutput}\n"
            f"  Result: {'PASSED' if tc.passed else 'FAILED'}"
        )
    test_cases_summary = "\n\n".join(formatted_test_cases) if formatted_test_cases else "No test cases provided."

    prompt = f"""
EVALUATION EVIDENCE FOR JAVA ASSESSMENT:

==================== PROBLEM DETAILS ====================
Title: {payload.question.title}
Description: {payload.question.description}
Input Format: {payload.question.inputFormat or 'Standard input'}
Output Format: {payload.question.outputFormat or 'Standard output'}
Constraints: {payload.question.constraints or 'Standard constraints'}

==================== STUDENT JAVA CODE ====================
```java
{payload.code}
```

==================== AUTHORITATIVE EXECUTION RESULTS ====================
Execution Status: {payload.execution.status}
Compile Error: {payload.execution.compileError or 'None'}
Standard Output (stdout): {payload.execution.stdout or 'None'}
Standard Error (stderr): {payload.execution.stderr or 'None'}
Execution Time: {payload.execution.executionTimeMs} ms

==================== AUTHORITATIVE TEST CASES ====================
Total Test Cases: {total_tests}
Passed Test Cases: {passed_tests}
Detailed Test Results:
{test_cases_summary}

==================== INSTRUCTIONS ====================
Evaluate the student's solution thoroughly based STRICTLY on the execution evidence above.
Return a valid JSON object matching the required schema with integer scores summing to totalScore.
"""

    response = None
    last_error = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=EvaluationResponse,
                    temperature=0.2,
                ),
            )
            if response and response.text:
                break
        except Exception as e:
            last_error = e
            continue

    if not response or not response.text:
        print(f"[CodeAssess] Gemini API unavailable: {last_error}. Falling back to test evidence.", flush=True)
        return generate_fallback_evaluation(payload, f"Gemini API unavailable: {last_error}")

    raw_text = response.text or ""
    if not raw_text.strip():
        raise ValueError("Gemini API returned an empty response.")

    clean_json = _sanitize_json_text(raw_text)

    try:
        data = json.loads(clean_json)
    except Exception as e:
        raise ValueError(f"Failed to parse Gemini JSON output: {e}\nRaw output: {raw_text[:200]}") from e

    # Score clamping and validation
    syntax_score = max(0, min(10, int(data.get("syntaxScore", 0))))
    logic_score = max(0, min(30, int(data.get("logicScore", 0))))
    test_case_score = max(0, min(30, int(data.get("testCaseScore", 0))))
    time_score = max(0, min(10, int(data.get("timeComplexityScore", 0))))
    space_score = max(0, min(10, int(data.get("spaceComplexityScore", 0))))
    code_quality_score = max(0, min(10, int(data.get("codeQualityScore", 0))))

    # Total score is strict sum of category scores
    total_score = syntax_score + logic_score + test_case_score + time_score + space_score + code_quality_score

    # Reconcile test case counts with ground truth
    tc_passed = passed_tests if total_tests > 0 else int(data.get("testCasesPassed", 0))
    tc_total = total_tests if total_tests > 0 else int(data.get("testCasesTotal", 0))

    strengths = [str(s) for s in data.get("strengths", []) if s]
    issues = [str(i) for i in data.get("issues", []) if i]
    suggestions = [str(s) for s in data.get("suggestions", []) if s]
    summary = str(data.get("summary", "")).strip()

    if not summary:
        summary = f"Assessment completed with a score of {total_score}/100. Passed {tc_passed}/{tc_total} test cases."

    return EvaluationResponse(
        totalScore=total_score,
        syntaxScore=syntax_score,
        logicScore=logic_score,
        testCaseScore=test_case_score,
        timeComplexityScore=time_score,
        spaceComplexityScore=space_score,
        codeQualityScore=code_quality_score,
        correctness=str(data.get("correctness", "Completed")),
        timeComplexity=str(data.get("timeComplexity", "O(n)")),
        spaceComplexity=str(data.get("spaceComplexity", "O(1)")),
        testCasesPassed=tc_passed,
        testCasesTotal=tc_total,
        strengths=strengths,
        issues=issues,
        suggestions=suggestions,
        summary=summary,
    )


def generate_fallback_evaluation(payload: EvaluateRequest, reason: str = "") -> EvaluationResponse:
    """
    Fallback evaluation generator when Gemini API is temporarily offline/unreachable.
    Derives authoritative educational scores and feedback purely from real execution evidence.
    """
    total_tests = len(payload.testCases)
    passed_tests = sum(1 for tc in payload.testCases if tc.passed)

    is_compile_error = payload.execution.status == "compile_error"
    is_runtime_error = payload.execution.status == "runtime_error"
    is_timeout = payload.execution.status == "timeout"

    if is_compile_error:
        syntax_score = 0
        logic_score = 0
        test_case_score = 0
        time_score = 0
        space_score = 0
        code_quality_score = 0
        correctness = "Compilation Error"
        strengths = []
        issues = ["Code failed to compile: " + (payload.execution.compileError or "Syntax or type errors detected.")]
        suggestions = ["Fix syntax errors reported by the Java compiler before re-submitting.", "Ensure all classes and methods are properly closed with matching braces."]
        summary = "Submission failed during compilation. Please resolve javac compiler diagnostics."
    elif is_runtime_error or is_timeout:
        syntax_score = 10
        logic_score = 5
        test_case_score = int(30 * (passed_tests / total_tests)) if total_tests > 0 else 0
        time_score = 0 if is_timeout else 3
        space_score = 5
        code_quality_score = 5
        correctness = "Time Limit Exceeded" if is_timeout else "Runtime Exception"
        strengths = ["Code compiled cleanly into Java bytecode."]
        issues = [payload.execution.stderr or ("Execution timed out." if is_timeout else "Runtime exception occurred.")]
        suggestions = ["Check boundary conditions, infinite loops, and array indexing.", "Use defensive checks for null pointers and empty collections."]
        summary = f"Program compiled successfully but encountered a {correctness}. Passed {passed_tests}/{total_tests} test cases."
    else:
        # Program ran
        syntax_score = 10
        if total_tests > 0:
            ratio = passed_tests / total_tests
            test_case_score = round(30 * ratio)
            logic_score = round(30 * ratio)
            time_score = round(10 * ratio)
            space_score = round(10 * ratio)
            code_quality_score = round(10 * ratio)
        else:
            test_case_score = 25
            logic_score = 25
            time_score = 8
            space_score = 8
            code_quality_score = 8

        if passed_tests == total_tests and total_tests > 0:
            correctness = "Accepted"
            strengths = ["All test cases passed with expected outputs.", "Solution compiles cleanly and runs within limits."]
            issues = []
            suggestions = ["Consider optimizing algorithmic time complexity further for large inputs."]
            summary = f"Excellent! Solution successfully passed all {passed_tests}/{total_tests} test cases."
        else:
            correctness = f"Partially Accepted ({passed_tests}/{total_tests} Passed)"
            strengths = ["Code compiles cleanly and standard I/O works as intended."]
            issues = [f"Failed {total_tests - passed_tests} test case(s). Check output formatting and logical edge cases."]
            suggestions = ["Trace logic with failing inputs.", "Verify edge cases such as empty inputs, negative numbers, or boundary values."]
            summary = f"Solution passed {passed_tests} of {total_tests} test cases."

    total_score = syntax_score + logic_score + test_case_score + time_score + space_score + code_quality_score

    # Clarify that detailed AI summary is temporarily operating in test-evidence mode if reason provided
    if reason:
        summary += f" [Note: AI detailed feedback temporarily unavailable. Evaluated directly from test suite evidence.]"

    return EvaluationResponse(
        totalScore=total_score,
        syntaxScore=syntax_score,
        logicScore=logic_score,
        testCaseScore=test_case_score,
        timeComplexityScore=time_score,
        spaceComplexityScore=space_score,
        codeQualityScore=code_quality_score,
        correctness=correctness,
        timeComplexity="O(n)",
        spaceComplexity="O(1)",
        testCasesPassed=passed_tests,
        testCasesTotal=total_tests,
        strengths=strengths,
        issues=issues,
        suggestions=suggestions,
        summary=summary,
    )

