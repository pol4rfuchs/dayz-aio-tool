# v0.5.17 — SteamCMD Secret Redaction Coverage

## Ziel

Nach v0.5.16 war das Einmal-Passwort-Login für SteamCMD funktional korrekt, aber zwei Sicherheitskanten sollten geschlossen werden:

1. Der sicherheitskritische Redaction-Fall `+login <user> <password> <guard>` brauchte einen expliziten Regressionstest.
2. `outputTail` aus SteamCMD wurde bisher roh in Job-Results/Audit-Metadaten übernommen. SteamCMD echoet Login-Argumente normalerweise nicht, aber falls es doch passiert, dürfen Passwort oder Steam-Guard-Code nicht im Frontend, Realtime-Broadcast oder Audit landen.

## Umsetzung

- Neuer Helper in `apps/backend/src/modules/updates/auth.ts`:
  - `redactSteamCmdOutput()`
  - `redactSteamCmdOutputTail()`
- Redaction ersetzt:
  - Steam-Passwort → `<steam-secret>`
  - Steam-Guard-Code → `<steam-secret>`
  - `+login <username>` in SteamCMD-Command-Echos → `+login <steam-user>`
- Alle SteamCMD-Output-Tails laufen jetzt durch diese Redaction:
  - Server-Updater
  - Mod-Updater
  - Single Workshop Install
  - Update enabled Workshop mods
- `steam-auth.test.ts` deckt jetzt den kritischen Fall Username + Passwort + Steam-Guard-Code ab.

## Sicherheitsmodell

Das Passwort bleibt weiterhin ein One-Shot-Secret:

- nicht in `localStorage`
- nicht in DB
- nicht in Audit-Metadaten
- nicht in Command-Labels
- nicht in Job-`outputTail`, falls SteamCMD Login-Argumente echoen sollte

SteamCMD bekommt das Passwort weiterhin nur als Prozessargument für diesen konkreten Job.
