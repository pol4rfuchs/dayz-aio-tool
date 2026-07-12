# Implemented v0.2 All-In MVP

## Neu gegenüber v0.1

### Backend

- Realtime Hub + `/ws`
- Server heartbeat / stale PID detection
- Logbuffer für gestartete Serverprozesse
- Backup-Service erweitert: metadata read, delete, missing-file skip
- Config Diff Endpoint
- Economy Multi-File API
- `types.xml` Tabellen-Update API
- Generic line diff engine
- Audit Log API
- Scheduler API + runtime tick
- Notification Targets: ntfy and generic webhook
- SteamCMD Workshop install adapter
- Guarded RCON API shell: connectivity probe + allowlist + explicit 501 for full command execution
- Analytics summary API
- Safety/Test endpoints
- Advanced adapter endpoints für Dynamic Economy, Map Tools und AI Analyzer

### Frontend

- Dashboard mit Live-Status, Logs, Backups, Audit und WebSocket Events
- Add Existing Server erweitert um SteamCMD/RCON Felder
- serverDZ.cfg Editor mit Diff
- Economy Editor: types.xml Tabelle + Raw XML + Diff
- Backup Timeline
- Mod Manager mit Drag & Drop Load Order und Workshop Install UI
- Audit Log UI
- Scheduler UI
- Notifications UI
- RCON/Admin UI
- Test Center
- Analytics UI
- Advanced Lab UI

## Bewusst nicht fake-vollimplementiert

- Vollständige BattlEye RCON-Paketlogik ist nicht scharf. Die API/UI ist vorbereitet, aber Command Execution gibt 501 zurück, bis ein getesteter Adapter angeschlossen wird.
- Dynamic Economy verändert keine Live-Dateien automatisch. Es liefert Plan/Rules, damit keine Economy zerstört wird.
- Map Tools liefern Schema/Layer-Adapter, aber keinen Karten-Canvas.
- AI Analyzer nutzt keinen externen LLM-Key. Es liefert deterministische Diagnose-Checklisten.
