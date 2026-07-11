# DayZ AIO v0.4.3 — Green Security + DZSA Cleanup

Small hardening release after the v0.4.2 backlog review.

## Implemented

- Explicitly masks `STEAM_WEB_API_KEY` in debug bundle output.
- Explicitly masks `DAYZ_AIO_STEAM_WEB_API_KEY` in debug bundle output.
- Adds secret masking regression tests for both variables.
- Consolidates DZSALModServer detection into `servers/dzsaDetection.ts`.
- Community Ops and Readiness now use the same DZSA detection function.
- Adds DZSA detection tests covering known filenames and fuzzy candidates.

## Reason

The v0.4.2 review found one secret-leak risk and one duplicated detection implementation.
Both were small but worth fixing before continuing with larger feature work.
