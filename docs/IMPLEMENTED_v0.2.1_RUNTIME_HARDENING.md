# DayZ AIO v0.2.1 Runtime Hardening

## Ziel

v0.2.1 ist kein Feature-Spam-Release, sondern ein Stabilisierungspaket für den ersten echten Windows-/VMware-Testlauf.

## Neu eingebaut

### Windows Tooling

- `install-windows.bat`
- `start-windows.bat`
- `doctor-windows.bat`
- `smoke-test-windows.bat`
- PowerShell-Skripte unter `scripts/windows/`

### Backend Doctor API

- `GET /api/system/doctor`
- `GET /api/servers/:serverId/doctor`

Die Doctor API prüft:

- Node.js-Version
- Plattform/Architektur
- DATA_DIR Schreibbarkeit
- Backup-Verzeichnis Schreibbarkeit
- SQLite Query-Test
- Serverpfade
- `DayZServer_x64.exe`
- `serverDZ.cfg`
- Mission-Pfad
- `types.xml`
- SteamCMD-Pfad optional
- RCON-Konfiguration optional
- Runtime-Status/PID

### Frontend Test Center erweitert

- System Doctor Panel
- Server Doctor Panel
- Safety Test bleibt vorhanden
- Start/Stop Test bleibt vorhanden
- Checks mit `pass` / `warn` / `fail`

## Empfohlener Testablauf

```text
1. ZIP entpacken
2. install-windows.bat ausführen
3. start-windows.bat ausführen
4. Browser: http://localhost:3000
5. Add Existing Server: C:\DayZServer_TEST
6. Test Center öffnen
7. System Doctor prüfen
8. Server Doctor prüfen
9. Safety Test ausführen
10. Erst danach Start/Stop Test ausführen
```

## Smoke-Test per CLI

```powershell
smoke-test-windows.bat -DayzRoot "C:\DayZServer_TEST"
```

Der Smoke-Test führt bewusst keinen Start/Stop aus. Das bleibt im UI-Testcenter, nachdem Ports und Testumgebung geprüft wurden.

## Weiter offen

- echter BattlEye RCON Client
- Windows Service Installer
- Graceful Shutdown mit DayZ-spezifischem Broadcast/Countdown
- echte Workshop-Update-Pipeline mit Credentials/SteamCMD-Fehlerauswertung
- UI Settings für DATA_DIR, Ports und Sicherheitsmodus
