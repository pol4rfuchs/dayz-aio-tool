# API Overview

## Authentication

All `/api/*` endpoints and `/ws` require an API key unless `DAYZ_AIO_AUTH_DISABLED=true` is set.

```http
X-API-Key: <DAYZ_AIO_API_KEY>
Authorization: Bearer <DAYZ_AIO_API_KEY>
```

Public endpoints:

```http
GET /health
GET /api/auth/status
OPTIONS *
```

Browser WebSocket clients use:

```text
/ws?apiKey=<DAYZ_AIO_API_KEY>
```

## Core

```http
GET /health
GET /api/auth/status
GET /api/system/health
GET /api/realtime/events
WS  /ws?apiKey=<key>
```

## Servers

```http
GET    /api/servers
GET    /api/servers/status
POST   /api/servers/detect
POST   /api/servers
GET    /api/servers/:id
PATCH  /api/servers/:id
DELETE /api/servers/:id
GET    /api/servers/:id/start/preflight
POST   /api/servers/:id/start
POST   /api/servers/:id/stop
POST   /api/servers/:id/restart
GET    /api/servers/:id/status
GET    /api/servers/:id/logs
```

## Config

```http
GET  /api/servers/:serverId/config/serverdz
POST /api/servers/:serverId/config/serverdz/validate
POST /api/servers/:serverId/config/serverdz/diff
PUT  /api/servers/:serverId/config/serverdz
```

## Economy

```http
GET  /api/servers/:serverId/economy/files
GET  /api/servers/:serverId/economy/:file
GET  /api/servers/:serverId/economy/types
POST /api/servers/:serverId/economy/:file/validate
POST /api/servers/:serverId/economy/:file/diff
PUT  /api/servers/:serverId/economy/:file
PUT  /api/servers/:serverId/economy/types/items
```

## Backups

```http
GET    /api/servers/:serverId/backups
POST   /api/servers/:serverId/backups
GET    /api/servers/:serverId/backups/:backupId
POST   /api/servers/:serverId/backups/:backupId/restore
DELETE /api/servers/:serverId/backups/:backupId
```

## Mods / Workshop

```http
GET  /api/servers/:serverId/mods
POST /api/servers/:serverId/mods/scan
PUT  /api/servers/:serverId/mods/load-order
GET  /api/servers/:serverId/mods/start-params
POST /api/servers/:serverId/workshop/install
```

## Automation / Notifications / Audit

```http
GET    /api/audit
GET    /api/schedules
POST   /api/schedules
POST   /api/schedules/:id/run
DELETE /api/schedules/:id
GET    /api/notifications
POST   /api/notifications
POST   /api/notifications/:id/test
POST   /api/notifications/test-all
DELETE /api/notifications/:id
```

Scheduler failures update `failure_count` and `last_error`, write audit events, broadcast realtime events and notify all enabled notification targets.

## Admin / Tests / Advanced

```http
POST /api/servers/:serverId/rcon/test
POST /api/servers/:serverId/rcon/command
GET  /api/servers/:serverId/analytics/summary
POST /api/servers/:serverId/tests/safety
POST /api/servers/:serverId/tests/start-stop
GET  /api/servers/:serverId/tests
GET  /api/servers/:serverId/dynamic-economy/plan
GET  /api/servers/:serverId/map-tools
POST /api/servers/:serverId/ai/analyze
```

## Doctor / Runtime Diagnostics

```http
GET /api/system/doctor
GET /api/servers/:serverId/doctor
```

## Readiness / Preflight

```http
GET /api/system/readiness
GET /api/servers/:serverId/readiness
GET /api/servers/:id/start/preflight
```

`POST /api/servers/:id/start` blocks when start-preflight has hard failures.


## WebSocket auth note

Browser WebSocket clients authenticate with `/ws?apiKey=<DAYZ_AIO_API_KEY>`. Do not expose raw reverse-proxy access logs because the URL query string can contain the key.

## v0.2.6 Additions

```http
GET  /api/servers/:serverId/crash/scan
GET  /api/servers/:serverId/crash/file?path=<absolute-path>
GET  /api/servers/:serverId/rcon/players
POST /api/servers/:serverId/rcon/broadcast
POST /api/servers/:serverId/rcon/kick
POST /api/servers/:serverId/rcon/ban
POST /api/servers/:serverId/workshop/update-enabled
PUT  /api/servers/:serverId/economy/events/items
PUT  /api/servers/:serverId/economy/globals/items
POST /api/servers/:serverId/dynamic-economy/preview
POST /api/servers/:serverId/dynamic-economy/apply
GET  /api/servers/:serverId/map-tools
POST /api/servers/:serverId/ai/analyze
```

RCON command execution is disabled unless `DAYZ_AIO_BATTLEYE_RCON_ENABLED=true` is configured. Dynamic Economy apply requires `confirm=APPLY_DYNAMIC_ECONOMY_TO_TEST_COPY`.


## Debug / Support

```http
GET /api/debug/status
GET /api/debug/bundle
```

`/api/debug/bundle` returns an `application/zip` file containing masked logs, Doctor snapshots, Readiness snapshots and selected project metadata. It requires `X-API-Key` like other protected endpoints.


## v0.2.9 Additions

### Workshop Jobs

```http
GET /api/workshop/jobs
GET /api/workshop/jobs/:jobId
```

Workshop install and update requests are now queued background jobs. The install/update endpoints return `202 Accepted` with `jobId`. Progress is emitted through WebSocket `workshop.job.updated` events.

### Limits

Economy XML APIs enforce `DAYZ_AIO_ECONOMY_XML_MAX_BYTES`. General request body size is controlled by `DAYZ_AIO_REQUEST_BODY_LIMIT_BYTES`.

## v0.2.16 Polish Notes

- Debug bundle manifest reports package version from root `package.json` and runtime version separately.
- `/favicon.ico` returns `204` and is public to avoid unnecessary auth noise.
- Backup UI should treat stale server IDs / missing backup records as empty state instead of hard error.

## Launch Profile Import

```http
POST /api/servers/launch-profile/detect
```

Body:

```json
{
  "rootPath": "C:\\Server\\dAYz\\DayZServer",
  "profilePath": "C:\\Server\\dAYz\\DayZServer\\profiles",
  "launchParams": ""
}
```

Returns detected old manager/start-script launch params, mod-folder diagnostics and warnings.

```http
POST /api/servers/:id/launch-profile/import
```

Re-runs detection for an already saved server and stores the recommended `launchParams`.

## v0.2.21 Server Control

```http
GET /api/servers/:id/control
```

Returns the selected server, runtime state, configured DayZ game port, local socket-table port check and generated launch command preview for the new `Server Control` page.

Runtime actions remain:

```http
POST /api/servers/:id/start
POST /api/servers/:id/stop
POST /api/servers/:id/restart
GET  /api/servers/:id/start/preflight
GET  /api/servers/:id/logs?limit=180
```
