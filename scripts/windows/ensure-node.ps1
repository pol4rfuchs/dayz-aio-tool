# DayZ AIO Windows Node bootstrapper
# Ensures Node.js >= 20 is available for this PowerShell process without requiring a system-wide install.

function Write-NodeStep([string]$Message) {
  Write-Host "[DayZ AIO][Node] $Message" -ForegroundColor Cyan
}

function Get-NodeVersionFromCommand([string]$CommandName) {
  try {
    $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
    if (-not $cmd) { return $null }
    $version = (& $cmd.Source -p "process.versions.node" 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($version)) { return $null }
    return [pscustomobject]@{
      Path = $cmd.Source
      Version = $version
      Major = [int]($version.Split('.')[0])
    }
  } catch {
    return $null
  }
}

function Get-NodeVersionFromPath([string]$NodeExe) {
  try {
    if (-not (Test-Path $NodeExe -PathType Leaf)) { return $null }
    $version = (& $NodeExe -p "process.versions.node" 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($version)) { return $null }
    return [pscustomobject]@{
      Path = $NodeExe
      Version = $version
      Major = [int]($version.Split('.')[0])
    }
  } catch {
    return $null
  }
}

function Add-NodeToPath([string]$NodeDir) {
  $current = [Environment]::GetEnvironmentVariable("Path", "Process")
  $parts = $current -split ';' | Where-Object { $_ -and $_.Trim() -ne '' }
  $already = $parts | Where-Object { $_.TrimEnd('\') -ieq $NodeDir.TrimEnd('\') }
  if (-not $already) {
    [Environment]::SetEnvironmentVariable("Path", "$NodeDir;$current", "Process")
  }
}

function Get-NodeWinArch() {
  $arch = $env:PROCESSOR_ARCHITECTURE
  if ($arch -eq "ARM64") { return "arm64" }
  return "x64"
}

function Install-PortableNode20([string]$Root) {
  $arch = Get-NodeWinArch
  $runtimeRoot = Join-Path $Root ".dayz-aio-runtime"
  $cacheDir = Join-Path $runtimeRoot "cache"
  $nodeParent = Join-Path $runtimeRoot "node20"
  $extractDir = Join-Path $runtimeRoot "extract-node20"

  New-Item -ItemType Directory -Force -Path $runtimeRoot, $cacheDir | Out-Null

  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  } catch {}

  $indexUrl = "https://nodejs.org/dist/latest-v20.x/"
  Write-NodeStep "System Node.js >=20 not found. Bootstrapping portable Node.js 20 ($arch)."
  Write-NodeStep "Reading $indexUrl"

  try {
    $index = Invoke-WebRequest -UseBasicParsing -Uri $indexUrl -TimeoutSec 30
  } catch {
    throw "Could not reach nodejs.org to download portable Node.js 20. Install Node.js 20+ manually or check internet/proxy/TLS. Original error: $($_.Exception.Message)"
  }

  $pattern = "node-v20\.[0-9]+\.[0-9]+-win-$arch\.zip"
  $match = [regex]::Matches($index.Content, $pattern) | Select-Object -First 1
  if (-not $match) {
    throw "Could not find a Node.js 20 Windows $arch ZIP at $indexUrl. Install Node.js 20+ manually."
  }

  $zipName = $match.Value
  $zipUrl = "$indexUrl$zipName"
  $zipPath = Join-Path $cacheDir $zipName

  if (-not (Test-Path $zipPath -PathType Leaf)) {
    Write-NodeStep "Downloading $zipName"
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $zipUrl -OutFile $zipPath -TimeoutSec 300
    } catch {
      throw "Node.js download failed from $zipUrl. Original error: $($_.Exception.Message)"
    }
  } else {
    Write-NodeStep "Using cached $zipName"
  }

  if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

  Write-NodeStep "Extracting portable Node.js"
  Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

  $folder = Get-ChildItem $extractDir -Directory | Where-Object { $_.Name -like "node-v20*-win-$arch" } | Select-Object -First 1
  if (-not $folder) { throw "Downloaded Node.js archive did not contain expected node-v20*-win-$arch folder." }

  if (Test-Path $nodeParent) { Remove-Item $nodeParent -Recurse -Force }
  Move-Item -Path $folder.FullName -Destination $nodeParent
  Remove-Item $extractDir -Recurse -Force

  $nodeExe = Join-Path $nodeParent "node.exe"
  $npmCmd = Join-Path $nodeParent "npm.cmd"
  if (-not (Test-Path $nodeExe -PathType Leaf) -or -not (Test-Path $npmCmd -PathType Leaf)) {
    throw "Portable Node.js install incomplete. Missing node.exe or npm.cmd in $nodeParent."
  }

  return $nodeParent
}

function Ensure-Node20([switch]$NoDownload) {
  $Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
  $portableDir = Join-Path $Root ".dayz-aio-runtime\node20"
  $portableNode = Join-Path $portableDir "node.exe"

  $system = Get-NodeVersionFromCommand "node"
  if ($system -and $system.Major -ge 20) {
    Write-NodeStep "Using system Node.js $($system.Version) at $($system.Path)"
    return $system
  }

  $portable = Get-NodeVersionFromPath $portableNode
  if ($portable -and $portable.Major -ge 20) {
    Add-NodeToPath $portableDir
    Write-NodeStep "Using portable Node.js $($portable.Version) at $portableDir"
    return $portable
  }

  if ($NoDownload) {
    $detected = if ($system) { "Detected system Node.js $($system.Version) at $($system.Path)." } else { "No system Node.js found." }
    throw "$detected Node.js >=20 required. Run install-windows.bat to bootstrap portable Node.js 20, or install Node.js 20+ manually."
  }

  $installedDir = Install-PortableNode20 $Root
  Add-NodeToPath $installedDir
  $installed = Get-NodeVersionFromPath (Join-Path $installedDir "node.exe")
  if (-not $installed -or $installed.Major -lt 20) {
    throw "Portable Node.js bootstrap failed. Install Node.js 20+ manually."
  }

  Write-NodeStep "Portable Node.js $($installed.Version) ready at $installedDir"
  return $installed
}
