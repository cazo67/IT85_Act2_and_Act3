$ErrorActionPreference = "Stop"

$frontendRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backendRoot = (Resolve-Path (Join-Path $frontendRoot "..\lab-02-student-api")).Path
$python = Join-Path $backendRoot ".venv\Scripts\python.exe"
$resultsDirectory = Join-Path $frontendRoot "test-results"
$databasePath = Join-Path $resultsDirectory "e2e-student-api.db"

if (-not (Test-Path -LiteralPath $python)) {
  throw "Lab 02 Python environment was not found at $python"
}

New-Item -ItemType Directory -Path $resultsDirectory -Force | Out-Null
if (Test-Path -LiteralPath $databasePath) {
  $resolvedDatabase = (Resolve-Path -LiteralPath $databasePath).Path
  if (-not $resolvedDatabase.StartsWith($resultsDirectory + "\")) {
    throw "Refusing to remove an unexpected database path: $resolvedDatabase"
  }
  Remove-Item -LiteralPath $resolvedDatabase -Force
}

$databaseUrl = "sqlite:///" + ($databasePath -replace "\\", "/")
$env:APP_ENV = "test"
$env:DATABASE_URL = $databaseUrl
$env:AUTH_SECRET = "e2e-only-secret-change-me-1234567890"
$env:CORS_ORIGINS = "http://localhost:3100"
$env:PYTHONDONTWRITEBYTECODE = "1"

Push-Location $backendRoot
try {
  & $python -m alembic upgrade head
  if ($LASTEXITCODE -ne 0) { throw "E2E database migration failed." }

  & $python -m app.seed
  if ($LASTEXITCODE -ne 0) { throw "E2E database seed failed." }

  & $python -m uvicorn app.main:app --host 127.0.0.1 --port 8100
  if ($LASTEXITCODE -ne 0) { throw "E2E backend failed." }
}
finally {
  Pop-Location
}
