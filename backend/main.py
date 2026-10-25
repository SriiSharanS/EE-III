from __future__ import annotations

import logging
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from typing import Literal, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from services.gemini_evaluator import (
    EvaluationResponse,
    ExecutionPayload,
    FeedbackRequest,
    GeminiEvaluationError,
    QuestionPayload,
    TestCaseResult,
    evaluate_with_gemini,
)
from services.question_bank import QuestionBankError, load_question_bank
from services.question_bank import (
    PublicProblem,
    to_public_problem,
)

# ============================================================================
# CodeAssess AI - Local Java Execution Engine (Prototype)
#
# SECURITY NOTICE:
# This subprocess execution runner is strictly intended for local development
# and prototype testing. In production environments, untrusted student code
# MUST be executed inside an isolated sandbox/container (e.g. gVisor, Docker,
# nsjail) with strict CPU, memory, filesystem, process, and network quotas.
# ============================================================================

app = FastAPI(title="CodeAssess Java Execution Backend")

logger = logging.getLogger("codeassess")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    logger.addHandler(handler)
logger.propagate = False
_feedback_in_flight: set[str] = set()
_feedback_in_flight_lock = threading.Lock()
COMPILE_TIMEOUT_SECONDS = min(60, max(1, int(os.environ.get("JAVA_COMPILE_TIMEOUT_SECONDS", "10"))))
RUN_TIMEOUT_SECONDS = min(30, max(1, int(os.environ.get("JAVA_RUN_TIMEOUT_SECONDS", "5"))))
MAX_SOURCE_CHARACTERS = 100_000
MAX_INPUT_CHARACTERS = 100_000
MAX_OUTPUT_CHARACTERS = 200_000

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    code: str
    input: str = ""


class RunResponse(BaseModel):
    success: bool
    stage: Literal["compile", "runtime", "completed"]
    output: str
    error: str


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    java_available: bool
    java_version: str


class SubmissionResponse(BaseModel):
    submissionId: str
    verdict: Literal["accepted", "wrong_answer", "compile_error", "runtime_error", "timeout"]
    execution: ExecutionPayload
    testCases: list[TestCaseResult]
    testCasesPassed: int
    testCasesTotal: int


def find_java_executable(command: str) -> Optional[str]:
    executable = shutil.which(command)
    if executable:
        return executable

    java_home = os.environ.get("JAVA_HOME")
    if not java_home:
        return None

    executable_name = f"{command}.exe" if os.name == "nt" else command
    candidate = Path(java_home) / "bin" / executable_name
    return str(candidate) if candidate.is_file() else None


def detect_main_class(code: str) -> str:
    # 1. Search for public class <Name>
    public_match = re.search(r"public\s+class\s+([A-Za-z0-9_$]+)", code)
    if public_match:
        return public_match.group(1)
    # 2. Search for class with public static void main
    match = re.search(r"class\s+([A-Za-z0-9_$]+)[^{]*\{[^}]*public\s+static\s+void\s+main", code, re.DOTALL)
    if match:
        return match.group(1)
    # 3. Search for any class definition
    any_class = re.search(r"class\s+([A-Za-z0-9_$]+)", code)
    if any_class:
        return any_class.group(1)
    return "Main"


def read_java_version(javac_executable: Optional[str]) -> str:
    if not javac_executable:
        return "Unavailable"

    try:
        result = subprocess.run(
            [javac_executable, "-version"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=3,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return "Unavailable"

    version_output = (result.stdout or result.stderr).strip()
    match = re.search(r"(?:javac\s+)?([\d][\w.+-]*)", version_output)
    return f"JDK {match.group(1)}" if match else "Java"


def limit_output(value: str) -> str:
    if len(value) <= MAX_OUTPUT_CHARACTERS:
        return value
    return f"{value[:MAX_OUTPUT_CHARACTERS]}\n\n[Output truncated by CodeAssess]"


def terminate_process_tree(process: subprocess.Popen[str]) -> None:
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(process.pid)],
            capture_output=True,
            check=False,
        )
        return

    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def run_process(
    command: list[str],
    working_directory: Path,
    input_text: str = "",
    timeout: int = 5,
) -> subprocess.CompletedProcess[str]:
    creation_flags = 0
    if os.name == "nt":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW

    process = subprocess.Popen(
        command,
        cwd=str(working_directory),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=creation_flags,
        start_new_session=os.name != "nt",
    )

    try:
        stdout, stderr = process.communicate(input=input_text, timeout=timeout)
    except subprocess.TimeoutExpired:
        terminate_process_tree(process)
        try:
            stdout, stderr = process.communicate(timeout=1)
        except Exception:
            stdout, stderr = "", ""
        raise subprocess.TimeoutExpired(command, timeout, output=stdout, stderr=stderr)

    return subprocess.CompletedProcess(command, process.returncode, stdout or "", stderr or "")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "CodeAssess Java execution backend is running", "status": "ok"}


@app.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    javac_executable = find_java_executable("javac")
    java_executable = find_java_executable("java")
    java_available = bool(javac_executable and java_executable)
    return HealthResponse(
        status="ok" if java_available else "degraded",
        java_available=java_available,
        java_version=read_java_version(javac_executable),
    )


@app.get("/api/problems", response_model=list[PublicProblem])
def list_problems() -> list[PublicProblem]:
    try:
        bank = load_question_bank()
    except QuestionBankError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(error),
        ) from error
    return [to_public_problem(problem) for problem in bank.questions]


@app.get("/api/problems/{problem_id}", response_model=PublicProblem)
def get_problem(problem_id: int) -> PublicProblem:
    try:
        bank = load_question_bank()
    except QuestionBankError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(error),
        ) from error

    problem = next((item for item in bank.questions if item.id == problem_id), None)
    if problem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem with ID {problem_id} was not found.",
        )
    return to_public_problem(problem)


@app.post("/api/run", response_model=RunResponse)
def run_java(request: RunRequest) -> RunResponse:
    print("[CodeAssess] Execution request received", flush=True)
    print(f"[CodeAssess] Source length: {len(request.code)} characters", flush=True)

    if not request.code or not request.code.strip():
        print("[CodeAssess] Empty code rejected", flush=True)
        return RunResponse(
            success=False,
            stage="compile",
            output="",
            error="Editor is empty.",
        )

    if len(request.code) > MAX_SOURCE_CHARACTERS:
        return RunResponse(
            success=False,
            stage="compile",
            output="",
            error=f"Source code exceeds the {MAX_SOURCE_CHARACTERS:,}-character limit.",
        )

    if len(request.input) > MAX_INPUT_CHARACTERS:
        return RunResponse(
            success=False,
            stage="runtime",
            output="",
            error=f"Standard input exceeds the {MAX_INPUT_CHARACTERS:,}-character limit.",
        )

    javac_executable = find_java_executable("javac")
    java_executable = find_java_executable("java")
    if not javac_executable:
        return RunResponse(
            success=False,
            stage="compile",
            output="",
            error="Java compiler (javac) was not found. Install JDK 17+ and set JAVA_HOME or PATH.",
        )
    if not java_executable:
        return RunResponse(
            success=False,
            stage="runtime",
            output="",
            error="Java runtime was not found. Install JDK 17+ and set JAVA_HOME or PATH.",
        )

    main_class = detect_main_class(request.code)

    try:
        with tempfile.TemporaryDirectory(prefix="codeassess-") as temporary_directory:
            working_directory = Path(temporary_directory)
            source_file = working_directory / f"{main_class}.java"
            class_directory = working_directory / "classes"
            class_directory.mkdir()
            source_file.write_text(request.code, encoding="utf-8")

            # ----------------------------------------------------------------
            # Compilation Stage
            # ----------------------------------------------------------------
            print(f"[CodeAssess] Compiling {source_file.name}", flush=True)
            try:
                compile_result = run_process(
                    [
                        javac_executable,
                        "-encoding",
                        "UTF-8",
                        "-d",
                        str(class_directory),
                        source_file.name,
                    ],
                    working_directory,
                    timeout=COMPILE_TIMEOUT_SECONDS,
                )
            except FileNotFoundError:
                print("[CodeAssess] javac not found on system PATH", flush=True)
                return RunResponse(
                    success=False,
                    stage="compile",
                    output="",
                    error="Java compiler (javac) not found. Please install a JDK and configure PATH.",
                )
            except subprocess.TimeoutExpired:
                print("[CodeAssess] Compilation timed out", flush=True)
                return RunResponse(
                    success=False,
                    stage="compile",
                    output="",
                    error=f"Compilation timed out (limit: {COMPILE_TIMEOUT_SECONDS}s).",
                )

            print(f"[CodeAssess] javac exit code: {compile_result.returncode}", flush=True)

            if compile_result.returncode != 0:
                print("[CodeAssess] Compilation failed", flush=True)
                compile_err = compile_result.stderr if compile_result.stderr.strip() else compile_result.stdout
                return RunResponse(
                    success=False,
                    stage="compile",
                    output="",
                    error=limit_output(compile_err if compile_err else "Compilation failed."),
                )

            print("[CodeAssess] Compilation successful", flush=True)

            # ----------------------------------------------------------------
            # Execution Stage
            # ----------------------------------------------------------------
            print(f"[CodeAssess] Executing {main_class}", flush=True)
            try:
                execution_result = run_process(
                    [
                        java_executable,
                        "-Xmx128m",
                        "-Dfile.encoding=UTF-8",
                        "-cp",
                        str(class_directory),
                        main_class,
                    ],
                    working_directory,
                    input_text=request.input,
                    timeout=RUN_TIMEOUT_SECONDS,
                )
            except FileNotFoundError:
                print("[CodeAssess] java runtime not found on system PATH", flush=True)
                return RunResponse(
                    success=False,
                    stage="runtime",
                    output="",
                    error="Java runtime (java) not found. Please install a JDK and configure PATH.",
                )
            except subprocess.TimeoutExpired:
                print("[CodeAssess] Execution timed out (Time Limit Exceeded)", flush=True)
                return RunResponse(
                    success=False,
                    stage="runtime",
                    output="",
                    error="Time Limit Exceeded.",
                )

            print(f"[CodeAssess] Java exit code: {execution_result.returncode}", flush=True)

            if execution_result.returncode != 0:
                runtime_err = execution_result.stderr if execution_result.stderr.strip() else execution_result.stdout
                if not runtime_err.strip():
                    runtime_err = f"Process exited with code {execution_result.returncode}."
                return RunResponse(
                    success=False,
                    stage="runtime",
                    output=limit_output(execution_result.stdout or ""),
                    error=limit_output(runtime_err),
                )

            return RunResponse(
                success=True,
                stage="completed",
                output=limit_output(execution_result.stdout or ""),
                error=limit_output(execution_result.stderr or ""),
            )

    except Exception as error:
        print(f"[CodeAssess] Unexpected backend error: {error}", flush=True)
        return RunResponse(
            success=False,
            stage="runtime",
            output="",
            error=f"Unexpected backend error: {error}",
        )


@app.post("/api/evaluate", response_model=EvaluationResponse)
def evaluate_code(request: FeedbackRequest) -> EvaluationResponse:
    request_started = time.perf_counter()
    response_status = status.HTTP_200_OK
    submission_id = request.submissionId.strip()
    claimed_submission = False
    logger.info(
        "feedback.start id=%s title=%r test_cases=%d",
        submission_id or "unlinked",
        request.question.title,
        len(request.testCases),
    )
    try:
        if submission_id:
            with _feedback_in_flight_lock:
                if submission_id in _feedback_in_flight:
                    response_status = status.HTTP_409_CONFLICT
                    raise HTTPException(
                        status_code=response_status,
                        detail="AI feedback for this submission is already in progress.",
                    )
                _feedback_in_flight.add(submission_id)
                claimed_submission = True
        if not request.code or not request.code.strip():
            response_status = status.HTTP_400_BAD_REQUEST
            raise HTTPException(
                status_code=response_status,
                detail="Editor is empty. Cannot evaluate code.",
            )
        return evaluate_with_gemini(request)
    except GeminiEvaluationError as error:
        response_status = error.http_status
        headers = {}
        if error.retry_after_seconds is not None:
            headers["Retry-After"] = str(max(0, int(error.retry_after_seconds)))
        raise HTTPException(
            status_code=response_status,
            detail=str(error),
            headers=headers or None,
        ) from error
    except ValueError as error:
        response_status = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=response_status, detail=str(error)) from error
    except HTTPException as error:
        response_status = error.status_code
        raise
    except Exception as error:
        response_status = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error(
            "feedback.failed id=%s error_type=%s",
            request.submissionId or "unlinked",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=response_status,
            detail="AI feedback failed. You can retry without rerunning Java tests.",
        ) from error
    finally:
        if claimed_submission:
            with _feedback_in_flight_lock:
                _feedback_in_flight.discard(submission_id)
        logger.info(
            "feedback.complete id=%s status=%d duration_ms=%.1f",
            submission_id or "unlinked",
            response_status,
            (time.perf_counter() - request_started) * 1000,
        )


class SubmitTestCase(BaseModel):
    input: str = ""
    expected: str = ""


class SubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    problemId: int
    question: QuestionPayload
    code: str


@app.post("/api/submit", response_model=SubmissionResponse)
def submit_code(request: SubmitRequest) -> SubmissionResponse:
    submission_id = uuid4().hex
    request_started = time.perf_counter()
    response_status = status.HTTP_200_OK
    logger.info(
        "submission.start id=%s problem_id=%d title=%r source_chars=%d",
        submission_id,
        request.problemId,
        request.question.title,
        len(request.code),
    )

    try:
        if not request.code or not request.code.strip():
            response_status = status.HTTP_400_BAD_REQUEST
            raise HTTPException(
                status_code=response_status,
                detail="Editor is empty. Please write your Java code before submitting.",
            )

        try:
            bank = load_question_bank()
        except QuestionBankError as error:
            response_status = status.HTTP_500_INTERNAL_SERVER_ERROR
            raise HTTPException(status_code=response_status, detail=str(error)) from error

        problem = next(
            (item for item in bank.questions if item.id == request.problemId),
            None,
        )
        if problem is None:
            response_status = status.HTTP_404_NOT_FOUND
            raise HTTPException(
                status_code=response_status,
                detail=f"Problem with ID {request.problemId} was not found.",
            )

        javac_executable = find_java_executable("javac")
        java_executable = find_java_executable("java")
        if not javac_executable or not java_executable:
            response_status = status.HTTP_503_SERVICE_UNAVAILABLE
            raise HTTPException(
                status_code=response_status,
                detail="JDK is not properly configured on the server. Please install JDK 17+ and verify PATH.",
            )

        main_class = detect_main_class(request.code)
        test_cases_to_run = [
            SubmitTestCase(input=test_case.input, expected=test_case.expected)
            for test_case in problem.testCases
        ]

        with tempfile.TemporaryDirectory(prefix="codeassess-submit-") as temporary_directory:
            working_directory = Path(temporary_directory)
            source_file = working_directory / f"{main_class}.java"
            class_directory = working_directory / "classes"
            class_directory.mkdir()
            source_file.write_text(request.code, encoding="utf-8")

            compile_started = time.perf_counter()
            try:
                compile_result = run_process(
                    [
                        javac_executable,
                        "-encoding",
                        "UTF-8",
                        "-d",
                        str(class_directory),
                        source_file.name,
                    ],
                    working_directory,
                    timeout=COMPILE_TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired:
                compile_duration_ms = (time.perf_counter() - compile_started) * 1000
                compile_error = f"Compilation timed out (limit: {COMPILE_TIMEOUT_SECONDS}s)."
                logger.warning(
                    "submission.compile.timeout id=%s duration_ms=%.1f",
                    submission_id,
                    compile_duration_ms,
                )
                execution = ExecutionPayload(status="compile_error", compileError=compile_error)
                results = [
                    TestCaseResult(
                        input=tc.input,
                        expectedOutput=tc.expected,
                        actualOutput="Compilation Timeout",
                        passed=False,
                    )
                    for tc in test_cases_to_run
                ]
                return SubmissionResponse(
                    submissionId=submission_id,
                    verdict="compile_error",
                    execution=execution,
                    testCases=results,
                    testCasesPassed=0,
                    testCasesTotal=len(results),
                )

            compile_duration_ms = (time.perf_counter() - compile_started) * 1000
            logger.info(
                "submission.compile.complete id=%s duration_ms=%.1f exit_code=%d",
                submission_id,
                compile_duration_ms,
                compile_result.returncode,
            )

            if compile_result.returncode != 0:
                compile_error = compile_result.stderr or compile_result.stdout or "Compilation failed."
                execution = ExecutionPayload(
                    status="compile_error",
                    compileError=limit_output(compile_error),
                    stderr=limit_output(compile_error),
                )
                results = [
                    TestCaseResult(
                        input=tc.input,
                        expectedOutput=tc.expected,
                        actualOutput="Compilation Error",
                        passed=False,
                    )
                    for tc in test_cases_to_run
                ]
                return SubmissionResponse(
                    submissionId=submission_id,
                    verdict="compile_error",
                    execution=execution,
                    testCases=results,
                    testCasesPassed=0,
                    testCasesTotal=len(results),
                )

            execution_results: list[TestCaseResult] = []
            overall_status: Literal["success", "compile_error", "runtime_error", "timeout"] = "success"
            main_stdout = ""
            main_stderr = ""
            tests_started = time.perf_counter()

            for idx, tc in enumerate(test_cases_to_run, start=1):
                case_started = time.perf_counter()
                case_status = "completed"
                try:
                    exec_result = run_process(
                        [
                            java_executable,
                            "-Xmx128m",
                            "-Dfile.encoding=UTF-8",
                            "-cp",
                            str(class_directory),
                            main_class,
                        ],
                        working_directory,
                        input_text=tc.input,
                        timeout=RUN_TIMEOUT_SECONDS,
                    )
                except subprocess.TimeoutExpired:
                    case_status = "timeout"
                    overall_status = "timeout"
                    execution_results.append(
                        TestCaseResult(
                            input=tc.input,
                            expectedOutput=tc.expected,
                            actualOutput="Time Limit Exceeded",
                            passed=False,
                        )
                    )
                else:
                    actual_out = (exec_result.stdout or "").strip()
                    expected_out = tc.expected.strip()

                    if exec_result.returncode != 0:
                        case_status = "runtime_error"
                        err_msg = exec_result.stderr or f"Process exited with code {exec_result.returncode}."
                        if overall_status == "success":
                            overall_status = "runtime_error"
                        if not main_stderr:
                            main_stderr = err_msg
                        execution_results.append(
                            TestCaseResult(
                                input=tc.input,
                                expectedOutput=tc.expected,
                                actualOutput=exec_result.stdout or err_msg,
                                passed=False,
                            )
                        )
                    else:
                        passed = actual_out == expected_out
                        if not main_stdout and exec_result.stdout:
                            main_stdout = exec_result.stdout
                        execution_results.append(
                            TestCaseResult(
                                input=tc.input,
                                expectedOutput=tc.expected,
                                actualOutput=exec_result.stdout,
                                passed=passed,
                            )
                        )

                logger.info(
                    "submission.test_case.complete id=%s case=%d/%d duration_ms=%.1f status=%s",
                    submission_id,
                    idx,
                    len(test_cases_to_run),
                    (time.perf_counter() - case_started) * 1000,
                    case_status,
                )

            test_duration_ms = (time.perf_counter() - tests_started) * 1000
            passed_count = sum(1 for result in execution_results if result.passed)
            logger.info(
                "submission.tests.complete id=%s duration_ms=%.1f executed=%d total=%d passed=%d",
                submission_id,
                test_duration_ms,
                len(execution_results),
                len(test_cases_to_run),
                passed_count,
            )

            execution = ExecutionPayload(
                status=overall_status,
                stdout=main_stdout,
                stderr=main_stderr,
                executionTimeMs=round(test_duration_ms),
            )
            if overall_status == "timeout":
                verdict: Literal["accepted", "wrong_answer", "compile_error", "runtime_error", "timeout"] = "timeout"
            elif overall_status == "runtime_error":
                verdict = "runtime_error"
            elif passed_count == len(execution_results):
                verdict = "accepted"
            else:
                verdict = "wrong_answer"

            return SubmissionResponse(
                submissionId=submission_id,
                verdict=verdict,
                execution=execution,
                testCases=execution_results,
                testCasesPassed=passed_count,
                testCasesTotal=len(execution_results),
            )
    except HTTPException as error:
        response_status = error.status_code
        raise
    except Exception as error:
        response_status = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error(
            "submission.failed id=%s error_type=%s",
            submission_id,
            type(error).__name__,
        )
        raise HTTPException(
            status_code=response_status,
            detail="Submission processing failed. Check the backend logs for the request ID.",
        ) from error
    finally:
        logger.info(
            "submission.complete id=%s status=%d duration_ms=%.1f",
            submission_id,
            response_status,
            (time.perf_counter() - request_started) * 1000,
        )
