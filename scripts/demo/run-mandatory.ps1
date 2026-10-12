# Records the complete mandatory demonstration (all chapters), exports numbered MP4s and verifies them.
#   Full run : powershell -NoProfile -ExecutionPolicy Bypass -File scripts/demo/run-mandatory.ps1
#   Resume   : ... -RunId <existing id> -From 08      (restores the previous checkpoint first)
#   Retry    : ... -RunId <existing id> -Only 05,06
# The recording uses the REAL screen: leave the mouse and keyboard alone until it finishes.
param([string]$RunId, [string]$Only, [string]$From, [switch]$ExportOnly)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $RunId) { $RunId = Get-Date -Format "yyyyMMdd-HHmmss" }
$runDir = Join-Path $root "demo-output\mandatory\$RunId"

foreach ($tool in "ffmpeg", "ffprobe", "node") {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool not found on PATH." }
}
if (-not (Test-Path (Join-Path $root "src\main.tsx"))) { throw "Root src folder is missing; the frontend cannot start." }
if (-not (Test-Path (Join-Path $root "..\lab-02-student-api\.venv\Scripts\python.exe"))) { throw "Lab I virtualenv not found." }

if ($ExportOnly) { & (Join-Path $PSScriptRoot "export-mandatory.ps1") -RunDir $runDir; exit $LASTEXITCODE }

foreach ($port in 8200, 3200) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is already in use; stop the other process first." }
}
New-Item -ItemType Directory -Force $runDir | Out-Null
Write-Host "Run folder: $runDir"

$captureArgs = @((Join-Path $PSScriptRoot "capture-mandatory.mjs"), "--run", $runDir)
if ($Only) { $captureArgs += @("--only", $Only) }
if ($From) { $captureArgs += @("--from", $From) }

try {
  & node @captureArgs
  $captureCode = $LASTEXITCODE
  & (Join-Path $PSScriptRoot "export-mandatory.ps1") -RunDir $runDir
  $exportCode = $LASTEXITCODE
  Write-Host "Capture exit code: $captureCode; export exit code: $exportCode"
  Write-Host "MP4 folder: $(Join-Path $runDir 'mp4')"
  exit ([int]($captureCode -ne 0 -or $exportCode -ne 0))
}
finally {
  # Safety net: stop only processes this runner started (recorded PIDs), and only if they are still python/node.
  foreach ($name in "backend", "frontend") {
    $pidFile = Join-Path $runDir "work\$name.pid"
    if (Test-Path $pidFile) {
      $procId = [int](Get-Content $pidFile)
      $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
      if ($proc -and $proc.ProcessName -match "^(python|node)") { & taskkill /PID $procId /T /F | Out-Null }
    }
  }
}
