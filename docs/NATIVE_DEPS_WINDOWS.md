# Windows Native Dependencies / Node.js Runtime

DayZ AIO uses native Node modules, especially `better-sqlite3`.
On Windows these bindings are sensitive to the Node.js ABI.

## Required runtime

- Supported: Node.js 20.x
- Rejected intentionally: Node.js 22.x / 24.x
- Portable default: `.dayz-aio-runtime\node20`
- Portable version: Node.js 20.20.2 unless `DAYZ_AIO_NODE20_VERSION` overrides it
- pnpm store: `.dayz-aio-runtime\pnpm-store`

## Why Node 22/24 are rejected

GitHub `windows-latest` and many developer machines may have newer system Node versions.
Those versions can make `better-sqlite3` fall back to node-gyp compilation and fail without
Visual Studio C++ Build Tools, or create ABI mismatches against a Node-20 install.

All Windows entrypoints now share the same Node selector:

- `install-windows.bat`
- `build-windows.bat`
- `start-windows.bat`
- `doctor-windows.bat`
- `smoke-test-windows.bat`

They use `scripts/windows/ensure-node.ps1`, which requires Node major `20` exactly.

## Logs

Installer step logs use the standard latest-log convention:

- `logs/scripts/install-windows-latest.log`
- `logs/scripts/pnpm-install-latest.log`
- `logs/scripts/pnpm-build-latest.log`

Timestamped copies are kept beside them.
