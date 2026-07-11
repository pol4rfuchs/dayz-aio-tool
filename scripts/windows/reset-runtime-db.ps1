param([switch]$Force)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$db = Join-Path $Root "data\dayz-aio.sqlite"
$wal = "$db-wal"
$shm = "$db-shm"
if (-not $Force) {
  Write-Host "This removes only the DayZ AIO SQLite runtime DB, not your DayZ server files." -ForegroundColor Yellow
  $answer = Read-Host "Type RESET to continue"
  if ($answer -ne "RESET") { Write-Host "Cancelled."; exit 0 }
}
foreach ($file in @($db,$wal,$shm)) {
  if (Test-Path $file) { Remove-Item $file -Force; Write-Host "Removed $file" -ForegroundColor Cyan }
}
Write-Host "Runtime DB reset. Backups on disk are untouched, but DB backup index is cleared." -ForegroundColor Green
