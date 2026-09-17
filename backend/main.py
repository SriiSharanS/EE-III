import os
from pathlib import Path
import subprocess
import sys
import tempfile
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
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


def run_process(
    command: list[str],
    working_directory: Path,
    input_text: str = "",
    timeout: int = 5,
) -> subprocess.CompletedProcess[str]:
    creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    process = subprocess.Popen(
        command,
        cwd=working_directory,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        creationflags=creation_flags,
    )

    try:
        stdout, stderr = process.communicate(input=input_text, timeout=timeout)
    except subprocess.TimeoutExpired:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(process.pid)],
                capture_output=True,
                check=False,
            )
        else:
            process.kill()
        stdout, stderr = process.communicate()
        raise subprocess.TimeoutExpired(command, timeout, output=stdout, stderr=stderr)

    return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)


@app.get("/")
def health_check() -> dict[str, str]:
    return {"message": "CodeAssess Java execution backend is running"}


@app.post("/api/run", response_model=RunResponse)
def run_java(request: RunRequest) -> RunResponse:
    print("[CodeAssess] Execution request received", flush=True)
    print(f"[CodeAssess] Source length: {len(request.code)} characters", flush=True)

    if not request.code.strip():
        print("[CodeAssess] Empty code rejected", flush=True)
        return RunResponse(
            success=False,
            stage="compile",
            output="",
            error="Editor is empty.",
        )

    try:
        with tempfile.TemporaryDirectory(prefix="codeassess-") as temporary_directory:
            working_directory = Path(temporary_directory)
            source_file = working_directory / "Main.java"
            source_file.write_text(request.code, encoding="utf-8")

            # ----------------------------------------------------------------
            # Compilation Stage
            # ----------------------------------------------------------------
            print("[CodeAssess] Compiling Main.java", flush=True)
            try:
                compile_result = run_process(
                    ["javac", "Main.java"],
                    working_directory,
                    timeout=5,
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
                    error="Compilation timed out (limit: 5s).",
                )

            print(f"[CodeAssess] javac exit code: {compile_result.returncode}", flush=True)

            if compile_result.returncode != 0:
                print("[CodeAssess] Compilation failed", flush=True)
                compile_err = compile_result.stderr or compile_result.stdout or "Compilation failed."
                return RunResponse(
                    success=False,
                    stage="compile",
                    output="",
                    error=compile_err.strip(),
                )

            print("[CodeAssess] Compilation successful", flush=True)

            # ----------------------------------------------------------------
            # Execution Stage
            # ----------------------------------------------------------------
            print("[CodeAssess] Executing Main", flush=True)
            try:
                execution_result = run_process(
                    ["java", "Main"],
                    working_directory,
                    input_text=request.input,
                    timeout=3,
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
                runtime_err = execution_result.stderr or execution_result.stdout or f"Process exited with code {execution_result.returncode}."
                return RunResponse(
                    success=False,
                    stage="runtime",
                    output=execution_result.stdout or "",
                    error=runtime_err.strip(),
                )

            return RunResponse(
                success=True,
                stage="completed",
                output=execution_result.stdout or "",
                error="",
            )

    except Exception as error:
        print(f"[CodeAssess] Unexpected backend error: {error}", flush=True)
        return RunResponse(
            success=False,
            stage="runtime",
            output="",
            error=f"Unexpected backend error: {error}",
        )