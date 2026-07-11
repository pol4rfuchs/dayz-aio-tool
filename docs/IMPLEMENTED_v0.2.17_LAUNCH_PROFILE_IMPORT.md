# DayZ AIO v0.2.17 — Launch Profile Import

## Purpose

v0.2.17 focuses on a real runtime issue found during Windows testing: an existing DayZ server can be detected correctly but still exit during load if the imported AIO server record is missing the old manager's launch parameters.

## Added

- Launch profile detector for existing DayZ installations.
- Scans the DayZ server root and its parent folder for manager/start files:
  - `server_manager.json`
  - `server-manager.json`
  - `baseserver-manager.json`
  - `dayz-server-manager*.json`
  - `dzsm*.json`
  - start/launch `.bat`, `.cmd`, `.ps1`, `.txt` scripts
- Extracts DayZ launch parameters:
  - `-config=`
  - `-profiles=`
  - `-port=`
  - `-mod=`
  - `-servermod=`
  - `-bepath=`
- Add Existing Server now shows a Launch Profile Import panel.
- The detected launch profile is automatically copied into the Launch params field.
- New API:
  - `POST /api/servers/launch-profile/detect`
  - `POST /api/servers/:id/launch-profile/import`
- Start preflight now checks for modded/Expansion launch profile mismatch.

## Start protection

AIO now blocks Start when Expansion indicators are detected but `-mod=` is missing. This prevents a common failure mode where the server starts, loads part of the mission, then exits because the mod list is incomplete.

## Warnings

AIO warns when:

- `@mod` folders exist but `-mod=` is missing.
- Expansion profile/mod folders exist but `-servermod=` is missing.
- `battleye` folder exists but `-bepath=` is missing.
- No old manager/start script launch profile could be found.

## Notes

This importer is intentionally conservative. It does not invent a full mod load order from folder names if an old manager profile exists. Prefer old manager/start script launch params as source of truth.
