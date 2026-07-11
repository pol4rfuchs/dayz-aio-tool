$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "ensure-node.ps1")
Ensure-Node20 | Out-Null
Set-Location $Root
$LogDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Env:DAYZ_AIO_LOG_DIR = $LogDir
$EnvFile = Join-Path $Root "apps\backend\.env"
if (-not (Test-Path $EnvFile)) { throw "apps/backend/.env missing. Run install-windows.bat first to generate API/security keys." }
function Step($Message) { Write-Host "[Build] $Message" -ForegroundColor Cyan }
function Get-Pnpm() { $p=Get-Command pnpm.cmd -ErrorAction SilentlyContinue; if(-not $p){$p=Get-Command pnpm -ErrorAction SilentlyContinue}; if(-not $p){ throw "pnpm not found. Run install-windows.bat first." }; return $p.Source }
$pnpm = Get-Pnpm
Step "Installing dependencies if needed"
if (-not (Test-Path (Join-Path $Root "node_modules"))) { & $pnpm install --store-dir (Join-Path $Root ".dayz-aio-runtime\pnpm-store") }
if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }
Step "Running workspace build"
& $pnpm -r run build
if ($LASTEXITCODE -ne 0) { throw "pnpm build failed" }
Step "Build completed"
