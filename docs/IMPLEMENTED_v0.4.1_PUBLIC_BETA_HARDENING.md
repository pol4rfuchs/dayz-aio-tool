# DayZ AIO v0.4.1 Public Beta Hardening

This release hardens the v0.4.0 public beta candidate based on external review feedback and the real SteamCMD/update field failures seen during DayZ Badlands testing.

## Implemented

### Unified SteamCMD execution queue

- Added a shared SteamCMD execution module: `apps/backend/src/modules/updates/steamcmd.ts`.
- Server updater, Mod updater and legacy Workshop installer now run SteamCMD through the same serialized queue.
- The queue exposes state through `GET /api/updates/steamcmd-queue`.
- SteamCMD commands are redacted before being exposed in job metadata.
- This prevents parallel SteamCMD invocations on Windows, where SteamCMD can fail or block behind its single-instance/content lock.

### SteamCMD parser hardening

- Added deterministic parser tests for:
  - `No subscription`
  - `Timed out waiting for update to start`
  - `Access Denied`
- Success text is no longer considered authoritative when hard failure patterns appear.

### Job-history cleanup hardening

- Update and Workshop job history cleanup no longer deletes `running` jobs.
- Old completed/failed jobs are removed first.

### Launch-profile parser guardrails

- `collectStrings()` is now exported for tests.
- Added recursion depth limit.
- Added cycle protection using `WeakSet`.
- Added tests for launch-string extraction, cyclic objects and excessive nesting.

### Windows service hardening

- The old direct `cmd.exe /c start-production-windows.bat` service registration was removed.
- The service installer now requires NSSM and refuses unsafe service registration if NSSM is missing.
- Added `scripts/windows/service-runner.ps1` for a service-aware backend/frontend runner.
- NSSM service settings include stop timeouts and log rotation.

### Version fallback fix

- `env.ts` now returns `unknown-dev` when package version detection fails instead of reporting a stale historical version.

## Notes

- RCON keeps its own command queue. It is not a SteamCMD consumer and does not need to share the SteamCMD lock.
- `updates/routes.ts` still contains route orchestration, but SteamCMD execution has been extracted and can now be further split into `verification.ts` in the next maintenance pass.

## Target status

v0.4.1 is the recommended hardening build before a wider public beta test.
