# DayZ AIO v0.2.7 — Pretest Completion Polish

## Purpose

v0.2.7 closes the remaining pre-test gaps identified after v0.2.6 review.

## Added

- Mod diagnostics endpoint: `GET /api/servers/:serverId/mods/diagnostics`
- Duplicate normalized mod folder detection
- Duplicate PBO basename detection across enabled mods
- Duplicate `.bikey` filename reporting
- Missing enabled mod folder detection
- Missing `.bikey` warning for enabled mods
- Missing Workshop ID info warning for update-managed mods
- Lightweight dependency scan from `mod.cpp` / `meta.cpp`
- Workshop preflight endpoint: `GET /api/servers/:serverId/workshop/preflight`
- UI button: Analyze conflicts
- UI panel for conflict/dependency diagnostics
- UI button: Workshop preflight
- Scheduler retry after failed scheduled action
- Scheduler escalation notification after repeated failures
- Scheduler UI now displays failure count and last error

## Scheduler env options

```env
DAYZ_AIO_SCHEDULE_MAX_RETRIES=2
DAYZ_AIO_SCHEDULE_RETRY_DELAY_MINUTES=5
DAYZ_AIO_SCHEDULE_ESCALATE_AFTER_FAILURES=3
```

## Test status

- Backend TypeScript build: passed
- Frontend TypeScript/Vite build: passed
- Backend test suite: 8/8 passed

Runtime backend start was not verified in the sandbox because `better-sqlite3` native bindings require install scripts / prebuilt binaries. Windows test through `install-windows.bat` remains required.
