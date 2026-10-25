# CodeAssess AI

A React assessment portal backed by a local FastAPI service that compiles and runs Java 17 submissions.

## Prerequisites

- Node.js 20+
- Python 3.10+
- JDK 17+ with `java` and `javac` on `PATH` (or `JAVA_HOME` set)

## Install

```powershell
npm.cmd install
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

If another supported Python version is installed, replace `py -3.13` with that interpreter.

## Run locally

Start the API in one terminal:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Start Vite in a second terminal:

```powershell
npm.cmd run dev
```

Open the URL printed by Vite. The development server proxies `/api` to port `8000`, so the Java compiler works without a hard-coded browser URL. If the API is hosted elsewhere, copy `.env.example` to `.env` and set `VITE_API_BASE_URL`.

The login screen provides the portal's client-side session gate. Enter a valid email and a password of at least six characters. Replace this prototype session check with institutional SSO or server-side authentication before production use.

### Submission timing

`POST /api/submit` compiles once and runs each test case in its own timed Java process. It returns the real verdict and case results before AI feedback starts. The frontend then calls `POST /api/evaluate` with that execution evidence; retrying AI feedback does not rerun Java.

The runtime Gemini model is read from `GEMINI_MODEL` (currently configured as `gemini-3.5-flash`) and is recorded with each feedback request. Timeout settings in `.env` include `JAVA_COMPILE_TIMEOUT_SECONDS` (default 10), `JAVA_RUN_TIMEOUT_SECONDS` (default 5), `GEMINI_TIMEOUT_SECONDS` (default 20 per attempt), and `GEMINI_MAX_ATTEMPTS` (default 2). SDK retries are disabled so only the application performs bounded retries: transient service failures can be attempted once more, and a rate limit is retried only when the provider supplies a short `Retry-After`; exhausted quota and billing/model limits are not retried. Gemini error logs contain sanitized HTTP status, API status, reason, message, and retry-after details, never credentials or submitted source. For a 429 with no identifying provider details, check Usage, model-specific limits, and billing for the configured project/key in Google AI Studio. For the frontend request timeout to track Java execution, keep `VITE_JAVA_COMPILE_TIMEOUT_SECONDS` and `VITE_JAVA_RUN_TIMEOUT_SECONDS` paired with the corresponding backend values.

AI feedback is schema-validated and includes correctness reasoning, evidence-backed failed-test explanations, complexity reasoning, quality feedback, corrections, Java concepts, and a practice recommendation. The backend supplies expected and actual outputs directly from the test runner; Gemini only supplies each failed case's explanation.

## Checks

```powershell
npm.cmd run build
npm.cmd run lint
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v
```

Backend health is available at `GET /api/health`. Java execution is available at `POST /api/run` with this JSON shape:

```json
{
  "code": "public class Main { ... }",
  "input": "optional standard input"
}
```

Submitted Java must expose `public static void main(String[] args)` in a `Main` class. Execution is time- and memory-limited for local development, but production deployments must run untrusted code in a dedicated sandbox such as gVisor, nsjail, or an isolated container.
