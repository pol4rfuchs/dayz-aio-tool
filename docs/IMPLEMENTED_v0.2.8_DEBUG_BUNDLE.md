# DayZ AIO v0.2.8 — Debug Bundle Pack

## Scope

v0.2.8 adds first-class diagnostic capture so Windows runtime failures can be reported without copying many console outputs manually.

## Implemented

- All Windows `.bat` wrappers now write logs to `logs/scripts/*.log`.
- Latest script run is copied to `logs/scripts/<name>-latest.log`.
- Dev backend output is mirrored to `logs/backend-dev.log`.
- Dev frontend output is mirrored to `logs/frontend-dev.log`.
- Production backend output is mirrored to `logs/backend-production.log`.
- Production frontend output is mirrored to `logs/frontend-production.log`.
- Backend now writes structured logs to `logs/backend.log`.
- Backend log rotates on startup when it exceeds `DAYZ_AIO_BACKEND_LOG_MAX_SIZE_BYTES`.
- Doctor API writes JSON snapshots to `logs/snapshots/*doctor*.json`.
- Readiness API writes JSON snapshots to `logs/snapshots/*readiness*.json`.
- Windows Doctor writes `windows-doctor-last.json` and `doctor-last.json`.
- New backend endpoint: `GET /api/debug/status`.
- New backend endpoint: `GET /api/debug/bundle`.
- New frontend page: `Debug Bundle`.
- Debug ZIP includes logs, snapshots, selected docs and masked config.
- Debug ZIP excludes SQLite DB and raw secrets.
- `.env`, logs and query tokens are masked before export.

## New files

```text
apps/backend/src/shared/logging.ts
apps/backend/src/modules/debug/routes.ts
apps/backend/src/modules/debug/masking.ts
apps/backend/src/modules/debug/zip.ts
apps/frontend/src/pages/DebugBundle.tsx
scripts/windows/run-logged.ps1
docs/IMPLEMENTED_v0.2.8_DEBUG_BUNDLE.md
```

## New environment values

```env
DAYZ_AIO_LOG_DIR=../../logs
DAYZ_AIO_BACKEND_LOG_MAX_SIZE_BYTES=5242880
DAYZ_AIO_BACKEND_LOG_MAX_FILES=5
```

## Export contents

```text
manifest.json
config/backend.env.masked
docs/*.md
logs/*.log
logs/scripts/*.log
logs/snapshots/*.json
project/package.json
project/apps-backend-package.json
project/apps-frontend-package.json
project/README.md
```

## Security behavior

The bundle masks:

```text
DAYZ_AIO_API_KEY
DAYZ_AIO_SECRET_KEY
X-API-Key
Authorization: Bearer
apiKey= query parameter
rconPassword / rcon_password
password / passwordAdmin in text config snippets
```

The bundle intentionally does not include:

```text
data/dayz-aio.sqlite
raw server files
raw backups
RCON plaintext secrets
API key / encryption key
```

## Usage

From the UI:

```text
Debug Bundle → Export Debug Bundle
```

Direct API:

```http
GET /api/debug/bundle
X-API-Key: <your key>
```

## Test handoff

After a failed Windows run, send only the generated `dayz-aio-debug-*.zip` unless the browser UI itself cannot start. If UI cannot start, send:

```text
logs/scripts/install-windows-latest.log
logs/scripts/start-windows-latest.log
logs/backend-dev.log
logs/frontend-dev.log
```
