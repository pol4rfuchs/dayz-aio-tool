# v0.4.9 CI Test Path Encoding Fix

## Ziel

Behebt einen Windows-Pfadfehler im portablen Backend-Test-Runner aus v0.4.7.

## Problem

`apps/backend/scripts/run-tests.mjs` nutzte `new URL(...).pathname`, um Dateisystempfade aus `import.meta.url` zu erzeugen. Bei Datei-URLs liefert `.pathname` URL-kodierte Pfade.

Beispiel unter Windows:

```text
C:\Users\John Doe\dayz-aio-tool
```

wird als URL-Pfad zu:

```text
/C:/Users/John%20Doe/dayz-aio-tool
```

Dadurch konnte `existsSync`/`statSync` das Testverzeichnis nicht finden. Der Runner meldete dann fälschlich, dass keine Tests vorhanden seien, und beendete sich mit Exit-Code 0. CI konnte dadurch grün sein, obwohl keine Tests liefen.

## Fix

Der Test-Runner nutzt jetzt `fileURLToPath()` aus `node:url` für alle aus `import.meta.url` abgeleiteten Dateisystempfade.

Geändert:

```js
import { fileURLToPath } from 'node:url';

const testRoot = fileURLToPath(new URL('../test/', import.meta.url));
const backendRoot = fileURLToPath(new URL('..', import.meta.url));
```

Außerdem wird `backendRoot` als `cwd` für den Node-Testprozess verwendet.

## Ergebnis

- Windows-Pfade mit Leerzeichen funktionieren korrekt.
- URL-kodierte Pfade wie `%20` werden nicht mehr an `fs` übergeben.
- Der Test-Runner bleibt plattformunabhängig für Windows, Linux und macOS.
- Der v0.4.7 Glob-Fix bleibt erhalten.

## Version

`0.4.9-ci-test-path-encoding-fix`
