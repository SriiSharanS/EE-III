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

## Checks

```powershell
npm.cmd run build
npm.cmd run lint
```

Backend health is available at `GET /api/health`. Java execution is available at `POST /api/run` with this JSON shape:

```json
{
  "code": "public class Main { ... }",
  "input": "optional standard input"
}
```

Submitted Java must expose `public static void main(String[] args)` in a `Main` class. Execution is time- and memory-limited for local development, but production deployments must run untrusted code in a dedicated sandbox such as gVisor, nsjail, or an isolated container.
