# Implemented v0.4.5 — Windows Runtime Consistency Fix

This release consolidates the v0.4.3 security cleanup, the v0.4.4 native dependency installer fix, and the remaining Windows runtime consistency fixes.

## Included

- `STEAM_WEB_API_KEY` and `DAYZ_AIO_STEAM_WEB_API_KEY` debug-bundle masking from v0.4.3.
- Consolidated DZSA detection from v0.4.3.
- Native dependency installer hardening from v0.4.4.
- `scripts/windows/ensure-node.ps1` now requires Node.js major `20` exactly.
- Node 22/24 are rejected for all Windows entrypoints, not just install.
- Windows scripts share `.dayz-aio-runtime\node20` and `.dayz-aio-runtime\pnpm-store`.
- `install-windows.bat`, `build-windows.bat`, `start-windows.bat`, `doctor-windows.bat`, and `smoke-test-windows.bat` use the same runtime selector.
- Installer logs now preserve the support convention:
  - `logs/scripts/pnpm-install-latest.log`
  - `logs/scripts/pnpm-build-latest.log`
- The stale flat-path hotfix installer is not used. The canonical installer remains `scripts/windows/install.ps1` via `scripts/windows/run-logged.ps1`.

## Rationale

The v0.4.4 hotfix solved the Windows Installer Smoke Test path but left other Windows entrypoints using a weaker `major >= 20` check. That allowed Node 22/24 to pass in `build`, `start`, `doctor`, or `smoke`, which can cause native ABI mismatches for `better-sqlite3`.

v0.4.5 removes that split-brain runtime behavior.
