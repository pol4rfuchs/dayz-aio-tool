# Implemented in v0.2.3 — Security + Reliability Hardening

## Security

```text
✅ API-Key middleware for /api/*
✅ API-Key protection for /ws WebSocket
✅ Public /api/auth/status endpoint
✅ Frontend Security page for storing/testing API key
✅ install-windows.bat generates strong local API/secret keys
✅ Restrictive CORS allowlist
✅ Basic in-memory rate limiting
✅ Auth failure throttling
✅ RCON password encryption at rest
✅ Plaintext RCON password migration on DB init
✅ API responses keep secrets masked
```

## Reliability

```text
✅ Graceful backend shutdown hooks
✅ uncaughtException/unhandledRejection shutdown path
✅ Scheduler failure notification via notification targets
✅ Scheduler failure_count + last_error persistence
✅ Diff engine bounded to avoid O(n²) memory blowups on large XML files
✅ Runtime DB reset path corrected to data/dayz-aio.sqlite
```

## Frontend

```text
✅ URL-backed routing via ?page=
✅ selectedServerId persisted via URL + localStorage
✅ Security navigation item
✅ API client sends X-API-Key automatically
✅ WebSocket URL includes API key for browser clients
```

## Tests / QA foundation

```text
✅ npm test script added
✅ backend node:test skeleton added
✅ diff tests added
✅ secret encryption tests added
✅ smoke-test script updated for authenticated APIs
```

## Still intentionally not done

```text
⚠️ Full user accounts / login sessions
⚠️ Role-based access control
⚠️ Real BattlEye RCON command execution
⚠️ Public internet hardening
⚠️ Full CI pipeline
```
