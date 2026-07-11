$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "ensure-node.ps1")
Ensure-Node20 | Out-Null
Set-Location $Root

$LogDir = Join-Path $Root "logs"
$ScriptLogDir = Join-Path $LogDir "scripts"
New-Item -ItemType Directory -Force -Path $ScriptLogDir, (Join-Path $LogDir "snapshots") | Out-Null
$Env:DAYZ_AIO_LOG_DIR = $LogDir

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$PnpmInstallLog = Join-Path $ScriptLogDir "pnpm-install-$stamp.log"
$PnpmInstallLatestLog = Join-Path $ScriptLogDir "pnpm-install-latest.log"
$PnpmBuildLog = Join-Path $ScriptLogDir "pnpm-build-$stamp.log"
$PnpmBuildLatestLog = Join-Path $ScriptLogDir "pnpm-build-latest.log"

function Write-Step($Message) { Write-Host "[DayZ AIO] $Message" -ForegroundColor Cyan }
function Write-Warn($Message) { Write-Host "[DayZ AIO][WARN] $Message" -ForegroundColor Yellow }
function Require-Command($Name, $Hint) { if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "$Name not found. $Hint" } }
function New-Token($Bytes = 32) { $raw = New-Object byte[] $Bytes; $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); try { $rng.GetBytes($raw) } finally { $rng.Dispose() }; return [Convert]::ToBase64String($raw).TrimEnd('=').Replace('+','-').Replace('/','_') }

function Invoke-Native([string]$Exe, [string[]]$ArgsList, [string]$WorkingDir = $Root) {
  Push-Location $WorkingDir
  try {
    Write-Step "$Exe $($ArgsList -join ' ')  [cwd: $WorkingDir]"
    & $Exe @ArgsList 2>&1 | ForEach-Object { Write-Host $_ }
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw "$Exe exited with code $code while running: $($ArgsList -join ' ')" }
  } finally { Pop-Location }
}

function Invoke-NativeLogged([string]$Exe, [string[]]$ArgsList, [string]$LogFile, [string]$LatestFile, [string]$WorkingDir = $Root) {
  Push-Location $WorkingDir
  try {
    if (Test-Path $LogFile) { Remove-Item $LogFile -Force }
    Write-Step "$Exe $($ArgsList -join ' ')  [cwd: $WorkingDir]"
    Write-Step "Step log: $LogFile"
    & $Exe @ArgsList 2>&1 | ForEach-Object {
      $line = $_.ToString()
      Write-Host $line
      Add-Content -Path $LogFile -Value $line -Encoding UTF8
    }
    $code = $LASTEXITCODE
    try { Copy-Item -Path $LogFile -Destination $LatestFile -Force } catch {}
    if ($code -ne 0) {
      Write-Host "" -ForegroundColor Yellow
      Write-Host "Last 80 lines from $LogFile" -ForegroundColor Yellow
      try { Get-Content $LogFile -Tail 80 } catch {}
      throw "$Exe exited with code $code while running: $($ArgsList -join ' ')"
    }
  } finally { Pop-Location }
}

function Enable-Pnpm() {
  $corepack = (Get-Command corepack.cmd -ErrorAction SilentlyContinue)
  if (-not $corepack) { $corepack = (Get-Command corepack -ErrorAction SilentlyContinue) }
  if (-not $corepack) { throw "corepack not found in selected Node.js 20 runtime. Node.js bootstrap is incomplete." }

  Write-Step "Enabling Corepack / pnpm 9.15.9"
  Invoke-Native $corepack.Source @("enable") $Root
  Invoke-Native $corepack.Source @("prepare", "pnpm@9.15.9", "--activate") $Root

  $pnpm = (Get-Command pnpm.cmd -ErrorAction SilentlyContinue)
  if (-not $pnpm) { $pnpm = (Get-Command pnpm -ErrorAction SilentlyContinue) }
  if (-not $pnpm) { throw "pnpm was not found after Corepack activation. Send logs/scripts/install-windows-latest.log and logs/scripts/pnpm-install-latest.log." }
  return $pnpm.Source
}

function Test-DependencyInstall([string]$RootDir) {
  $rootTsc = Join-Path $RootDir "node_modules\.bin\tsc.cmd"
  $backendTsc = Join-Path $RootDir "apps\backend\node_modules\.bin\tsc.cmd"
  $frontendVite = Join-Path $RootDir "apps\frontend\node_modules\.bin\vite.cmd"
  return ((Test-Path $rootTsc) -or ((Test-Path $backendTsc) -and (Test-Path $frontendVite)))
}

Write-Step "Checking prerequisites..."
Require-Command node "Node.js 20 is bootstrapped automatically by install-windows.bat."
$nodeCommand = Get-Command node -ErrorAction Stop
$nodeVersion = (& $nodeCommand.Source -p "process.versions.node").Trim()
$major = [int]($nodeVersion.Split('.')[0])
if ($major -ne 20) { throw "Node.js $nodeVersion is not supported. DayZ AIO requires Node.js 20.x exactly. Portable Node.js 20 bootstrap failed." }
Write-Step "Node.js $nodeVersion OK at $($nodeCommand.Source)"

$env:npm_config_build_from_source = "false"
$env:npm_config_fund = "false"
$env:npm_config_audit = "false"
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = "0"
$env:PNPM_HOME = Join-Path $Root ".dayz-aio-runtime\pnpm-home"
New-Item -ItemType Directory -Force -Path $env:PNPM_HOME | Out-Null

$envFile = Join-Path $Root "apps\backend\.env"
if (-not (Test-Path $envFile)) {
  Write-Step "Creating apps/backend/.env with strong local secrets"
  $apiKey = New-Token 32; $secretKey = New-Token 48
  @"
PORT=8090
HOST=0.0.0.0
DATA_DIR=../../data
DAYZ_ROOT=../../dayz-server
DAYZ_AIO_API_KEY=$apiKey
DAYZ_AIO_SECRET_KEY=$secretKey
DAYZ_AIO_CORS_ORIGINS=http://localhost:3100,http://127.0.0.1:3100,http://localhost:4173,http://127.0.0.1:4173
DAYZ_AIO_RATE_LIMIT_PER_MINUTE=300
DAYZ_AIO_AUTH_FAILURE_LIMIT_PER_MINUTE=20
DAYZ_AIO_RATE_LIMIT_BUCKET_TTL_MS=600000
DAYZ_AIO_RATE_LIMIT_CLEANUP_INTERVAL_MS=300000
DAYZ_AIO_AUTH_DISABLED=false
DAYZ_AIO_BATTLEYE_RCON_ENABLED=false
DAYZ_AIO_RCON_TIMEOUT_MS=5000
DAYZ_AIO_LOG_DIR=../../logs
DAYZ_AIO_BACKEND_LOG_MAX_SIZE_BYTES=5242880
DAYZ_AIO_BACKEND_LOG_MAX_FILES=5
DAYZ_AIO_REQUEST_BODY_LIMIT_BYTES=10485760
DAYZ_AIO_ECONOMY_XML_MAX_BYTES=8388608
DAYZ_AIO_WORKSHOP_STEAMCMD_TIMEOUT_MS=900000
DAYZ_AIO_WORKSHOP_JOB_HISTORY_LIMIT=50
"@ | Set-Content -Path $envFile -Encoding UTF8
  Write-Host "API key generated. Open Security in the UI and paste DAYZ_AIO_API_KEY from:" -ForegroundColor Yellow
  Write-Host "  $envFile" -ForegroundColor Yellow
} else { Write-Step "Existing apps/backend/.env found; preserving secrets" }

Write-Step "Ensuring data folders exist"
New-Item -ItemType Directory -Force -Path (Join-Path $Root "data") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Root "data\backups") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Root "logs"), (Join-Path $Root "logs\scripts"), (Join-Path $Root "logs\snapshots") | Out-Null
$FrontendEnv = Join-Path $Root "apps\frontend\.env.local"
$FrontendEnvContent = @"
VITE_API_BASE=http://localhost:8090
VITE_API_BASE_URL=http://localhost:8090
VITE_DAYZ_AIO_API_BASE_URL=http://localhost:8090
"@
Set-Content -Path $FrontendEnv -Value $FrontendEnvContent -Encoding UTF8
Write-Step "Frontend API config written for backend http://localhost:8090"

$pnpm = Enable-Pnpm
$storeDir = Join-Path $Root ".dayz-aio-runtime\pnpm-store"
New-Item -ItemType Directory -Force -Path $storeDir | Out-Null

Write-Step "Installing dependencies with pnpm. npm is intentionally bypassed; native modules require the selected Node.js 20 runtime."
Invoke-Native $pnpm @("--version") $Root
Invoke-NativeLogged $pnpm @("install", "--store-dir", $storeDir, "--config.verify-store-integrity=false") $PnpmInstallLog $PnpmInstallLatestLog $Root

if (-not (Test-DependencyInstall $Root)) {
  throw "Dependencies are still missing after pnpm install. Send logs/scripts/install-windows-latest.log and logs/scripts/pnpm-install-latest.log."
}

Write-Step "Building packages with pnpm"
Invoke-NativeLogged $pnpm @("-r", "run", "build") $PnpmBuildLog $PnpmBuildLatestLog $Root
Write-Step "Install/build completed. Use start-windows.bat to run the panel."
Write-Step "Install log: $PnpmInstallLatestLog"
Write-Step "Build log:   $PnpmBuildLatestLog"
