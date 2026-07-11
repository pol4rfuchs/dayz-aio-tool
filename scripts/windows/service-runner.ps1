$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "ensure-node.ps1")
Ensure-Node20 | Out-Null
Set-Location $Root
$LogDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Env:DAYZ_AIO_LOG_DIR = $LogDir
$EnvFile = Join-Path $Root "apps\backend\.env"
if (-not (Test-Path $EnvFile)) { throw "apps/backend/.env missing. Run install-windows.bat first." }
function Get-Pnpm() { $p=Get-Command pnpm.cmd -ErrorAction SilentlyContinue; if(-not $p){$p=Get-Command pnpm -ErrorAction SilentlyContinue}; if(-not $p){ throw "pnpm not found. Run install-windows.bat first." }; return $p.Source }
$pnpm = Get-Pnpm
if (-not (Test-Path (Join-Path $Root "node_modules"))) { & $pnpm install --store-dir (Join-Path $Root ".dayz-aio-runtime\pnpm-store") }
& $pnpm -r run build
if ($LASTEXITCODE -ne 0) { throw "pnpm build failed" }
$backendOut = Join-Path $LogDir "backend-service.out.log"
$backendErr = Join-Path $LogDir "backend-service.err.log"
$frontendOut = Join-Path $LogDir "frontend-service.out.log"
$frontendErr = Join-Path $LogDir "frontend-service.err.log"
$backend = Start-Process -FilePath $pnpm -ArgumentList "--filter", "@dayz-aio/backend", "run", "start" -WorkingDirectory $Root -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr -PassThru -WindowStyle Hidden
$frontend = Start-Process -FilePath $pnpm -ArgumentList "--filter", "@dayz-aio/frontend", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173" -WorkingDirectory $Root -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr -PassThru -WindowStyle Hidden
try {
  while (-not $backend.HasExited -and -not $frontend.HasExited) { Start-Sleep -Seconds 2 }
  if ($backend.HasExited) { throw "Backend process exited with code $($backend.ExitCode)." }
  if ($frontend.HasExited) { throw "Frontend process exited with code $($frontend.ExitCode)." }
} finally {
  foreach ($proc in @($frontend, $backend)) {
    if ($proc -and -not $proc.HasExited) {
      try { $proc.CloseMainWindow() | Out-Null; Start-Sleep -Seconds 2 } catch { }
      if (-not $proc.HasExited) { try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch { } }
    }
  }
}
