# Implemented v0.5.3 — Maintenance Verification Coverage

This release continues the post-CI hardening pass after v0.5.2.

## Included

- Restored the `logs/routes.ts` source module in the release tree.
- Split DayZ dedicated-server update verification helpers out of `updates/routes.ts` into `updates/verification.ts`.
- Added direct regression coverage for update verification snapshots and ACF/appmanifest parsing.
- Added persistence route coverage:
  - scan detects active `storage_N` folders and quarantines
  - quarantine copies active storage and renames the original folder out of the active mission path
  - restore recreates active storage from a disabled/quarantined folder
  - quarantine blocks while the DayZ server PID is alive
- Added live-log route coverage:
  - lists RPT/ADM/log files
  - skips noisy folders such as `node_modules`
  - tails only files inside the server root
  - rejects path traversal/outside-root log reads

## Still open

- Windows service shutdown signal forwarding is still a separate follow-up. The current NSSM wrapper remains functional, but the deeper service-stop model should be addressed independently.
- Additional application features such as Discord notifications, whitelist management and advanced analytics remain future work.
