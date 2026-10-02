# Laboratory 3 - Student Information Frontend

This repository contains the **React/Vite frontend only**. It connects to the
FastAPI backend from Laboratory 2.

- **Lab 02:** `C:\ITSD 85 Projects\lab-02-student-api` (backend and database)
- **Lab 03:** `C:\ITSD 85 Projects\lab-03-frontend-client` (frontend)

Keep the projects in these separate sibling folders. Both servers must be
running at the same time when using the application.

> If PowerShell is currently inside `lab-03-frontend-client`, use
> `cd ..\lab-02-student-api` to move to the backend. The command
> `cd .\lab-02-student-api` works only when you are already in
> `C:\ITSD 85 Projects`.

## Requirements

- Python 3.10 or newer for Lab 02
- Node.js 20.19 or newer and npm for Lab 03
- Windows PowerShell

## First-time setup

Complete these steps once after downloading or cloning the two projects.

### 1. Set up the Lab 02 backend

Open PowerShell and run:

```powershell
cd "C:\ITSD 85 Projects\lab-02-student-api"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m alembic upgrade head
python -m app.seed
```

If `.venv` or `.env` already exists, do not recreate or overwrite it. The seed
command creates the local demonstration data and accounts.

### 2. Set up the Lab 03 frontend

Open PowerShell and run:

```powershell
cd "C:\ITSD 85 Projects\lab-03-frontend-client"
npm install
Copy-Item .env.example .env
```

If `.env` already exists, do not overwrite it. Its API setting should be:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## Run the frontend and backend

Every time you use the system, open **two separate PowerShell terminals** and
keep both of them running.

### Terminal 1 - Run the Lab 02 backend

```powershell
cd "C:\ITSD 85 Projects\lab-02-student-api"
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Backend: <http://127.0.0.1:8000>
- Swagger API documentation: <http://127.0.0.1:8000/api/docs>

Using `python -m uvicorn` ensures that Uvicorn runs with the Python interpreter
from the active virtual environment.

### Terminal 2 - Run the Lab 03 frontend

```powershell
cd "C:\ITSD 85 Projects\lab-03-frontend-client"
npm run dev
```

- Frontend: <http://localhost:3000>

Open the frontend URL in your browser after both terminals are running. Press
`Ctrl+C` in each terminal when you want to stop the servers.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

For the major Playwright CRUD and role-workflow suite:

```powershell
npm run test:e2e
```

The E2E command automatically starts an isolated test backend on port `8100`
and the frontend on port `3100`. It uses a disposable database under
`test-results/`, so the normal Lab 02 database is not changed. The Lab 02
project must remain in the sibling `lab-02-student-api` folder with its Python
environment installed.

See [`docs/QA_TEST_MATRIX.md`](docs/QA_TEST_MATRIX.md) and
[`docs/QA_REPORT.md`](docs/QA_REPORT.md) for coverage and the latest results.

## Common problems

- **PowerShell blocks `Activate.ps1`:** run
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, reopen PowerShell, and
  activate the environment again.
- **`uvicorn` is not recognized or shows a launcher error:** activate the Lab 02
  virtual environment and use `python -m uvicorn app.main:app --reload`.
- **A Python package is missing:** activate Lab 02's `.venv`, then run
  `python -m pip install -r requirements.txt`.
- **A frontend package is missing:** run `npm install` inside Lab 03.
- **The frontend cannot reach the backend:** make sure Terminal 1 is still
  running and `.env` contains the correct `VITE_API_BASE_URL`.
- **A port is already in use:** stop the older backend or frontend process, then try again.

The frontend connects to `http://127.0.0.1:8000/api/v1`, configured in
`.env.example`. Keep backend secrets and database credentials in Lab 02 only.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/API_INTEGRATION_MAP.md`](docs/API_INTEGRATION_MAP.md) for technical details.
