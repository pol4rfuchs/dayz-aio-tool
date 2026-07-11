# DayZ AIO Windows Node bootstrapper
# v0.4.5: all Windows scripts must use Node.js 20.x exactly.
# Node 22/24 are intentionally rejected because native modules such as better-sqlite3
# are installed for the Node-20 ABI in the portable runtime.

param()

$script:RequiredNodeMajor = 20
$script:DefaultNodeVersion = if ($env:DAYZ_AIO_NODE20_VERSION) { $env:DAYZ_AIO_NODE20_VERSION } else { "20.20.2" }

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

function Install-PortableNode20([string]$Root, [string]$Version = $script:DefaultNodeVersion) {
  $arch = Get-NodeWinArch
  $runtimeRoot = Join-Path $Root ".dayz-aio-runtime"
  $cacheDir = Join-Path $runtimeRoot "cache"
  $nodeParent = Join-Path $runtimeRoot "node20"
  $extractDir = Join-Path $runtimeRoot "extract-node20"

  New-Item -ItemType Directory -Force -Path $runtimeRoot, $cacheDir | Out-Null

  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  } catch {}

  $zipName = "node-v$Version-win-$arch.zip"
  $zipUrl = "https://nodejs.org/dist/v$Version/$zipName"
  $zipPath = Join-Path $cacheDir $zipName

  Write-NodeStep "Bootstrapping portable Node.js $Version ($arch)."

  if (-not (Test-Path $zipPath -PathType Leaf)) {
    Write-NodeStep "Downloading $zipName"
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $zipUrl -OutFile $zipPath -TimeoutSec 300
    } catch {
      throw "Node.js download failed from $zipUrl. Install Node.js 20.x manually or check internet/proxy/TLS. Original error: $($_.Exception.Message)"
    }
  } else {
    Write-NodeStep "Using cached $zipName"
  }

  if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

  Write-NodeStep "Extracting portable Node.js"
  Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

  $folder = Get-ChildItem $extractDir -Directory | Where-Object { $_.Name -eq "node-v$Version-win-$arch" } | Select-Object -First 1
  if (-not $folder) { throw "Downloaded Node.js archive did not contain expected node-v$Version-win-$arch folder." }

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

function Assert-Node20Major($Info, [string]$SourceLabel) {
  if (-not $Info) { return $false }
  if ($Info.Major -eq $script:RequiredNodeMajor) { return $true }
  Write-NodeStep "$SourceLabel Node.js $($Info.Version) at $($Info.Path) is not supported. DayZ AIO requires Node.js 20.x exactly."
  return $false
}

function Ensure-Node20([switch]$NoDownload) {
  $Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
  $portableDir = Join-Path $Root ".dayz-aio-runtime\node20"
  $portableNode = Join-Path $portableDir "node.exe"

  $portable = Get-NodeVersionFromPath $portableNode
  if (Assert-Node20Major $portable "Portable") {
    Add-NodeToPath $portableDir
    Write-NodeStep "Using portable Node.js $($portable.Version) at $portableDir"
    return $portable
  }

  $system = Get-NodeVersionFromCommand "node"
  if (Assert-Node20Major $system "System") {
    Write-NodeStep "Using system Node.js $($system.Version) at $($system.Path)"
    return $system
  }

  if ($NoDownload) {
    $detected = if ($system) { "Detected system Node.js $($system.Version) at $($system.Path)." } else { "No system Node.js found." }
    throw "$detected DayZ AIO requires Node.js 20.x exactly. Run install-windows.bat to bootstrap portable Node.js $script:DefaultNodeVersion."
  }

  $installedDir = Install-PortableNode20 $Root $script:DefaultNodeVersion
  Add-NodeToPath $installedDir
  $installed = Get-NodeVersionFromPath (Join-Path $installedDir "node.exe")
  if (-not $installed -or $installed.Major -ne $script:RequiredNodeMajor) {
    throw "Portable Node.js bootstrap failed. Expected Node.js 20.x, got $($installed.Version)."
  }

  Write-NodeStep "Portable Node.js $($installed.Version) ready at $installedDir"
  return $installed
}
