# DayZ AIO Security Model

## Status in v0.2.4

v0.2.4 keeps the v0.2.3 security baseline and adds cleanup/tests around auth and rate limiting. It is still not a public internet product, but it is no longer an unauthenticated LAN tool.

## Backend authentication

All `/api/*` endpoints and `/ws` require an API key unless explicitly disabled for local development.

Supported auth methods:

```http
X-API-Key: <DAYZ_AIO_API_KEY>
Authorization: Bearer <DAYZ_AIO_API_KEY>
```

Browser WebSocket connections use:

```text
/ws?apiKey=<DAYZ_AIO_API_KEY>
```

Important: browser WebSocket clients cannot send custom headers during the handshake. If you put DayZ AIO behind a reverse proxy, do not publish raw access logs because query strings can contain the API key. Prefer localhost/VPN/trusted LAN for this development phase.

Public endpoints:

```http
GET /health
GET /api/auth/status
OPTIONS *
```

## Required environment

`install-windows.bat` generates `apps/backend/.env` automatically:

```env
DAYZ_AIO_API_KEY=<random>
DAYZ_AIO_SECRET_KEY=<random>
DAYZ_AIO_CORS_ORIGINS=http://localhost:3100,http://127.0.0.1:3100,http://localhost:4173,http://127.0.0.1:4173
DAYZ_AIO_AUTH_DISABLED=false
DAYZ_AIO_RATE_LIMIT_BUCKET_TTL_MS=600000
DAYZ_AIO_RATE_LIMIT_CLEANUP_INTERVAL_MS=300000
```

Do not commit or publish `apps/backend/.env`.

## CORS

CORS is allowlist-based. `origin: true` was removed. Add origins explicitly with:

```env
DAYZ_AIO_CORS_ORIGINS=http://localhost:3100,http://192.168.178.80:3000
```

Do not use `*` for production or LAN sharing.

## Stored secrets

New RCON passwords are encrypted at rest with AES-256-GCM using `DAYZ_AIO_SECRET_KEY`.
Existing plaintext RCON passwords are migrated to encrypted values during DB init.
API responses only return masked values.

## Rate limiting

A simple in-memory rate limit is enabled:

```env
DAYZ_AIO_RATE_LIMIT_PER_MINUTE=300
DAYZ_AIO_AUTH_FAILURE_LIMIT_PER_MINUTE=20
```

Buckets are in-memory and are cleaned periodically to avoid unbounded growth:

```env
DAYZ_AIO_RATE_LIMIT_BUCKET_TTL_MS=600000
DAYZ_AIO_RATE_LIMIT_CLEANUP_INTERVAL_MS=300000
```

This is a safety net, not a replacement for a reverse proxy firewall.

## Frontend key storage

The browser UI stores the API key in `localStorage`. This is acceptable for localhost/trusted-LAN MVP usage. For a future multi-user or internet-exposed deployment, replace this with a session/login model, short-lived tokens, user accounts and RBAC.

## CSRF stance

The backend does not use cookies for auth. State-changing calls require a custom `X-API-Key` or `Authorization` header, and CORS is restricted. That avoids the classic browser-cookie CSRF failure mode.

## Still not recommended

Do not expose this directly to the internet.

Use only:

```text
localhost
VPN
trusted LAN during testing
reverse proxy with TLS + extra auth later
```

## Hard production blockers still open

```text
- no multi-user account model yet
- no role-based permission matrix yet
- no external secret vault integration yet
- no hardened Windows Service installer yet
- RCON command execution still guarded/stubbed
- API key may appear in reverse-proxy logs when WebSocket query auth is used
```

## v0.2.6 Guardrails

Real BattlEye RCON execution is disabled by default. Enable only on a copied test server:

```env
DAYZ_AIO_BATTLEYE_RCON_ENABLED=true
```

Dynamic Economy apply is intentionally guarded by a confirmation token and backup creation. Use preview/diff first and test only on a copied server folder.


## Debug Bundle secret handling

The Debug Bundle export masks known sensitive values before placing text files into the ZIP:

```text
DAYZ_AIO_API_KEY
DAYZ_AIO_SECRET_KEY
X-API-Key
Authorization: Bearer
apiKey= query parameter
RCON password fields
serverDZ password/passwordAdmin snippets
```

The bundle intentionally excludes the SQLite database and raw DayZ server files. Still review bundles before sharing if custom reverse-proxy or third-party logs are added to `logs/`, because external tools may use non-standard secret formats.


## v0.2.9 Hardening Notes

- Crash scanner skips symlinks/junction escapes and validates walked paths against the scan root.
- WebSocket URLs and backend logs sanitize `apiKey=` tokens before file logging.
- Debug ZIP writer is intentionally non-Zip64 and fails explicitly if entry/size boundaries are exceeded. Do not reuse it for large backup exports.
- BattlEye RCON commands are serialized to avoid overlapping UDP login/command handshakes.
