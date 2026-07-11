$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ServiceName = "DayZAIO"
function Resolve-Nssm {
  $Candidates = @((Join-Path $Root "tools\nssm\win64\nssm.exe"),(Join-Path $Root "tools\nssm\nssm.exe"),"nssm.exe")
  foreach ($Candidate in $Candidates) {
    $Cmd = Get-Command $Candidate -ErrorAction SilentlyContinue
    if ($Cmd) { return $Cmd.Source }
    if (Test-Path $Candidate) { return (Resolve-Path $Candidate).Path }
  }
  return $null
}
$Existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (!$Existing) { Write-Host "Service $ServiceName is not installed."; exit 0 }
try { Stop-Service -Name $ServiceName -ErrorAction SilentlyContinue } catch { }
$Nssm = Resolve-Nssm
if ($Nssm) { & $Nssm remove $ServiceName confirm | Out-Null }
else { sc.exe delete $ServiceName | Out-Null }
Write-Host "Removed service $ServiceName."
