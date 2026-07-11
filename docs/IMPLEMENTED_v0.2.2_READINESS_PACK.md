# DayZ AIO v0.2.2 — Go-Live Readiness Pack

## Ziel

v0.2.2 macht das Paket nicht feature-schwerer, sondern sicherer testbar:

- blockierende Startfehler früher erkennen
- Go-Live-Status im UI sichtbar machen
- Start-Preflight als API bereitstellen
- produktionsnäheren Windows-Start nach Build anbieten
- Runtime-DB bewusst resetten können, ohne DayZ-Dateien anzufassen

## Neu

### Backend

```http
GET /api/system/readiness
GET /api/servers/:serverId/readiness
GET /api/servers/:id/start/preflight
```

### Start-Sicherheit

`startServer()` führt jetzt vor `execa()` einen Preflight aus. Blockierende Fehler:

- Server Root fehlt
- `DayZServer_x64.exe` fehlt
- `serverDZ.cfg` fehlt

Nicht-blockierende Warnungen:

- Profile-Ordner fehlt
- Mission-Ordner fehlt
- `types.xml` fehlt
- Launch-Parameter leer

### Frontend

Neue Seite:

```text
Go-Live Checklist
```

Sie zeigt:

- System Readiness
- Server Readiness
- Prozent-Score
- Fail/Warn/Pass
- nächste konkrete Aktionen

### Windows Scripts

Neu:

```text
build-windows.bat
start-production-windows.bat
reset-runtime-db-windows.bat
scripts/windows/build.ps1
scripts/windows/start-production.ps1
scripts/windows/reset-runtime-db.ps1
```

## Empfohlener Ablauf ab v0.2.2

```text
1. install-windows.bat
2. start-windows.bat
3. Add Existing Server
4. Go-Live Checklist prüfen
5. Test Center -> Doctor prüfen
6. Safety Test ausführen
7. Start/Stop Test ausführen
8. Optional: build-windows.bat
9. Optional: start-production-windows.bat
```

## Weiterhin bewusst nicht voll produktiv

- echter BattlEye-RCON-Command-Sender bleibt guarded
- Dynamic Economy verändert nichts automatisch
- AI Analyzer ist Diagnose-Adapter, keine echte LLM-Anbindung
- Map Tools haben noch keinen echten Karteneditor

## Harte Regel

Erst gegen `C:\DayZServer_TEST` oder VMware-Snapshot testen.
