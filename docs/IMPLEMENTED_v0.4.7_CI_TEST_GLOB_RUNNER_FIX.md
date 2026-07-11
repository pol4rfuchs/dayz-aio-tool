# Implemented v0.4.7 — CI Test Glob Runner Fix

## Problem

GitHub Actions failed in the backend test step with:

```text
Could not find '/home/runner/work/dayz-aio-tool/dayz-aio-tool/apps/backend/test/**/*.test.ts'
```

The backend package used this script:

```json
"test": "tsx --test test/**/*.test.ts"
```

On the Linux runner, the `**` glob was not expanded the way the command expected. `tsx` received the literal path and failed before running the actual test files.

## Fix

- Replaced the fragile shell glob with a portable Node-based test runner:
  - `apps/backend/scripts/run-tests.mjs`
- Updated backend test script:
  - `"test": "node scripts/run-tests.mjs"`
- The runner recursively discovers:
  - `apps/backend/test/**/*.test.ts`
- It launches the Node test runner through `tsx` using explicit file paths.
- If no tests exist in a stripped package, the runner exits cleanly with a clear skip message instead of crashing on a literal glob.

## Why this matters

CI should fail only when tests fail, not because Bash/PowerShell/CMD expand globs differently. This also keeps the same package script usable on Windows and GitHub Linux runners.

## Included from previous patches

- v0.4.3 Green Security + DZSA Cleanup
- v0.4.4 Native-Deps Installer Fix
- v0.4.5 Windows Runtime Consistency Fix
- v0.4.6 CI Node20 Lockfile Actions Fix
