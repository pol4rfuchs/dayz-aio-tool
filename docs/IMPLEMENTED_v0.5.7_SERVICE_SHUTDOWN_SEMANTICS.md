# Implemented v0.5.7 — Service Shutdown Semantics

This release changes the Windows service runtime from a PowerShell child-process wrapper to a Node.js service supervisor started directly by NSSM.

## What changed

- `install-service-windows.bat` still uses `run-logged.ps1` for install logging.
- `install-service.ps1` still bootstraps NSSM automatically via `Ensure-Nssm`.
- The installed NSSM service now points directly at the selected portable Node.js 20 runtime.
- NSSM AppParameters now execute `scripts/windows/service-main.mjs`.
- `service-main.mjs` starts backend and frontend preview, writes service logs, and forwards shutdown to child processes with `SIGTERM`.
- The backend process is started directly as `node apps/backend/dist/server.js`, so its `SIGTERM` handler can flush logs and close the database.
- If a child process does not exit after the grace window, the supervisor uses a final process-tree kill as a fallback.

## Why

The old `service-runner.ps1` launched pnpm child processes in hidden windows and then used `CloseMainWindow()` before `Stop-Process -Force`. Hidden console processes do not have a GUI main window, so `CloseMainWindow()` was effectively a no-op and service stop normally fell through to hard termination. That skipped graceful shutdown hooks in `server.ts`.

## Scope

This release fixes the Windows service stop path. It does not change foreground starts (`start-windows.bat`) or the UI Server Control DayZ process handling.
