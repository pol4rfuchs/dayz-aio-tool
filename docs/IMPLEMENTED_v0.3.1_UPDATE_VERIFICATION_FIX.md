# Implemented v0.3.1 — Update Verification Fix

## Purpose

The server update job no longer trusts SteamCMD exit code or appmanifest state alone.
A DayZ Dedicated Server update is only marked successful when the real `DayZServer_x64.exe`
inside the configured server root is verified after the update.

## Added

- Captures `DayZServer_x64.exe` snapshot before update:
  - path
  - exists
  - size
  - mtime / LastWriteTime
  - FileVersion
  - ProductVersion
- Captures the same snapshot after update.
- Reads `steamapps/appmanifest_223350.acf` before and after update:
  - StateFlags
  - installdir
  - LastUpdated
  - buildid
- Stores verification details in the update job result.
- Marks the job as failed if:
  - SteamCMD exits non-zero
  - `DayZServer_x64.exe` is missing after update
  - `DayZServer_x64.exe` is unchanged after update

## Why

A real test showed SteamCMD/appmanifest reporting a completed update while
`DayZServer_x64.exe` stayed on `1.29.0.162510` with an old LastWriteTime.
The UI must not report such a job as completed.

## Result

The update job now fails with a reason such as:

- `steamcmd_exit_nonzero`
- `dayz_server_exe_missing_after_update`
- `dayz_server_exe_unchanged_after_update`
- `dayz_server_exe_changed`
