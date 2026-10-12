# Re-exports and verifies an existing mandatory-demo run without recording again.
param([Parameter(Mandatory)][string]$RunDir)
$ErrorActionPreference = "Stop"
& node (Join-Path $PSScriptRoot "export-mandatory.mjs") --run $RunDir
exit $LASTEXITCODE
