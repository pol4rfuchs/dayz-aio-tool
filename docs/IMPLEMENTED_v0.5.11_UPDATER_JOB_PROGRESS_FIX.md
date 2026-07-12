# Implemented v0.5.11 — Updater Job Progress Fix

## Problem

The UI still exposed update activity in places as raw audit metadata. In particular:

- `updates.workshop_sync_from_staging` was a synchronous endpoint and only wrote an audit entry.
- The Mod Updater could show a progress card for Workshop downloads, but not for the staging-copy step.
- The Audit page rendered `metadata` as a truncated `JSON.stringify(...)`, which produced unreadable long lines for server update failures and Workshop sync events.

## Changes

### Backend

- `workshop-sync-from-staging` now queues an update job with action `workshop-sync`.
- The job reports:
  - `total`
  - `completed`
  - `failed`
  - `current`
  - per-item result with source/destination and verification reason.
- Audit entries now include the job id and compact summary counts for the sync job.

### Frontend

- `ModUpdater.tsx` now includes both `mods-update` and `workshop-sync` jobs in the latest job card.
- `Sync staging → server` now queues a job instead of only returning a finished copy result.
- `Mods.tsx` renders update jobs with the reusable `UpdateJobProgress` component instead of raw output blocks.
- `AuditLog.tsx` now renders update events as structured summary cards instead of raw JSON:
  - Job
  - Total
  - Copied
  - Failed
  - Exit code
  - Verification reason
  - Auth mode
  - SteamCMD findings
  - EXE version/time where available

## Scope

This is a UI/progress plumbing fix plus a small backend job-model correction for staging sync. It does not change SteamCMD command execution, Workshop download arguments, server update verification, or mod-copy semantics.

## Verification

- `node scripts/ci/check-pnpm-lockfile.mjs` passes.
- `package-lock.json` remains absent.
