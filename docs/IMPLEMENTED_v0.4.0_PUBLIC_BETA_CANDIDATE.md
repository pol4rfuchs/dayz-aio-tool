# DayZ AIO v0.4.0 Public Beta Candidate

Consolidates the planned v0.3.4 through v0.4.0 roadmap into one beta candidate package.

## Scope

### v0.3.4 Mod Sync Hardening

- Expansion-focused load-order diagnostics.
- Mod dependency validation checklist.
- Orphan mod folder detection concept and report surface.
- Better PBO mismatch classification for `0x00040092`, including Expansion bundle style failures.
- Keeps client mods and `serverMod` entries separated in the operator workflow.

### v0.3.5 Update Rollback

- Documents required pre-update snapshot workflow.
- Adds beta-safe rollback runbook for server files, Workshop staging/server mod folders and key sync state.
- Promotes snapshot-first update behavior as public beta default.

### v0.3.6 Live Log Intelligence

- Live Logs page remains the primary RPT/script/admin/crash tail surface.
- Adds operational runbook for filtering PBO, signature, dependency, crash and persistence symptoms.
- Diagnostic bundle workflow is promoted as first-line support artifact.

### v0.3.7 RCON Admin Finalization

- RCON/Admin remains guarded by `DAYZ_AIO_BATTLEYE_RCON_ENABLED=true`.
- Player list, kick, ban, broadcast and guarded commands are the public beta target set.
- Restart-warning workflow is documented; destructive commands stay guarded.

### v0.4.0 Public Beta Candidate

- Sidebar layout now separates server operation, server updating, mod updating, logs, crash monitoring, RCON and debug bundle workflows.
- Windows scripts are kept one-click oriented: install, start, production start, smoke test and doctor.
- Safer defaults: no Steam password persistence, guarded RCON, auth required by default, update verification required.
- Documentation updated for the public beta workflow.

## Beta Operator Flow

1. Import or select server.
2. Server Updater: update dedicated server with Steam login if anonymous fails.
3. Mod Updater: update launch-profile Workshop mods with Steam login.
4. Mod Updater: sync staging to server.
5. Mod Updater: sync `.bikey` files.
6. Server Control: start server.
7. Live Logs: monitor runtime/RPT/script logs.
8. Crash Monitor: classify failures.
9. Debug Bundle: export artifact if the server fails.

## Known Beta Boundaries

- Rollback is still conservative and snapshot-driven; test on the real server before trusting automated recovery.
- RCON requires explicit enablement and correct BattlEye RCON configuration.
- Deep mod dependency inference depends on mod metadata quality and still needs real-world validation.
- Workshop access requires a Steam login for protected DayZ Workshop content.
