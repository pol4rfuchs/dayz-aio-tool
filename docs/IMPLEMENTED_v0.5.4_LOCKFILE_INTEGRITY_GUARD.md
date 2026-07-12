# DayZ AIO v0.5.4 — Lockfile Integrity Guard

## Purpose

Fixes the v0.5.3 release export where one `pnpm-lock.yaml` dependency resolution was corrupted by the project version bump:

```yaml
lucide-react:
  specifier: ^0.475.0
  version: 0.5.3-maintenance-verification-coverage
```

The correct lockfile resolution is restored:

```yaml
lucide-react:
  specifier: ^0.475.0
  version: 0.475.0(react@19.2.7)
```

## Changes

- Restored the correct `lucide-react` resolution in `pnpm-lock.yaml`.
- Added `scripts/ci/check-pnpm-lockfile.mjs`.
- Added `pnpm run check:lockfile`.
- CI now validates lockfile integrity before dependency installation.
- Native module check validates lockfile integrity before native rebuild tests.
- Release workflow validates lockfile integrity before publishing.
- Guard fails if the root project version appears as a dependency `version:` entry in `pnpm-lock.yaml`.

## Why

The release/version bump process must only update project package metadata, not resolved dependency versions inside the pnpm lockfile. A corrupted lockfile breaks `pnpm install --frozen-lockfile` before build and tests can run.
