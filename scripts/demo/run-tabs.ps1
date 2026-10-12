# Feasibility run: one visible Chrome window, three signed-in tabs, true 30 fps screen capture.
# The recording uses the real screen: do not touch the mouse/keyboard until it finishes (~1 min).
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backend = (Resolve-Path (Join-Path $root "..\lab-02-student-api")).Path
$python = Join-Path $backend ".venv\Scripts\python.exe"
$run = Join-Path $root ("demo-output\tabs-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$work = Join-Path $run "work"
$apiPort = 8200
$webPort = 3200
$started = @()

foreach ($tool in "ffmpeg", "ffprobe", "node") {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool not found on PATH." }
}
if (-not (Test-Path $python)) { throw "Backend virtualenv not found at $python" }
if (-not (Test-Path (Join-Path $root "src\main.tsx"))) { throw "Root src folder is missing." }
foreach ($p in $apiPort, $webPort) {
  if (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) { throw "Port $p is already in use." }
}
foreach ($name in "ADMIN", "STUDENT", "INSTRUCTOR") {
  $var = "DEMO_${name}_PASSWORD"
  if (-not [Environment]::GetEnvironmentVariable($var)) {
    $secure = Read-Host -AsSecureString "$name password"
    [Environment]::SetEnvironmentVariable($var, [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)))
  }
}
New-Item -ItemType Directory -Path (Join-Path $run "raw"), (Join-Path $run "frames"), $work | Out-Null

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

  $started += Start-Process $python -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$apiPort" -WorkingDirectory $backend -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $work "api.log") -RedirectStandardError (Join-Path $work "api.err.log")
  Wait-Url "http://127.0.0.1:$apiPort/health" "Backend"
  $env:VITE_API_BASE_URL = "http://127.0.0.1:$apiPort/api/v1"
  $started += Start-Process "node" -ArgumentList "node_modules/vite/bin/vite.js", "--port", "$webPort", "--strictPort" -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $work "web.log") -RedirectStandardError (Join-Path $work "web.err.log")
  Wait-Url "http://localhost:$webPort" "Frontend"

  $env:DEMO_FRONTEND_URL = "http://localhost:$webPort"
  $env:DEMO_RAW_DIR = Join-Path $run "raw"
  & node (Join-Path $PSScriptRoot "capture-tabs.mjs")
  if ($LASTEXITCODE) { throw "Capture failed." }

  $mp4 = Join-Path $run "demo-tabs.mp4"
  & ffmpeg -y -v error -i (Join-Path $run "raw\screen.mkv") -vf "fps=30,scale=1920:1080,format=yuv420p" -c:v libx264 -preset slow -crf 16 -r 30 -fps_mode cfr -an -movflags +faststart $mp4
  if ($LASTEXITCODE) { throw "Export failed." }
  & ffprobe -v error -show_entries "stream=codec_name,width,height,r_frame_rate,avg_frame_rate:format=duration" -of default=nw=1 $mp4
  $dur = [double](& ffprobe -v error -show_entries format=duration -of csv=p=0 $mp4)
  foreach ($t in 0.5, 3, 6, 9, 12, 15, 18, 21) { if ($t -lt $dur) { & ffmpeg -y -v error -ss $t -i $mp4 -frames:v 1 (Join-Path $run "frames\frame-${t}s.png") } }
  Write-Host "Done: $mp4"
}
finally {
  foreach ($p in $started) { if ($p -and -not $p.HasExited) { & taskkill /PID $p.Id /T /F | Out-Null } }
  foreach ($name in "ADMIN", "STUDENT", "INSTRUCTOR") { [Environment]::SetEnvironmentVariable("DEMO_${name}_PASSWORD", $null) }
}
