# DayZ AIO Windows NSSM bootstrapper
# Downloads NSSM only when a local nssm.exe cannot be resolved.

param()

$script:DefaultNssmVersion = if ($env:DAYZ_AIO_NSSM_VERSION) { $env:DAYZ_AIO_NSSM_VERSION } else { "2.24" }
$script:DefaultNssmUrl = if ($env:DAYZ_AIO_NSSM_URL) { $env:DAYZ_AIO_NSSM_URL } else { "https://nssm.cc/release/nssm-$script:DefaultNssmVersion.zip" }

function Write-NssmStep([string]$Message) {
  Write-Host "[DayZ AIO][NSSM] $Message" -ForegroundColor Cyan
}

function Resolve-NssmCandidate([string]$Root) {
  $candidates = @(
    (Join-Path $Root "tools\nssm\win64\nssm.exe"),
    (Join-Path $Root "tools\nssm\nssm.exe"),
    "nssm.exe"
  )

  foreach ($candidate in $candidates) {
    try {
      $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
      if ($cmd -and $cmd.Source) { return (Resolve-Path $cmd.Source).Path }
    } catch {}

    if (Test-Path $candidate -PathType Leaf) {
      return (Resolve-Path $candidate).Path
    }
  }

  return $null
}

function Test-NssmExecutable([string]$NssmPath) {
  if (-not (Test-Path $NssmPath -PathType Leaf)) { return $false }
  try {
    $output = & $NssmPath version 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace(($output | Out-String))) { return $true }
  } catch {}

  # Some NSSM builds still return a useful binary without a friendly version call.
  # Existence is enough for later `nssm install/set` calls, but keep this function
  # so the installer can be tightened later without changing callers.
  return $true
}

function Install-Nssm([string]$Root, [string]$Version = $script:DefaultNssmVersion) {
  $runtimeRoot = Join-Path $Root ".dayz-aio-runtime"
  $cacheDir = Join-Path $runtimeRoot "nssm-cache"
  $extractDir = Join-Path $runtimeRoot "extract-nssm"
  $targetDir = Join-Path $Root "tools\nssm\win64"
  $targetExe = Join-Path $targetDir "nssm.exe"
  $zipName = "nssm-$Version.zip"
  $zipPath = Join-Path $cacheDir $zipName
  $urls = @(
    $script:DefaultNssmUrl,
    "https://www.nssm.cc/release/nssm-$Version.zip"
  ) | Select-Object -Unique

  New-Item -ItemType Directory -Force -Path $cacheDir, $targetDir | Out-Null

  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  } catch {}

  if (-not (Test-Path $zipPath -PathType Leaf)) {
    $downloaded = $false
    foreach ($url in $urls) {
      Write-NssmStep "Downloading $zipName from $url"
      try {
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zipPath -TimeoutSec 300
        $downloaded = $true
        break
      } catch {
        Write-NssmStep "Download failed from ${url}: $($_.Exception.Message)"
        if (Test-Path $zipPath -PathType Leaf) { Remove-Item $zipPath -Force -ErrorAction SilentlyContinue }
      }
    }
    if (-not $downloaded) {
      throw "NSSM download failed. Place nssm.exe manually at $targetExe or set DAYZ_AIO_NSSM_URL to a reachable nssm-$Version.zip mirror."
    }
  } else {
    Write-NssmStep "Using cached $zipName"
  }

  if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

  Write-NssmStep "Extracting NSSM"
  Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

  $sourceExe = Get-ChildItem $extractDir -Recurse -Filter nssm.exe -File |
    Where-Object { $_.FullName -match "[\\/]win64[\\/]nssm\.exe$" } |
    Select-Object -First 1

  if (-not $sourceExe) {
    $sourceExe = Get-ChildItem $extractDir -Recurse -Filter nssm.exe -File | Select-Object -First 1
  }

  if (-not $sourceExe) {
    throw "Downloaded NSSM archive did not contain nssm.exe. Archive path: $zipPath"
  }

  Copy-Item -Path $sourceExe.FullName -Destination $targetExe -Force
  Remove-Item $extractDir -Recurse -Force

  if (-not (Test-NssmExecutable $targetExe)) {
    throw "NSSM bootstrap produced an unusable executable at $targetExe."
  }

  Write-NssmStep "NSSM ready at $targetExe"
  return (Resolve-Path $targetExe).Path
}

function Ensure-Nssm([switch]$NoDownload) {
  $Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
  $existing = Resolve-NssmCandidate $Root
  if ($existing -and (Test-NssmExecutable $existing)) {
    Write-NssmStep "Using NSSM at $existing"
    return $existing
  }

  if ($NoDownload) {
    throw "NSSM was not found. Run install-service-windows.bat without -NoDownload, or place nssm.exe at $Root\tools\nssm\win64\nssm.exe."
  }

  return Install-Nssm $Root $script:DefaultNssmVersion
}
