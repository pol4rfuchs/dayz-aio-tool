# v0.2.5 Node.js 20 Bootstrap

## Ziel

Windows-Testsysteme mit altem Node.js 16/18 sollen DayZ AIO starten können, ohne dass der User manuell Node.js aktualisieren muss.

## Eingebaut

```text
✅ scripts/windows/ensure-node.ps1
✅ Automatische Prüfung: System Node >=20
✅ Portable Runtime: .dayz-aio-runtime/node20
✅ Download von nodejs.org/dist/latest-v20.x/
✅ npm wird aus der portablen Runtime genutzt
✅ install/start/build/smoke scripts verwenden Ensure-Node20
✅ Doctor erkennt System-Node und Portable-Node
✅ .dayz-aio-runtime/ in .gitignore
```

## Verhalten

```text
1. Wenn systemweites Node.js >=20 existiert → verwenden.
2. Wenn portable Node.js 20 bereits existiert → verwenden.
3. Wenn nichts Passendes existiert → Node.js 20 ZIP nach .dayz-aio-runtime/node20 downloaden und entpacken.
```

## Wichtig

Der automatische Bootstrap installiert Node.js nicht systemweit. Es werden keine PATH-Einträge im Benutzer- oder Systemprofil geschrieben. Die PATH-Anpassung gilt nur für den aktuellen DayZ-AIO-Prozess und dessen gestartete Backend/Frontend-Konsolen.

## Fehlerfälle

Wenn `nodejs.org` nicht erreichbar ist, bricht der Installer mit einer klaren Meldung ab. Dann ist eine manuelle Node.js-20+-Installation oder ein funktionierender Internetzugang nötig.
