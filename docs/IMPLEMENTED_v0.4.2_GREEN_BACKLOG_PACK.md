# DayZ AIO v0.4.2 — Green Backlog Pack

Scope: small green backlog items after v0.4.1 Public Beta Hardening.

## Implemented

### Community / Ops

- Added `Community Ops` sidebar page.
- Added `DZSALModServer` detection endpoint:
  - `GET /api/servers/:serverId/community/dzsa-check`
  - scans server root for `DZSALModServer.exe`, `DZSALModServer_x64.exe`, `DZSALModServer`, `@DZSALModServer`, `DZSA_Launcher_Server`, and DZSA-like names.
- Added server readiness warning/pass item `dzsa.launcher`.
- Added `messages.xml` generator:
  - `POST /api/servers/:serverId/community/messages`
  - preview mode and save mode.
  - save uses backup-before-write via `writeTextFileWithBackup`.

### Content Tools

- Added `Content Tools` sidebar page.
- Added Day/Night cycle calculator:
  - `POST /api/tools/day-night/calculate`
  - calculates `serverTimeAcceleration`, `serverNightTimeAcceleration`, and ready-to-copy config values.
- Added Classname Finder:
  - `GET /api/servers/:serverId/economy/classnames?query=...&limit=...`
  - reads classnames from `types.xml` and `cfgspawnabletypes.xml`.

### Diagnostics / Steam Checks

- Added optional Steam ban check endpoint:
  - `POST /api/tools/steam/ban-check`
  - requires `STEAM_WEB_API_KEY` or `DAYZ_AIO_STEAM_WEB_API_KEY`.
  - returns a disabled/not-configured response when no key is set.

### Analytics / Season Support

- Added `Wipe Management` sidebar page.
- Added wipe-cycle tracking table `wipe_cycles`.
- Added safe wipe plan endpoint:
  - `GET /api/servers/:serverId/wipe/plan`
- Added safe wipe execute endpoint:
  - `POST /api/servers/:serverId/wipe/execute`
  - requires confirm token `WIPE_STORAGE`.
  - refuses while server is running.
  - renames active `storage_N` to `storage_N_WIPE_<timestamp>` instead of deleting it.

## Notes

- VAC/Steam-ban lookup is intentionally optional and disabled without an API key.
- Messages generator writes `db/messages.xml`; validate with a test server before production use.
- Wipe management does not delete storage. It archives active persistence so rollback remains possible.

## Validation

- Backend tests: 22/22 pass.
- Backend TypeScript build: pass.
- Frontend TypeScript/Vite build: pass.
- Shared package build: pass.
