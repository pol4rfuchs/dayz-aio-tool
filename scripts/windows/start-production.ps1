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
function Step($Message) { Write-Host "[DayZ AIO] $Message" -ForegroundColor Cyan }
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
if (-not (Test-Path (Join-Path $Root "node_modules"))) { Step "node_modules missing; running pnpm install"; & $pnpm install --store-dir (Join-Path $Root ".dayz-aio-runtime\pnpm-store") --config.verify-store-integrity=false }
Step "Building before production-style start"
& $pnpm -r run build
if ($LASTEXITCODE -ne 0) { throw "pnpm build failed" }
Step "Starting backend from dist on http://localhost:8090"
$backendLog = Join-Path $LogDir "backend-production.log"
$backendCmd = "cd /d `"$Root`" && `"$pnpm`" --filter @dayz-aio/backend run start 1>> `"$backendLog`" 2>>&1"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $backendCmd -WindowStyle Normal | Out-Null
Start-Sleep -Seconds 2
Step "Starting frontend preview on http://localhost:4173"
$frontendLog = Join-Path $LogDir "frontend-production.log"
$frontendCmd = "cd /d `"$Root`" && `"$pnpm`" --filter @dayz-aio/frontend run preview -- --host 0.0.0.0 --port 4173 1>> `"$frontendLog`" 2>>&1"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $frontendCmd -WindowStyle Normal | Out-Null
Start-Sleep -Seconds 3
Start-Process "http://localhost:4173" | Out-Null
Write-Host "Backend:  http://localhost:8090/health"
Write-Host "Frontend: http://localhost:4173"
Write-Host "API key file: apps/backend/.env"
Write-Host "Backend log: logs\backend.log and logs\backend-production.log"
Write-Host "Frontend log: logs\frontend-production.log"
Write-Host "Use dev start for active coding; use this for runtime smoke tests after build." -ForegroundColor Yellow
