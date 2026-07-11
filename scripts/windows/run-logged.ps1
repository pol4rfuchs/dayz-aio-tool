param(
  [Parameter(Mandatory=$true)][string]$Name,
  [Parameter(Mandatory=$true)][string]$Script,
  [Parameter(ValueFromRemainingArguments=$true)][string[]]$RemainingArgs
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$LogDir = Join-Path $Root "logs\scripts"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "$Name-$stamp.log"
$LatestFile = Join-Path $LogDir "$Name-latest.log"

Write-Host "[DayZ AIO] Writing script log:" -ForegroundColor Cyan
Write-Host "  $LogFile" -ForegroundColor DarkGray

$exitCode = 0
try {
  if (Test-Path $LogFile) { Remove-Item $LogFile -Force }
  & $Script @RemainingArgs 2>&1 | ForEach-Object {
    $line = $_.ToString()
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
  }
  $exitCode = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 0 }
} catch {
  $line = $_ | Out-String
  Write-Host $line
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  $exitCode = 1
} finally {
  try { Copy-Item -Path $LogFile -Destination $LatestFile -Force } catch {}
}
exit $exitCode
