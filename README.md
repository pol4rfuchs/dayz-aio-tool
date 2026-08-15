# DayZ AIO Server Manager

Browserbasiertes Admin-Panel mit Windows-kompatiblem Backend für DayZ Standalone Server.

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
- ntfy/Webhook Notification Targets
- RCON/Admin UI als guarded adapter
- RCON-Passwort verschlüsselt in SQLite
- Analytics Summary
- Test Center für Safety-Tests
- Go-Live Checklist / Readiness
- Advanced Lab für Dynamic Economy / Map Tools / AI Analyzer Adapter

## Server Control

Eigener Sidebar-Menüpunkt **Server Control**. Das Dashboard bleibt Schnellübersicht; die eigentliche Runtime-Steuerung sitzt auf einer dedizierten Seite.

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

## Changelog

Alle versionierten Änderungen und Release-Notes stehen in [`CHANGELOG.md`](./CHANGELOG.md).
