param(
  [string]$Api = "http://localhost:8090",
  [string]$DayzRoot = "C:\DayZServer_TEST",
  [string]$ApiKey = "",
  [switch]$Offline
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "ensure-node.ps1")
Ensure-Node20 | Out-Null
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = "0"

function Step($Message) { Write-Host "[Smoke] $Message" -ForegroundColor Cyan }

function Normalize-ApiBase([string]$Value) {
  $candidate = if ([string]::IsNullOrWhiteSpace($Value)) { "http://localhost:8090" } else { $Value.Trim().Trim('"').Trim("'").TrimEnd('/') }
  $uri = $null
  if (-not [System.Uri]::TryCreate($candidate, [System.UriKind]::Absolute, [ref]$uri)) {
    throw "Invalid API base URI '$Value'. Use an absolute URI such as http://localhost:8090."
  }
  if (($uri.Scheme -ne "http") -and ($uri.Scheme -ne "https")) {
    throw "Invalid API base URI '$Value'. Only http and https are supported."
  }
  if ([string]::IsNullOrWhiteSpace($uri.Host)) {
    throw "Invalid API base URI '$Value'. The hostname could not be parsed. Use http://localhost:8090."
  }
  return $uri.AbsoluteUri.TrimEnd('/')
}

function Get-ApiKey() {
  if (-not [string]::IsNullOrWhiteSpace($ApiKey)) { return $ApiKey.Trim() }
  $envFile = Join-Path $Root "apps\backend\.env"
  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^DAYZ_AIO_API_KEY=' } | Select-Object -First 1
    if ($line) { return $line.Substring('DAYZ_AIO_API_KEY='.Length).Trim() }
  }
  throw "No API key supplied and apps/backend/.env does not contain DAYZ_AIO_API_KEY."
}

function Assert-File($Path, $Label) {
  if (-not (Test-Path $Path)) { throw "$Label missing: $Path" }
  Write-Host "[ OK ] $Label" -ForegroundColor Green
  Write-Host "       $Path" -ForegroundColor DarkGray
}

function Invoke-Json($Method, $Url, $Body = $null) {
  $params = @{ Method = $Method; Uri = $Url; Headers = $Headers; ContentType = "application/json" }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10) }
  Invoke-RestMethod @params
}

$ApiBase = Normalize-ApiBase $Api
$Key = Get-ApiKey
$Headers = @{ "X-API-Key" = $Key }

if ($Offline) {
  Step "Running offline installer smoke checks"
  Assert-File (Join-Path $Root "package.json") "repo package.json"
  Assert-File (Join-Path $Root "node_modules") "node_modules"
  Assert-File (Join-Path $Root "apps\backend\.env") "backend .env"
  Assert-File (Join-Path $Root "apps\backend\dist\server.js") "backend build output"
  Assert-File (Join-Path $Root "apps\frontend\dist\index.html") "frontend build output"
  if ([string]::IsNullOrWhiteSpace($Key) -or $Key.Length -lt 24) { throw "DAYZ_AIO_API_KEY is missing or too short." }
  Write-Host "Offline smoke test completed. API smoke was skipped because the backend is not started by the Windows installer workflow." -ForegroundColor Green
  exit 0
}

Step "Checking backend health at $ApiBase"
Invoke-RestMethod "$ApiBase/health" | ConvertTo-Json -Depth 4

Step "Checking authenticated readiness"
Invoke-RestMethod "$ApiBase/api/system/readiness" -Headers $Headers | ConvertTo-Json -Depth 8

Step "Running server detection for $DayzRoot"
$detection = Invoke-Json POST "$ApiBase/api/servers/detect" @{ rootPath = $DayzRoot }
$detection | ConvertTo-Json -Depth 8
if (-not $detection.valid) { throw "Detection failed. Fix DayZRoot before continuing." }

Step "Adding smoke-test server"
$server = Invoke-Json POST "$ApiBase/api/servers" @{ name = "Smoke Test Server"; rootPath = $DayzRoot; launchParams = $detection.launchParams }
$server | ConvertTo-Json -Depth 5

Step "Running safety test"
Invoke-Json POST "$ApiBase/api/servers/$($server.id)/tests/safety" | ConvertTo-Json -Depth 10

Step "Reading runtime status"
Invoke-RestMethod "$ApiBase/api/servers/$($server.id)/status" -Headers $Headers | ConvertTo-Json -Depth 5

Write-Host "Smoke test completed. Start/Stop test intentionally not run here; use UI Test Center after checking ports." -ForegroundColor Green
