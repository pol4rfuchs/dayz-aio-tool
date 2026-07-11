# DayZ AIO MVP v0.1 — Critical Fix Pack

## Implemented now

- Real Server CRUD API
- SQLite init/schema usage
- Server runtime control via `execa`
- Config module for `serverDZ.cfg`
- Safe atomic file write with backup-before-write
- Manual backups
- Backup restore
- Economy `types.xml` read/validate/save
- Mod scanner
- Mod load-order API
- Audit log writes for critical operations
- Path traversal guard
- Windows starter batch

## Still intentionally not complete

- Steam Workshop download/update
- Real player/RCON admin actions
- Production authentication
- Remote agent model
- Full multi-map mission auto-detection
- Real log streaming from DayZ process

## Important

For first local testing, use a copied DayZ server folder, not your production server folder.

## Add Existing Server UI + Auto Detection

Added after the first critical fix pack:

```text
✔ Browser page: Add Existing Server
✔ Backend endpoint: POST /api/servers/detect
✔ Path checks for root folder, DayZServer_x64.exe and serverDZ.cfg
✔ Auto-detect profile folder
✔ Auto-detect mission folder under mpmissions/*/db/types.xml
✔ Auto-detect types.xml path
✔ Generated safe launch params
✔ SQLite mission_path column
✔ Economy editor now uses detected mission_path instead of hardcoded chernarusplus only
```

Still intentional MVP limits:

```text
❌ no native Windows folder picker yet
❌ no SteamCMD install wizard yet
❌ no automatic mod workshop download yet
```
