# Implemented v0.5.6 — NSSM Bootstrap Service Installer

## Problem

The Windows service test flow still required a manual NSSM preparation step:

```text
tools\nssm\win64\nssm.exe
```

That made real testing unnecessarily fragile. A user running
`install-service-windows.bat` without NSSM received a clear error, but the
installer could not self-heal.

## Fix

v0.5.6 adds a Windows NSSM bootstrapper:

```text
scripts/windows/ensure-nssm.ps1
```

`install-service-windows.bat` now runs through the normal `run-logged.ps1`
wrapper and `scripts/windows/install-service.ps1` calls `Ensure-Nssm` before
registering the Windows service.

## Behavior

The installer now resolves NSSM in this order:

1. `tools\nssm\win64\nssm.exe`
2. `tools\nssm\nssm.exe`
3. `nssm.exe` from `PATH`
4. Automatic download of `nssm-2.24.zip`
5. Extraction of `win64\nssm.exe` into `tools\nssm\win64\nssm.exe`

Downloaded ZIPs are cached under:

```text
.dayz-aio-runtime\nssm-cache
```

The final executable is stored in the project tree:

```text
tools\nssm\win64\nssm.exe
```

## Configuration

Optional environment overrides:

```text
DAYZ_AIO_NSSM_VERSION=2.24
DAYZ_AIO_NSSM_URL=https://nssm.cc/release/nssm-2.24.zip
```

## Notes

- NSSM is not bundled in the repository.
- The installer downloads it only when no usable local `nssm.exe` is found.
- Foreground mode via `start-windows.bat` still does not require NSSM.
- This does not yet fix the known service shutdown semantics issue; it only
  removes the manual NSSM preparation step for real service testing.
