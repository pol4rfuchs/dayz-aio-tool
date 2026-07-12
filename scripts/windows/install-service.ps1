$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ServiceName = "DayZAIO"
$Runner = Join-Path $Root "scripts\windows\service-runner.ps1"
if (!(Test-Path $Runner)) { throw "Missing $Runner" }

. (Join-Path $PSScriptRoot "ensure-nssm.ps1")

$Nssm = Ensure-Nssm

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
