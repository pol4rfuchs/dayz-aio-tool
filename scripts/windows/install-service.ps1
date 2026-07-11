$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ServiceName = "DayZAIO"
$Runner = Join-Path $Root "scripts\windows\service-runner.ps1"
if (!(Test-Path $Runner)) { throw "Missing $Runner" }

function Resolve-Nssm {
  $Candidates = @(
    (Join-Path $Root "tools\nssm\win64\nssm.exe"),
    (Join-Path $Root "tools\nssm\nssm.exe"),
    "nssm.exe"
  )
  foreach ($Candidate in $Candidates) {
    $Cmd = Get-Command $Candidate -ErrorAction SilentlyContinue
    if ($Cmd) { return $Cmd.Source }
    if (Test-Path $Candidate) { return (Resolve-Path $Candidate).Path }
  }
  return $null
}

$Nssm = Resolve-Nssm
if (!$Nssm) {
  throw @"
NSSM was not found. v0.4.1 intentionally refuses the old cmd.exe Windows-service wrapper because it cannot handle SCM stop signals safely.

Install NSSM and rerun this script, for example place nssm.exe at:
  $Root\tools\nssm\win64\nssm.exe

Manual fallback: run start-production-windows.bat from a normal console.
"@
}

$Existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($Existing) { throw "Service $ServiceName already exists. Run uninstall-service-windows.bat first." }

& $Nssm install $ServiceName "powershell.exe" | Out-Null
& $Nssm set $ServiceName AppParameters "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`"" | Out-Null
& $Nssm set $ServiceName AppDirectory "$Root" | Out-Null
& $Nssm set $ServiceName DisplayName "DayZ AIO Control Plane" | Out-Null
& $Nssm set $ServiceName Description "DayZ AIO browser control plane with backend and frontend." | Out-Null
& $Nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null
& $Nssm set $ServiceName AppStopMethodConsole 15000 | Out-Null
& $Nssm set $ServiceName AppStopMethodWindow 15000 | Out-Null
& $Nssm set $ServiceName AppStopMethodThreads 15000 | Out-Null
& $Nssm set $ServiceName AppThrottle 1500 | Out-Null
& $Nssm set $ServiceName AppStdout (Join-Path $Root "logs\service-stdout.log") | Out-Null
& $Nssm set $ServiceName AppStderr (Join-Path $Root "logs\service-stderr.log") | Out-Null
& $Nssm set $ServiceName AppRotateFiles 1 | Out-Null
& $Nssm set $ServiceName AppRotateBytes 5242880 | Out-Null

Write-Host "Installed service $ServiceName using NSSM. Start it with: Start-Service $ServiceName"
