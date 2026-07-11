# DayZ AIO v0.2.6 — Feature Completion Pack

This pack closes the remaining yellow/red MVP gaps in a guarded way. It is still a test-first alpha package; use a copied server folder or VM snapshot.

## Added

- Mission detection now prefers `serverDZ.cfg` `template=...` and maps it to `mpmissions/<template>/db/types.xml`.
- Economy Editor Pro:
  - `types.xml` table editor expanded.
  - `events.xml` table editor.
  - `globals.xml` table editor.
  - `cfgspawnabletypes.xml` summary view.
  - Raw XML + Diff remains available for complex CE files.
- BattlEye RCON adapter:
  - guarded by `DAYZ_AIO_BATTLEYE_RCON_ENABLED=false` by default.
  - Player list, broadcast, kick and ban endpoints/UI.
  - command allowlist remains active.
- Crash Monitor:
  - scans crash/RPT/dump-like files.
  - scans runtime log buffer for crash-like lines.
- Workshop improvements:
  - update all enabled Workshop mods with saved Workshop IDs.
- Dynamic Economy:
  - group analysis.
  - dry-run preview with diff.
  - guarded apply requires `APPLY_DYNAMIC_ECONOMY_TO_TEST_COPY` and creates backup.
- Map Tools:
  - basic `cfgeventspawns.xml` event-position extraction.
- Local Analyzer:
  - deterministic diagnostics using runtime status, logs, economy validation and backup count.

## Still guarded

- Real BattlEye RCON is disabled unless explicitly enabled in `.env`.
- Dynamic Economy write path requires confirmation and should only be used on copied test servers.
- Map Tools are extraction/inspection first; destructive map editing is not enabled.
- No public internet exposure. Use LAN/VPN only.
