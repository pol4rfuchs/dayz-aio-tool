param(
  [string]$Api = "http://localhost:8090",
  [string]$DayzRoot = "C:\DayZServer_TEST",
  [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "ensure-node.ps1")
Ensure-Node20 | Out-Null
function Step($Message) { Write-Host "[Smoke] $Message" -ForegroundColor Cyan }
function Get-ApiKey() {
  if ($ApiKey -ne "") { return $ApiKey }
  $envFile = Join-Path $Root "apps\backend\.env"
  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^DAYZ_AIO_API_KEY=' } | Select-Object -First 1
    if ($line) { return $line.Substring('DAYZ_AIO_API_KEY='.Length).Trim() }
  }
  throw "No API key supplied and apps/backend/.env does not contain DAYZ_AIO_API_KEY."
}
$Key = Get-ApiKey
$Headers = @{ "X-API-Key" = $Key }
function Invoke-Json($Method, $Url, $Body = $null) {
  $params = @{ Method = $Method; Uri = $Url; Headers = $Headers; ContentType = "application/json" }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10) }
  Invoke-RestMethod @params
}

Step "Checking backend health"
Invoke-RestMethod "$Api/health" | ConvertTo-Json -Depth 4

Step "Checking authenticated readiness"
Invoke-RestMethod "$Api/api/system/readiness" -Headers $Headers | ConvertTo-Json -Depth 8

Step "Running server detection for $DayzRoot"
$detection = Invoke-Json POST "$Api/api/servers/detect" @{ rootPath = $DayzRoot }
$detection | ConvertTo-Json -Depth 8
if (-not $detection.valid) { throw "Detection failed. Fix DayZRoot before continuing." }

Step "Adding smoke-test server"
$server = Invoke-Json POST "$Api/api/servers" @{ name = "Smoke Test Server"; rootPath = $DayzRoot; launchParams = $detection.launchParams }
$server | ConvertTo-Json -Depth 5

Step "Running safety test"
Invoke-Json POST "$Api/api/servers/$($server.id)/tests/safety" | ConvertTo-Json -Depth 10

Step "Reading runtime status"
Invoke-RestMethod "$Api/api/servers/$($server.id)/status" -Headers $Headers | ConvertTo-Json -Depth 5

Write-Host "Smoke test completed. Start/Stop test intentionally not run here; use UI Test Center after checking ports." -ForegroundColor Green
