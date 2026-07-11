# Implemented v0.4.8 — CI Windows Node Path Fix

## Problem

The Windows Installer Smoke Test ran `install-windows.bat`, which correctly bootstrapped DayZ AIO's portable Node.js 20 runtime. However, GitHub Actions starts every workflow step in a fresh process. The `PATH` change made by the installer process therefore did not persist into the next step.

The verification step then executed plain `node`, which resolved to the GitHub-hosted runner's preinstalled system Node 22/24 instead of `.dayz-aio-runtime/node20/node.exe`.

Result:

```text
Expected Node 20.x after installer bootstrap, got 22.23.1
```

## Fix

- The Windows smoke workflow now dot-sources `scripts/windows/ensure-node.ps1` after `install-windows.bat`.
- It resolves the portable Node 20 runtime with `Ensure-Node20 -NoDownload`.
- It writes the portable Node directory to `$GITHUB_PATH`, making it available to later CI steps.
- The runtime verification step now reports both Node version and actual executable path.
- This keeps the product installer unchanged while making GitHub Actions step isolation explicit.

## Scope

This is a CI/workflow fix only. The local Windows scripts already use `ensure-node.ps1` and continue to enforce exact Node major 20.
