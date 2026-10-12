$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backend = (Resolve-Path (Join-Path $root "..\lab-02-student-api")).Path
$python = Join-Path $backend ".venv\Scripts\python.exe"
$out = Join-Path $root "demo-output"
$work = Join-Path $out "work"
$apiPort = 8200
$webPort = 3200
$started = @()

foreach ($tool in "ffmpeg", "ffprobe", "node") {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool not found on PATH." }
}
if (-not (Test-Path $python)) { throw "Backend virtualenv not found at $python" }
foreach ($p in $apiPort, $webPort) {
  if (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) { throw "Port $p is already in use." }
}

if (-not $env:DEMO_ADMIN_PASSWORD) {
  $secure = Read-Host -AsSecureString "Demo admin password"
  $env:DEMO_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

# Only the demo output folder is cleared.
if (Test-Path $out) {
  if ((Resolve-Path $out).Path -ne (Join-Path $root "demo-output")) { throw "Unexpected output path." }
  Remove-Item $out -Recurse -Force
}
New-Item -ItemType Directory -Force (Join-Path $out "raw"), $work | Out-Null

function Wait-Url($url, $name, $seconds = 90) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3 | Out-Null; return } catch { Start-Sleep -Milliseconds 500 }
  }
  throw "$name did not become ready at $url (see logs in $work)."
}

try {
  $env:APP_ENV = "test"
  $env:DATABASE_URL = "sqlite:///" + ((Join-Path $work "demo-student-api.db") -replace "\\", "/")
  $env:AUTH_SECRET = "demo-only-secret-change-me-1234567890"
  $env:CORS_ORIGINS = "http://localhost:$webPort"
  $env:PYTHONDONTWRITEBYTECODE = "1"
  Push-Location $backend
  try {
    & $python -m alembic upgrade head
    if ($LASTEXITCODE) { throw "Migration failed." }
    & $python -m app.seed
    if ($LASTEXITCODE) { throw "Seed failed." }
  } finally { Pop-Location }

  $api = Start-Process $python -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$apiPort" -WorkingDirectory $backend -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $work "api.log") -RedirectStandardError (Join-Path $work "api.err.log")
  $started += $api
  Wait-Url "http://127.0.0.1:$apiPort/health" "Backend"

  $env:VITE_API_BASE_URL = "http://127.0.0.1:$apiPort/api/v1"
  $web = Start-Process "node" -ArgumentList "node_modules/vite/bin/vite.js", "--port", "$webPort", "--strictPort" -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $work "web.log") -RedirectStandardError (Join-Path $work "web.err.log")
  $started += $web
  Wait-Url "http://localhost:$webPort" "Frontend"

  $env:DEMO_FRONTEND_URL = "http://localhost:$webPort"
  $env:DEMO_RAW_DIR = Join-Path $out "raw"
  & node (Join-Path $PSScriptRoot "capture-demo.mjs")
  if ($LASTEXITCODE) { throw "Capture failed." }
  & (Join-Path $PSScriptRoot "export-and-verify.ps1") -OutDir $out
  Write-Host "Done: $(Join-Path $out 'demo.mp4')"
}
finally {
  foreach ($p in $started) { if ($p -and -not $p.HasExited) { & taskkill /PID $p.Id /T /F | Out-Null } }
  Remove-Item Env:DEMO_ADMIN_PASSWORD -ErrorAction SilentlyContinue
}
