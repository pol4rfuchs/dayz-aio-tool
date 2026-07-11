# DayZ AIO v0.2.9 - Reliability + Test Pack

## Purpose

v0.2.9 closes the highest-priority review findings from v0.2.8 before the first serious Windows runtime test.

## Implemented

- Shared `crc32` utility extracted from ZIP writer and BattlEye RCON.
- Debug ZIP writer now fails explicitly above non-Zip64 limits instead of silently overflowing entry counts.
- Crash scanner now skips symlinks/junction-style escapes and validates every walked path against the scan root.
- BattlEye RCON commands are serialized through a queue to avoid overlapping login/command handshakes.
- Scheduler tick loop is now non-overlapping and failure-count increment is atomic via SQLite `RETURNING`.
- Economy XML size guard added through `DAYZ_AIO_ECONOMY_XML_MAX_BYTES`.
- Fastify body limit is now explicit through `DAYZ_AIO_REQUEST_BODY_LIMIT_BYTES`.
- Steam Workshop install/update now runs as background jobs with progress via WebSocket events.
- SteamCMD execution has a timeout through `DAYZ_AIO_WORKSHOP_STEAMCMD_TIMEOUT_MS`.
- Backend file logging no longer uses synchronous append per request; logs are buffered and flushed.
- Backend request URLs are sanitized for `apiKey=` before writing logs.
- Added test coverage for CRC32/ZIP boundaries, economy parser round-trips, and crash scanner symlink behavior.

## New API

```http
GET /api/workshop/jobs
GET /api/workshop/jobs/:jobId
```

`POST /api/servers/:serverId/workshop/install` and `POST /api/servers/:serverId/workshop/update-enabled` now return `202 Accepted` with a `jobId` instead of blocking until SteamCMD finishes.

## New ENV

```env
DAYZ_AIO_REQUEST_BODY_LIMIT_BYTES=10485760
DAYZ_AIO_ECONOMY_XML_MAX_BYTES=8388608
DAYZ_AIO_WORKSHOP_STEAMCMD_TIMEOUT_MS=900000
DAYZ_AIO_WORKSHOP_JOB_HISTORY_LIMIT=50
```

## Still requires Windows runtime validation

The code-level fixes are in place, but SteamCMD, DayZServer process handling, and `better-sqlite3` native runtime still need to be validated on the target Windows/VMware system.
