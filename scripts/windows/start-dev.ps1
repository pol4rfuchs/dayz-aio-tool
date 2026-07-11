$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "ensure-node.ps1")
Ensure-Node20 | Out-Null
Set-Location $Root
$LogDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Env:DAYZ_AIO_LOG_DIR = $LogDir
$env:npm_config_build_from_source = "false"
$env:npm_config_fund = "false"
$env:npm_config_audit = "false"
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = "0"
$env:PNPM_HOME = Join-Path $Root ".dayz-aio-runtime\pnpm-home"
New-Item -ItemType Directory -Force -Path $env:PNPM_HOME | Out-Null
$EnvFile = Join-Path $Root "apps\backend\.env"
if (-not (Test-Path $EnvFile)) { throw "apps/backend/.env missing. Run install-windows.bat first to generate API/security keys." }
$Env:VITE_API_BASE = "http://localhost:8090"
$Env:VITE_API_BASE_URL = "http://localhost:8090"
$Env:VITE_DAYZ_AIO_API_BASE_URL = "http://localhost:8090"

function Write-Step($Message) { Write-Host "[DayZ AIO] $Message" -ForegroundColor Cyan }
function Require-Command($Name, $Hint) { if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "$Name not found. $Hint" } }
function Ensure-Pnpm() {
  $pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if (-not $pnpm) { $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue }
  if ($pnpm) { return $pnpm.Source }
  $corepack = Get-Command corepack.cmd -ErrorAction SilentlyContinue
  if (-not $corepack) { $corepack = Get-Command corepack -ErrorAction SilentlyContinue }
  if (-not $corepack) { throw "corepack not found. Run install-windows.bat first." }
  & $corepack.Source enable | Out-Host
  & $corepack.Source prepare pnpm@9.15.9 --activate | Out-Host
  $pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if (-not $pnpm) { $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue }
  if (-not $pnpm) { throw "pnpm not found. Run install-windows.bat first." }
  return $pnpm.Source
}

Write-Step "Checking Node/pnpm..."
Require-Command node "Node.js 20 is bootstrapped by install-windows.bat."
$pnpm = Ensure-Pnpm
$nodeVersion = (& node -p "process.versions.node").Trim()
$major = [int]($nodeVersion.Split('.')[0])
if ($major -ne 20) { throw "Node.js $nodeVersion is not supported. DayZ AIO requires Node.js 20.x exactly. Run install-windows.bat." }

if (-not (Test-Path (Join-Path $Root "node_modules")) -and -not (Test-Path (Join-Path $Root "apps\backend\node_modules"))) {
  Write-Step "node_modules missing; running install-windows.bat first..."
  & (Join-Path $Root "install-windows.bat")
}

Write-Step "Starting backend on http://localhost:8090"
$backendLog = Join-Path $LogDir "backend-dev.log"
$backendCmd = "cd /d `"$Root`" && `"$pnpm`" --filter @dayz-aio/backend run dev 1>> `"$backendLog`" 2>>&1"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $backendCmd -WindowStyle Normal | Out-Null
Start-Sleep -Seconds 2

Write-Step "Starting frontend on http://localhost:3100"
$frontendLog = Join-Path $LogDir "frontend-dev.log"
$frontendCmd = "cd /d `"$Root`" && `"$pnpm`" --filter @dayz-aio/frontend run dev 1>> `"$frontendLog`" 2>>&1"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $frontendCmd -WindowStyle Normal | Out-Null

Start-Sleep -Seconds 3
Write-Step "Opening browser..."
Start-Process "http://localhost:3100" | Out-Null
Write-Host ""
Write-Host "Backend health:  http://localhost:8090/health"
Write-Host "Frontend UI:     http://localhost:3100"
Write-Host "Security UI:     http://localhost:3100?page=security"
Write-Host "Doctor UI:       Test Center -> System Doctor"
Write-Host "API key file:    apps/backend/.env"
Write-Host ""
Write-Host "Backend log:     logs\backend.log and logs\backend-dev.log"
Write-Host "Frontend log:    logs\frontend-dev.log"
Write-Host "Keep the two console windows open while testing." -ForegroundColor Yellow
