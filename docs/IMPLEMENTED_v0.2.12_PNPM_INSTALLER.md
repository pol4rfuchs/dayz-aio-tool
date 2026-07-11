# v0.2.12 - pnpm Installer Bypass

## Why

On the Windows test host, portable Node.js 20 worked, but npm 10.8.2 failed with:

```text
npm error Exit handler never called!
```

This happened even without workspaces, so the installer now bypasses npm for dependency installation and runtime scripts.

## Changes

- Enables Corepack automatically.
- Activates `pnpm@9.15.9`.
- Uses `pnpm install` with a local store under `.dayz-aio-runtime/pnpm-store`.
- Updates Windows dev/start/build scripts to use pnpm.
- Adds `pnpm-workspace.yaml`.
- Keeps portable Node.js 20 bootstrap.

## User flow

```text
install-windows.bat
start-windows.bat
```
