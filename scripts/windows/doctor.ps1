param(
  [string]$DayzRoot = "",
  [switch]$Json
)

$ErrorActionPreference = "Continue"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "ensure-node.ps1")
Set-Location $Root
$LogDir = Join-Path $Root "logs"
$SnapshotDir = Join-Path $LogDir "snapshots"
New-Item -ItemType Directory -Force -Path $LogDir, $SnapshotDir | Out-Null
$Env:DAYZ_AIO_LOG_DIR = $LogDir
$checks = New-Object System.Collections.Generic.List[object]

function Add-Check($Name, $Ok, $Message, $Path = $null) {
  $checks.Add([pscustomobject]@{ name = $Name; ok = [bool]$Ok; message = $Message; path = $Path }) | Out-Null
}
function Test-Cmd($Name) { return [bool](Get-Command $Name -ErrorAction SilentlyContinue) }
function Test-PortFree($Port) {
  try { return -not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) }
  catch { return $true }
}

$envFile = Join-Path $Root "apps\backend\.env"
Add-Check "repo root" (Test-Path (Join-Path $Root "package.json")) "package.json found" $Root
Add-Check "backend .env" (Test-Path $envFile) "Required for API auth and secret encryption. Run install-windows.bat if missing." $envFile
if (Test-Path $envFile) {
  $envText = Get-Content $envFile -Raw
  Add-Check "API key configured" ($envText -match 'DAYZ_AIO_API_KEY=.{24,}') "DAYZ_AIO_API_KEY must be strong and present" $envFile
  Add-Check "secret key configured" ($envText -match 'DAYZ_AIO_SECRET_KEY=.{32,}') "DAYZ_AIO_SECRET_KEY must be strong and present" $envFile
  Add-Check "CORS allowlist" ($envText -match 'DAYZ_AIO_CORS_ORIGINS=') "CORS allowlist should be explicit" $envFile
}
$portableNode = Join-Path $Root ".dayz-aio-runtime\node20\node.exe"
$systemNode = Get-NodeVersionFromCommand "node"
$portableInfo = Get-NodeVersionFromPath $portableNode
$nodeOk = ($systemNode -and $systemNode.Major -eq 20) -or ($portableInfo -and $portableInfo.Major -eq 20)
Add-Check "node runtime" $nodeOk "Node.js 20.x exactly is required. Node 22/24 are rejected because better-sqlite3 native bindings are installed for the Node-20 ABI. install-windows.bat can bootstrap portable Node.js 20.20.2."
if ($systemNode) { Add-Check "system node version" ($systemNode.Major -eq 20) "Detected system Node.js $($systemNode.Version) at $($systemNode.Path)" }
if ($portableInfo) { Add-Check "portable node version" ($portableInfo.Major -eq 20) "Detected portable Node.js $($portableInfo.Version) at $($portableInfo.Path)" }
if (-not $systemNode -and -not $portableInfo) { Add-Check "node available" $false "No Node.js runtime detected yet. Run install-windows.bat to download portable Node.js 20.20.2." }
Add-Check "npm" ((Test-Cmd npm) -or (Test-Path (Join-Path $Root ".dayz-aio-runtime\node20\npm.cmd"))) "npm must be available from the selected Node.js 20 runtime"
Add-Check "node_modules" (Test-Path (Join-Path $Root "node_modules")) "Run install-windows.bat if this is false" (Join-Path $Root "node_modules")
$p8090 = Test-PortFree 8090
Add-Check "backend port 8090" $true "Free before start: $p8090. False is OK if backend is already running; bad only if another app occupies it."
$p3100 = Test-PortFree 3100
Add-Check "frontend port 3100" $true "Free before start: $p3100. False is OK if frontend is already running; bad only if another app occupies it."
Add-Check "data folder" (Test-Path (Join-Path $Root "data")) "data folder exists" (Join-Path $Root "data")
Add-Check "backup folder" (Test-Path (Join-Path $Root "data\backups")) "backup folder exists" (Join-Path $Root "data\backups")

if ($DayzRoot -ne "") {
  $resolved = $DayzRoot.Trim('"')
  Add-Check "DayZ root" (Test-Path $resolved -PathType Container) "DayZ server root folder must exist" $resolved
  Add-Check "DayZServer_x64.exe" (Test-Path (Join-Path $resolved "DayZServer_x64.exe") -PathType Leaf) "Executable must exist" (Join-Path $resolved "DayZServer_x64.exe")
  Add-Check "serverDZ.cfg" (Test-Path (Join-Path $resolved "serverDZ.cfg") -PathType Leaf) "serverDZ.cfg must exist" (Join-Path $resolved "serverDZ.cfg")
  Add-Check "mpmissions" (Test-Path (Join-Path $resolved "mpmissions") -PathType Container) "mpmissions folder should exist" (Join-Path $resolved "mpmissions")
}

$result = [pscustomobject]@{ ok = -not ($checks | Where-Object { -not $_.ok }); createdAt = (Get-Date).ToString("o"); root = $Root.Path; checks = $checks }
$resultJson = $result | ConvertTo-Json -Depth 8
$resultJson | Set-Content -Path (Join-Path $SnapshotDir "windows-doctor-last.json") -Encoding UTF8
$resultJson | Set-Content -Path (Join-Path $SnapshotDir "doctor-last.json") -Encoding UTF8
if ($Json) { $resultJson; exit }
Write-Host "DayZ AIO Windows Doctor" -ForegroundColor Cyan
Write-Host "Root: $($Root.Path)"
Write-Host ""
foreach ($check in $checks) {
  $prefix = if ($check.ok) { "[ OK ]" } else { "[FAIL]" }
  $color = if ($check.ok) { "Green" } else { "Red" }
  Write-Host "$prefix $($check.name) - $($check.message)" -ForegroundColor $color
  if ($check.path) { Write-Host "       $($check.path)" -ForegroundColor DarkGray }
}
Write-Host ""
if ($result.ok) { Write-Host "Doctor passed." -ForegroundColor Green } else { Write-Host "Doctor found problems. Fix FAIL items before using a real server." -ForegroundColor Yellow }
