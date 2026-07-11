# Setup

Alle Dateien behalten ihren relativen Pfad zum Repo-Root — einfach den
kompletten Inhalt dieses Ordners ins Repo kopieren:

```text
.github/workflows/ci.yml
.github/workflows/windows-installer-smoke.yml
.github/workflows/native-module-check.yml
.github/workflows/release.yml
.github/workflows/secret-masking-lint.yml
.github/dependabot.yml
scripts/ci/check-secret-masking.mjs
```

## Was vor dem ersten Lauf geprüft werden sollte

1. **`ci.yml` / `native-module-check.yml`** — nutzen
   `pnpm --filter @dayz-aio/backend` bzw. `@dayz-aio/frontend`. Falls die
   `name`-Felder in `apps/backend/package.json` / `apps/frontend/package.json`
   nicht exakt so heißen, die Filter-Namen anpassen.

2. **`windows-installer-smoke.yml`** — läuft `install-windows.bat` auf einem
   frischen `windows-latest`-Runner ohne echten DayZ-Server, SteamCMD oder
   Steam-Zugangsdaten. Der `smoke-test-windows.bat`-Schritt hat deshalb
   `continue-on-error: true`, weil DayZ-spezifische Checks dort erwartbar
   fehlschlagen — der Schritt fängt trotzdem Backend/Frontend-Boot-Fehler ab.

3. **`release.yml`** — erwartet, dass zu jedem Tag `vX.Y.Z` eine passende
   `docs/IMPLEMENTED_vX.Y.Z_*.md` existiert. Fehlt die Datei, wird der
   Release trotzdem erstellt, aber mit einem Platzhalter-Text und einer
   `::warning::`-Annotation im Workflow-Log.
   Release auslösen mit:
   ```bash
   git tag v0.4.2
   git push origin v0.4.2
   ```

4. **`secret-masking-lint.yml`** — das zugehörige Script
   (`scripts/ci/check-secret-masking.mjs`) vergleicht Variablennamen per
   Substring-Match. Bei False Positives (z. B. ein harmloser `...TOKEN...`-Name,
   der nicht wirklich sensibel ist) einfach den Namen aus der
   `SENSITIVE_NAME_PATTERN`-Regex im Script ausschließen oder die Maskierung
   trotzdem ergänzen — sicherer ist letzteres.

5. **`dependabot.yml`** — die `ignore`-Regeln für `better-sqlite3` und
   `execa` verhindern nur *automerge-artige* stille Major-Updates nicht,
   Dependabot merged sowieso nie automatisch ohne eigene Automerge-Regel.
   Sie sorgen aber dafür, dass Major-Bumps dieser zwei Pakete gar nicht erst
   als PR vorgeschlagen werden — die kommen dann nur nach manueller Prüfung
   rein.

## Reihenfolge zum Einbauen

Am risikoärmsten ist es, in dieser Reihenfolge zu committen und laufen zu
lassen, damit ihr bei einem Fehlschlag genau wisst, welcher Workflow schuld
ist:

1. `ci.yml` (schnellster Fail, deckt die meisten Grundfehler ab)
2. `secret-masking-lint.yml` (trivial, sollte sofort grün sein)
3. `dependabot.yml` (kein Workflow-Lauf nötig, wirkt beim nächsten Scan)
4. `native-module-check.yml` (Matrix, dauert etwas länger)
5. `windows-installer-smoke.yml` (der aufwändigste, geht am ehesten zuerst rot)
6. `release.yml` (erst nach einem grünen `ci.yml`-Lauf auf einem echten Tag testen)
