# DayZ AIO v0.2.18 — Frontend Dependency Fix

## Fixed

- Corrected `apps/frontend/package.json` dependency key from `vite --host 0.0.0.0 --port 3100` to `vite`.
- Kept frontend dev/preview scripts on `0.0.0.0:3100` with `--strictPort`.
- Updated package versions to `0.2.18`.
- Updated runtime/sidebar version labels.

## Root cause

The previous port fix accidentally moved the Vite command arguments into the dependency name. pnpm interpreted the full command string as an npm package name and failed with `ERR_PNPM_FETCH_404`.
