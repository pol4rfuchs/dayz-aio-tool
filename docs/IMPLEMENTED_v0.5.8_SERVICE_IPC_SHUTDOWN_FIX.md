# Implemented v0.5.8 — Service IPC Shutdown Fix

This release fixes the v0.5.7 service supervisor regressions found during behavioral review.

## Fixed

- `scripts/windows/service-main.mjs` now resolves Vite from `apps/frontend/node_modules/vite/bin/vite.js` first, with root fallback.
- Frontend preview now starts with `cwd = apps/frontend`, so `vite preview` finds `apps/frontend/dist`.
- Backend child process is spawned with an IPC channel.
- Service supervisor sends `{ type: "dayz-aio.shutdown" }` over IPC before falling back to OS signals / forced process-tree termination.
- Backend `server.ts` listens for the IPC shutdown message and reuses the same graceful shutdown path as SIGINT/SIGTERM.

## Why

On Windows, POSIX-like signals are not reliably delivered to child processes as catchable events. IPC gives the service supervisor a Windows-safe graceful shutdown path before fallback termination.

## Expected service process tree

```text
NSSM → node.exe scripts/windows/service-main.mjs
      ├─ node.exe apps/backend/dist/server.js   (IPC graceful shutdown)
      └─ node.exe apps/frontend/node_modules/vite/bin/vite.js preview
```

## Real-test validation target

After `Stop-Service DayZAIO`, `logs/backend-service.out.log` should contain the backend shutdown log line:

```text
DayZ AIO backend shutting down
```

and `logs/service-stdout.log` should show:

```text
Sending IPC shutdown to backend
Shutdown complete.
```
