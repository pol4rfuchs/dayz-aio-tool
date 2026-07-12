# v0.5.1 Windows Smoke Offline Fix

## Problem

The Windows Installer Smoke Test called `smoke-test-windows.bat` immediately after `install-windows.bat` and `doctor-windows.bat`, but no backend process is started by that workflow. The smoke script then attempted API calls against the backend and could fail before the installer result was evaluated cleanly.

The failure seen in CI was:

```text
Invoke-RestMethod : Invalid URI: The hostname could not be parsed.
```

## Fix

- Added `-Offline` mode to `scripts/windows/smoke-test.ps1`.
- The Windows Installer Smoke workflow now runs `smoke-test-windows.bat -Offline`.
- Offline mode validates installer/build artifacts without requiring a running backend:
  - `package.json`
  - `node_modules`
  - `apps/backend/.env`
  - `apps/backend/dist/server.js`
  - `apps/frontend/dist/index.html`
  - strong API key presence
- API mode remains available for local use when the backend is already running.
- API base handling now validates and normalizes the URL through `[System.Uri]`, avoiding malformed `$Api/health` calls.

## Why this is correct

The Windows Installer Smoke Test is an installer/runtime bootstrap check. It should prove that install, dependency resolution, native module install, build output, env generation, doctor, and portable Node selection work on a clean Windows runner. It should not require an API server unless the workflow explicitly starts one.
