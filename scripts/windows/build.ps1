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
function Step($Message) { Write-Host "[Build] $Message" -ForegroundColor Cyan }
function Get-Pnpm() {
  $p=Get-Command pnpm.cmd -ErrorAction SilentlyContinue; if(-not $p){$p=Get-Command pnpm -ErrorAction SilentlyContinue}
  if($p){ return $p.Source }
  $c=Get-Command corepack.cmd -ErrorAction SilentlyContinue; if(-not $c){$c=Get-Command corepack -ErrorAction SilentlyContinue}
  if(-not $c){ throw "corepack/pnpm not found. Run install-windows.bat first." }
  & $c.Source enable | Out-Host
  & $c.Source prepare pnpm@9.15.9 --activate | Out-Host
  $p=Get-Command pnpm.cmd -ErrorAction SilentlyContinue; if(-not $p){$p=Get-Command pnpm -ErrorAction SilentlyContinue}
  if(-not $p){ throw "pnpm not found. Run install-windows.bat first." }
  return $p.Source
}
$pnpm = Get-Pnpm
Step "Installing dependencies if needed"
if (-not (Test-Path (Join-Path $Root "node_modules"))) { & $pnpm install --store-dir (Join-Path $Root ".dayz-aio-runtime\pnpm-store") --config.verify-store-integrity=false }
if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }
Step "Running workspace build"
& $pnpm -r run build
if ($LASTEXITCODE -ne 0) { throw "pnpm build failed" }
Step "Build completed"
