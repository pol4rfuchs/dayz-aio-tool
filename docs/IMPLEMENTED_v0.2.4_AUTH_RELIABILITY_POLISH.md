# DayZ AIO v0.2.4 — Auth + Reliability Polish

## Purpose

v0.2.4 is a small hardening release after the v0.2.3 security review. It does not add large user-facing features. It closes the remaining low-risk polish items around auth, rate-limit lifecycle, developer error messages and documentation.

## Changes

```text
- Added periodic cleanup for in-memory rate-limit buckets.
- Added configurable bucket TTL and cleanup interval.
- Cleared rate-limit buckets during Fastify shutdown.
- Made auth runtime config test-friendly by reading current env values where appropriate.
- Added explicit warning comment for WebSocket query-token mode.
- Improved missing-secret startup errors with the local-dev escape hatch hint.
- Documented WebSocket query-token logging risk for reverse proxies.
- Documented localStorage API-key scope and future session-token direction.
- Added auth middleware tests:
  - public routes remain public
  - missing key returns 401
  - invalid key returns 401
  - X-API-Key works
  - Bearer token works
  - rate limit returns 429
  - auth failure throttle returns 429
```

## New environment variables

```env
DAYZ_AIO_RATE_LIMIT_BUCKET_TTL_MS=600000
DAYZ_AIO_RATE_LIMIT_CLEANUP_INTERVAL_MS=300000
```

Defaults:

```text
TTL:              10 minutes
Cleanup interval: 5 minutes
```

## Notes

WebSocket authentication still supports `?apiKey=...` because browser WebSocket handshakes cannot set custom headers. This is acceptable for localhost/trusted LAN, but raw proxy access logs must not be exposed because URLs may contain the key.
