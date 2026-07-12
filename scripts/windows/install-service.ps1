$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ServiceName = "DayZAIO"
$ServiceMain = Join-Path $Root "scripts\windows\service-main.mjs"
if (!(Test-Path $ServiceMain)) { throw "Missing $ServiceMain" }

. (Join-Path $PSScriptRoot "ensure-node.ps1")
. (Join-Path $PSScriptRoot "ensure-nssm.ps1")

$Nssm = Ensure-Nssm

$Existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($Existing) { throw "Service $ServiceName already exists. Run uninstall-service-windows.bat first." }

$NodeInfo = Ensure-Node20
$NodeExe = $NodeInfo.NodeExe
if (!(Test-Path $NodeExe)) { throw "Missing selected Node.js runtime at $NodeExe" }

& $Nssm install $ServiceName "$NodeExe" | Out-Null
& $Nssm set $ServiceName AppParameters "`"$ServiceMain`"" | Out-Null
& $Nssm set $ServiceName AppDirectory "$Root" | Out-Null
& $Nssm set $ServiceName DisplayName "DayZ AIO Control Plane" | Out-Null
& $Nssm set $ServiceName Description "DayZ AIO browser control plane with graceful Node service supervisor." | Out-Null
& $Nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null
& $Nssm set $ServiceName AppStopMethodConsole 15000 | Out-Null
& $Nssm set $ServiceName AppStopMethodWindow 0 | Out-Null
& $Nssm set $ServiceName AppStopMethodThreads 0 | Out-Null
& $Nssm set $ServiceName AppKillProcessTree 1 | Out-Null
& $Nssm set $ServiceName AppThrottle 1500 | Out-Null
& $Nssm set $ServiceName AppStdout (Join-Path $Root "logs\service-stdout.log") | Out-Null
& $Nssm set $ServiceName AppStderr (Join-Path $Root "logs\service-stderr.log") | Out-Null
& $Nssm set $ServiceName AppRotateFiles 1 | Out-Null
& $Nssm set $ServiceName AppRotateBytes 5242880 | Out-Null

Write-Host "Installed service $ServiceName using NSSM and Node.js runtime $NodeExe. Start it with: Start-Service $ServiceName"
