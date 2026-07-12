# Windows NSSM Bootstrap

DayZ AIO uses NSSM to register the Windows service. The service installer now
bootstraps NSSM automatically when it is missing.

## Command

```powershell
.\install-service-windows.bat
```

## What happens

If `nssm.exe` already exists, it is reused. If it is missing, the installer
attempts to download the official release ZIP and extracts the 64-bit binary to:

```text
tools\nssm\win64\nssm.exe
```

The downloaded ZIP is cached in:

```text
.dayz-aio-runtime\nssm-cache
```

## Offline/manual fallback

For offline systems, place `nssm.exe` manually at:

```text
tools\nssm\win64\nssm.exe
```

Then rerun:

```powershell
.\install-service-windows.bat
```

## Environment overrides

```powershell
$env:DAYZ_AIO_NSSM_VERSION="2.24"
$env:DAYZ_AIO_NSSM_URL="https://nssm.cc/release/nssm-2.24.zip"
```

## Scope

This bootstrap only makes the service installer self-contained. The remaining
service shutdown semantics task is separate: the service still needs a later
change so NSSM points directly to the Node process and graceful shutdown hooks
are reached reliably.
