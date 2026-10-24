from __future__ import annotations

import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
import sys
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from services.gemini_evaluator import (
    EvaluateRequest,
    EvaluationResponse,
    ExecutionPayload,
    QuestionPayload,
    TestCaseResult,
    evaluate_with_gemini,
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

COMPILE_TIMEOUT_SECONDS = 10
RUN_TIMEOUT_SECONDS = 5
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
def evaluate_code(request: EvaluateRequest) -> EvaluationResponse:
    print(f"[CodeAssess] AI Evaluation requested for problem: '{request.question.title}'", flush=True)
    print(f"[CodeAssess] Code length: {len(request.code)} chars, test cases count: {len(request.testCases)}", flush=True)

    if not request.code or not request.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Editor is empty. Cannot evaluate empty code.",
        )

    try:
        evaluation = evaluate_with_gemini(request)
        print(
            f"[CodeAssess] Gemini evaluation succeeded. Score: {evaluation.totalScore}/100, Passed: {evaluation.testCasesPassed}/{evaluation.testCasesTotal}",
            flush=True,
        )
        return evaluation
    except ValueError as e:
        print(f"[CodeAssess] Evaluation config/validation error: {e}", flush=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"[CodeAssess] Evaluation service failure: {e}", flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gemini AI Evaluation failed: {e}",
        )


class SubmitTestCase(BaseModel):
    input: str = ""
    expected: str = ""


class SubmitRequest(BaseModel):
    question: QuestionPayload
    code: str
    testCases: list[SubmitTestCase] = []


@app.post("/api/submit", response_model=EvaluationResponse)
def submit_code(request: SubmitRequest) -> EvaluationResponse:
    """
    Unified end-to-end submission endpoint:
    1. Validates code
    2. Compiles Java code once using local JDK
    3. Runs each test case against the compiled bytecode with execution timeouts
    4. Evaluates authoritative evidence using Gemini AI
    5. Returns complete structured evaluation
    """
    print(f"[CodeAssess] Submission received for problem: '{request.question.title}'", flush=True)
    print(f"[CodeAssess] Code length: {len(request.code)} characters, test cases: {len(request.testCases)}", flush=True)

    if not request.code or not request.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Editor is empty. Please write your Java code before submitting.",
        )

    javac_executable = find_java_executable("javac")
    java_executable = find_java_executable("java")
    if not javac_executable or not java_executable:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JDK is not properly configured on the server. Please install JDK 17+ and verify PATH.",
        )

    main_class = detect_main_class(request.code)
    test_cases_to_run = request.testCases if request.testCases else [SubmitTestCase(input="", expected="")]

    try:
        with tempfile.TemporaryDirectory(prefix="codeassess-submit-") as temporary_directory:
            working_directory = Path(temporary_directory)
            source_file = working_directory / f"{main_class}.java"
            class_directory = working_directory / "classes"
            class_directory.mkdir()
            source_file.write_text(request.code, encoding="utf-8")

            # 1. Compilation
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
            except subprocess.TimeoutExpired:
                compile_err = f"Compilation timed out (limit: {COMPILE_TIMEOUT_SECONDS}s)."
                eval_payload = EvaluateRequest(
                    question=request.question,
                    code=request.code,
                    execution=ExecutionPayload(status="compile_error", compileError=compile_err),
                    testCases=[
                        TestCaseResult(input=tc.input, expectedOutput=tc.expected, actualOutput="Compilation Timeout", passed=False)
                        for tc in test_cases_to_run
                    ],
                )
                return evaluate_with_gemini(eval_payload)

            if compile_result.returncode != 0:
                print("[CodeAssess] Submission compilation failed", flush=True)
                compile_err = compile_result.stderr if compile_result.stderr.strip() else compile_result.stdout
                eval_payload = EvaluateRequest(
                    question=request.question,
                    code=request.code,
                    execution=ExecutionPayload(
                        status="compile_error",
                        compileError=limit_output(compile_err or "Compilation failed."),
                        stderr=limit_output(compile_err or ""),
                    ),
                    testCases=[
                        TestCaseResult(input=tc.input, expectedOutput=tc.expected, actualOutput="Compilation Error", passed=False)
                        for tc in test_cases_to_run
                    ],
                )
                return evaluate_with_gemini(eval_payload)

            print("[CodeAssess] Submission compilation successful. Executing test suite...", flush=True)

            # 2. Execution across test cases
            execution_results: list[TestCaseResult] = []
            overall_status: Literal["success", "compile_error", "runtime_error", "timeout"] = "success"
            main_stdout = ""
            main_stderr = ""
            start_time = time_ms = 0

            for idx, tc in enumerate(test_cases_to_run, start=1):
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
                    overall_status = "timeout"
                    execution_results.append(
                        TestCaseResult(
                            input=tc.input,
                            expectedOutput=tc.expected,
                            actualOutput="Time Limit Exceeded",
                            passed=False,
                        )
                    )
                    continue

                actual_out = (exec_result.stdout or "").strip()
                expected_out = tc.expected.strip()

                if exec_result.returncode != 0:
                    err_msg = exec_result.stderr if exec_result.stderr.strip() else f"Process exited with code {exec_result.returncode}"
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

            # 3. AI Evaluation
            eval_payload = EvaluateRequest(
                question=request.question,
                code=request.code,
                execution=ExecutionPayload(
                    status=overall_status,
                    stdout=main_stdout,
                    stderr=main_stderr,
                    executionTimeMs=time_ms,
                ),
                testCases=execution_results,
            )

            print("[CodeAssess] Calling Gemini AI evaluator with test evidence...", flush=True)
            return evaluate_with_gemini(eval_payload)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[CodeAssess] Unexpected submission failure: {e}", flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Submission processing error: {e}",
        )


