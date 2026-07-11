# DayZ AIO Server Manager

Browserbasiertes Admin-Panel mit Windows-kompatiblem Backend für DayZ Standalone Server.

## Version

`v0.3.0-beta-server-control-navigation`

## Aktueller Fokus

Dieses Paket ist für **VMware / Windows Test-VM / C:\DayZServer_TEST** gedacht. Nicht direkt auf einen Live-Server loslassen.

## Start auf Windows

```bat
install-windows.bat
start-windows.bat
```

Danach:

```text
Frontend: http://localhost:3100
Backend:  http://localhost:8090/health
Security:  http://localhost:3100?page=security
```

Wichtig: `install-windows.bat` erzeugt automatisch `apps/backend/.env` mit:

```text
DAYZ_AIO_API_KEY
DAYZ_AIO_SECRET_KEY
DAYZ_AIO_CORS_ORIGINS
```

Beim ersten UI-Start links **Security** öffnen und den `DAYZ_AIO_API_KEY` aus `apps/backend/.env` eintragen.


## Node.js Bootstrap / Windows Native Runtime

`install-windows.bat`, `build-windows.bat`, `start-windows.bat`, `doctor-windows.bat` und `smoke-test-windows.bat` verwenden dieselbe Node.js-Auswahl.

```text
Wenn System-Node 20.x vorhanden ist: wird verwendet.
Wenn System-Node 22/24 vorhanden ist: wird abgelehnt und portable Node.js 20.20.2 wird verwendet.
Wenn nur Node 16/18 vorhanden ist: portable Node.js 20.20.2 wird automatisch nach .dayz-aio-runtime\node20 geladen.
Wenn kein Node vorhanden ist: portable Node.js 20.20.2 wird automatisch geladen.
```

Dadurch musst du Node.js nicht mehr global installieren. Node 22/24 werden bewusst nicht verwendet, weil native Module wie better-sqlite3 an die Node-ABI gebunden sind. Der portable Runtime-Ordner bleibt lokal im Projekt und wird von Git ignoriert.

Voraussetzung für den automatischen Download: Windows hat Internetzugriff auf `nodejs.org`.

## Eingebaute Module

- Dashboard Live-Daten
- WebSocket-Realtime-Events mit API-Key-Schutz
- Existing Server Import mit Auto-Detection
- Server Start/Stop/Restart mit Preflight
- Dedicated Server Control page mit Start, Stop, Restart, Force Stop, PID/Uptime, Portstatus und Launch Preview
- Prozessstatus inkl. Backend-Neustart-Stale-Detection
- Live-Logbuffer aus gestarteten Prozessen
- serverDZ.cfg Editor + Diff + Backup-before-save
- Economy Editor: types.xml Tabelle + Raw XML für weitere CE-Dateien
- Bounded Diff Viewer für große XML-Dateien
- Backup Timeline + Restore + Delete
- Mod Manager mit Drag & Drop Load Order
- SteamCMD Workshop Adapter
- Audit Log UI
- Scheduler für Restart/Backup/Start/Stop
- Scheduler-Fehler werden persistiert und an Notification Targets gemeldet
- ntfy/Discord/Webhook Notification Targets
- RCON/Admin UI als guarded adapter
- RCON-Passwort verschlüsselt in SQLite
- Analytics Summary
- Test Center für Safety-Tests
- Go-Live Checklist / Readiness
- Advanced Lab für Dynamic Economy / Map Tools / AI Analyzer Adapter


## v0.3.0-beta Server Control Navigation

Dieses Paket ergänzt einen eigenen Sidebar-Menüpunkt **Server Control**. Das Dashboard bleibt Schnellübersicht; die eigentliche Runtime-Steuerung sitzt nun auf einer dedizierten Seite.

Enthalten:

- Start / Stop / Restart + Backup
- Force Stop / Kill Process
- Status, PID, Uptime
- konfigurierter Game-Port / Port 2302 Check
- Launch Params Preview
- Copy Launch Command
- Start Preflight Checks
- Last Process Log

## Security Baseline

```text
API-Key Pflicht für /api/*
API-Key Pflicht für /ws
CORS Allowlist statt offenem origin:true
Basic Rate Limiting
Auth-Failure Throttling
RCON-Passwort Encryption-at-rest
Frontend Security Page
```

## Harte Sicherheitsregel

Erst testen:

```text
C:\DayZServer_TEST
```

oder isoliert in VMware mit Snapshot.

## Quickstart

```text
1. ZIP entpacken
2. install-windows.bat starten
3. start-windows.bat starten
4. Browser öffnen: http://localhost:3100
5. Security öffnen und API-Key aus apps/backend/.env speichern
6. Add Existing Server: C:\DayZServer_TEST
7. Go-Live Checklist prüfen
8. Test Center -> System Doctor + Server Doctor ausführen
9. Safety Test ausführen
10. Erst danach Start/Stop Test ausführen
```

CLI-Diagnose:

```powershell
doctor-windows.bat -DayzRoot "C:\DayZServer_TEST"
smoke-test-windows.bat -DayzRoot "C:\DayZServer_TEST"
```

## Dev Setup

```bash
npm install
npm run dev
```

## Build / Production-Style Smoke

```bat
build-windows.bat
start-production-windows.bat
```

Nicht direkt auf den Live-Server zeigen. Erst VMware-Snapshot oder kopierter Testordner.

## v0.2.5 runtime polish

```text
✅ portable Node.js 20 bootstrap
✅ no admin/system-wide Node install required
✅ Windows scripts use portable Node when system Node is too old
✅ Doctor detects both system and portable Node runtimes
✅ .dayz-aio-runtime ignored by Git
```

## v0.2.6 Feature Completion Notes

v0.2.6 adds the remaining MVP modules in guarded form:

- Economy Editor Pro for `types.xml`, `events.xml`, `globals.xml`, plus `cfgspawnabletypes.xml` summary.
- Mission detection from `serverDZ.cfg template=...`.
- Crash Monitor page.
- BattlEye RCON UI/API, disabled by default until `DAYZ_AIO_BATTLEYE_RCON_ENABLED=true` is set.
- Workshop update for enabled mods.
- Dynamic Economy preview/apply flow with backup and confirmation token.
- Map event-spawn extraction and local diagnostics analyzer.

First test path should still be a copy such as:

```text
C:\Server\dAYz\DayZServer_TEST
```

Do not point this at a live production server until Doctor, Readiness, Safety Test, Backup/Restore, Economy Save/Restore and Start/Stop all pass on the test copy.

## v0.2.8 Pretest polish

This package adds mod conflict/dependency diagnostics, Workshop preflight checks, and scheduler retry/escalation before the first Windows/VMware test round.


## v0.2.8 Debug Bundle

Runtime diagnostics are now collected automatically. Windows wrappers write to `logs/scripts/*.log`, the backend writes `logs/backend.log`, and Doctor/Readiness calls save JSON snapshots in `logs/snapshots/`.

Use the browser UI:

```text
Debug Bundle → Export Debug Bundle
```

The exported ZIP masks API keys, secret keys, RCON passwords and WebSocket query tokens. It does not include the SQLite database or raw DayZ server files.


## v0.2.9 Reliability + Test Pack

Adds shared CRC32, safer debug ZIP limits, symlink-safe crash scanning, serialized BattlEye RCON, non-overlapping scheduler ticks, economy XML size limits, async backend log buffering, and Workshop background jobs.

## v0.2.10 Windows installer notes

The Windows installer now uses a project-local npm cache:

```text
.dayz-aio-runtime\npm-cache
```

If `npm install` fails, check:

```text
logs\scripts\install-windows-latest.log
```

The installer also prints the latest npm debug-log tail automatically.

## v0.2.11 Windows npm fallback

If portable Node.js works but npm workspaces fail with `npm error Exit handler never called!`, v0.2.11 automatically falls back to isolated per-package installs and direct package startup.


## v0.2.12 Windows install note

This package bypasses broken npm 10.8.x installs on Windows by enabling Corepack and using pnpm 9.15.9 automatically. Use `install-windows.bat`, then `start-windows.bat`.

## v0.2.14 DayZ CE Validation Fix

`min > nominal` in `types.xml` is now treated as a warning, not a hard failure. This prevents valid DayZ CE patterns such as infected, event-driven, animal, mushroom, and special economy entries from blocking Server Readiness. Validation output is grouped in the UI so large vanilla files no longer produce hundreds of repeated lines.

## v0.2.16 Notes

This build includes Debug + Backup UI polish:

- Frontend: `http://localhost:3100`
- Backend: `http://localhost:8090`
- Stale server selections are cleared automatically.
- Backup `404` states are shown as an empty backup timeline instead of a red error.
- Debug bundles report the package version from `package.json`.
- Script logs are written as UTF-8.

## v0.2.17 Launch Profile Import

Existing modded servers often need the exact old start parameters. If `-mod=`, `-servermod=`, `-profiles=` or `-bepath=` are missing, a DayZ server can start and then exit during load.

Use:

```text
Add Existing Server → Analyze paths
```

AIO scans the server root and parent folder for old manager JSON files or start scripts, then fills `Launch params` automatically. For a server rooted at:

```text
C:\Server\dAYz\DayZServer
```

AIO also checks:

```text
C:\Server\dAYz\server_manager.json
C:\Server\dAYz\server-manager.json
C:\Server\dAYz\baseserver-manager.json
C:\Server\dAYz\*.bat / *.cmd / *.ps1
```

If Expansion or `@mod` folders are detected but `-mod=` is missing, Start preflight warns or blocks until the launch profile is fixed.

## v0.2.18 Frontend Dependency Fix

Fixes the Windows install regression introduced in v0.2.17 where the frontend package dependency name was accidentally written as `vite --host 0.0.0.0 --port 3100` instead of `vite`. pnpm now resolves Vite normally again while the dev script still starts on port 3100.


## v0.2.19 DayZ Server Manager Deep Import

Adds deep import for legacy DayZ Server Manager setups. The importer now scans `server-manager.json`, `baseserver-manager.json`, and `server_manager/Server_manager.ps1`, extracts `steamWsMods[]` and `steamWsServerMods[]`, accepts numeric Workshop-ID mod folders, and generates a DayZ launch line with `-mod=`, `-serverMod=`, `-bepath=`, `-profiles=`, `-port=`, and logging/freezing flags where detected. The Server Config page now includes an import button for already-saved servers.

## v0.2.20 Updater Expansion

- Fixes Test Center port semantics: backend `8090` occupied by AIO is `OK`, not a warning.
- Adds Dedicated Server update via SteamCMD AppID `223350`.
- Adds Workshop mod update from launch profile / numeric Workshop IDs.
- Requires stopped server before update actions.
- Uses Workshop staging under the DayZ parent folder and copies updated mod folders into the server root.


## v0.3.0-beta Consolidation

Consolidates Crash Intelligence, Persistence Tools, Mod Key Sync, Live Logs/RPT Tail and guarded RCON/Admin workflows. See `docs/IMPLEMENTED_v0.3.0_BETA_CONSOLIDATION.md`.


## v0.3.2

SteamCMD Auth + Update Parser Fix.


## v0.4.0-beta

Workshop Synchronization release.

- Adds dedicated sidebar page `Server Updater` for DayZ Dedicated Server AppID `223350`.
- Adds dedicated sidebar page `Mod Updater` for Workshop AppID `221100`.
- Keeps SteamCMD auth handling without storing passwords.
- Adds server EXE/version/manifest state view.
- Adds Workshop synchronization report for launch-profile IDs, mod-table IDs, server folders, staging folders and `.bikey` sync.
- Adds staging-to-server sync action for already downloaded Workshop content.
- Marks Expansion-related mods/PBOs to help diagnose `0x00040092 Data verification failed` errors.


## v0.4.0-beta Public Beta Candidate

This package consolidates v0.3.4 through v0.4.0: Mod Sync Hardening, Update Rollback runbooks, Live Log Intelligence, RCON Admin finalization, Windows service helper scripts, safer defaults and public beta documentation.

See `docs/IMPLEMENTED_v0.4.0_PUBLIC_BETA_CANDIDATE.md` and `docs/PUBLIC_BETA_RUNBOOK.md`.


## v0.4.1 Public Beta Hardening

Adds unified SteamCMD queueing, SteamCMD parser tests, launch-profile parser guards, safer job cleanup, NSSM-based service installation, and stale-version fallback protection.


## v0.4.2 Green Backlog Pack

Adds Community Ops, Content Tools, Wipe Management, DZSALModServer detection, Day/Night calculator, Classname Finder, messages.xml generator and optional Steam ban-check endpoint. See `docs/IMPLEMENTED_v0.4.2_GREEN_BACKLOG_PACK.md`.

## v0.4.3 Green Security + DZSA Cleanup

Fixes the v0.4.2 review findings: explicit Steam Web API key masking and a single shared DZSALModServer detector used by both Community Ops and Readiness. See `docs/IMPLEMENTED_v0.4.3_GREEN_SECURITY_DZSA_CLEANUP.md`.


## v0.4.6 CI Node20 Lockfile Actions Fix

GitHub Actions are pinned to Node.js 20.20.2 with `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` while the Windows native dependency path remains on the Node 20 ABI. Use the manual `Generate pnpm Lockfile` workflow once to create `pnpm-lock.yaml` and remove stale `package-lock.json`. See `docs/CI_NODE20_LOCKFILE.md`.

## v0.4.7 CI Test Glob Runner Fix

The backend test script no longer relies on shell glob expansion. It now uses
`apps/backend/scripts/run-tests.mjs` to discover `test/**/*.test.ts` files and
passes explicit file paths to the Node test runner via `tsx`. This fixes GitHub
Actions failures where `test/**/*.test.ts` was treated as a literal path.
