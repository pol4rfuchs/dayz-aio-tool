# v0.2.11 - Windows npm Workspace Fallback

Hardens the Windows installer against npm workspace failures seen with portable Node.js 20 / npm 10.8.x on some Windows hosts.

## Changes
- Removed `npm cache verify` from the installer hot path.
- Added dependency verification after install.
- Added fallback to isolated per-package installs: root, shared, backend, frontend.
- Added isolated package build fallback.
- `start-windows.bat` can start backend/frontend directly from package folders if root workspace startup is unavailable.

## Fixes
Fixes installs where `npm install` does not create `node_modules`, causing `tsc` to be unavailable during build.
