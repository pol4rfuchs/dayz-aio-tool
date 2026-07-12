# DayZ AIO v0.5.9 — Updater Progress UI

## Scope

Replaces the cramped brown latest-job status boxes in all updater entry points with a reusable progress component.

## Changed

- Added `apps/frontend/src/components/UpdateJobProgress.tsx`.
- Added a progress bar, status badge, job id, current step, updated timestamp, completed/total and failure count.
- Shows last SteamCMD/copy output tail only when available.
- Shows backend error / verification reason / Steam findings as explicit alerts.
- Applies to:
  - `ServerUpdater.tsx`
  - `ModUpdater.tsx`
  - `Mods.tsx` updater panel
- Auto-refreshes updater jobs every 2.5 seconds while a job is active.
- Keeps historical job lists, but their details now prefer readable output tails over raw JSON where possible.

## Notes

This is frontend-only. It does not change backend job semantics, SteamCMD execution, copy behavior, or update verification.
