# DayZ AIO v0.2.15 - Port Readiness Fix

## Fixed

- System Doctor/Readiness now checks the actual configured ports instead of stale 3000/8080 labels.
- Frontend default API fallback now points to `http://localhost:8090`.
- Backend default CORS fallback now allows `http://localhost:3100`.
- Docs/env examples updated for SABnzbd-safe defaults.

## Default ports

```text
Frontend: http://localhost:3100
Backend:  http://localhost:8090
```
