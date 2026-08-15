# CI Node 20 + pnpm Lockfile Runbook

## Why Node 20 is still pinned

DayZ AIO uses native dependencies such as `better-sqlite3`. The Windows runtime is intentionally pinned to Node.js 20.20.2 so local installs, CI smoke tests and native module ABI all match.

GitHub Actions now warns that Node 20 is deprecated. Until the native dependency path is migrated and validated against a newer Node ABI, workflows set:

```yaml
env:
  ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: "true"
```

## Why `cache: pnpm` was removed temporarily

`actions/setup-node` fails early when `cache: pnpm` is enabled but `pnpm-lock.yaml` is missing. During the pnpm migration, that caused CI to fail before dependency installation could generate the lockfile.

v0.4.6 removes that cache shortcut and adds a manual lockfile generation workflow.

## Correct lockfile state

Required:

```text
pnpm-lock.yaml
```

Forbidden:

```text
package-lock.json
```

## Generate the lockfile through GitHub Actions

Use:

```text
Actions → Generate pnpm Lockfile → Run workflow
```

The workflow removes `package-lock.json`, runs:

```bash
pnpm install --lockfile-only --no-frozen-lockfile
```

and commits `pnpm-lock.yaml` to the active branch.

## After lockfile exists

CI automatically uses:

```bash
pnpm install --frozen-lockfile
```

Release tags require `pnpm-lock.yaml` and reject `package-lock.json`.

## Dependabot-PRs und Lockfile-Drift

Dependabot bumpt `package.json`, aktualisiert `pnpm-lock.yaml` im Workspace aber nicht
zuverlässig mit. Der Workflow `dependabot-auto-lockfile.yml` fängt das automatisch ab:
er regeneriert das Lockfile auf dem PR-Branch und pusht den Fix zurück, sobald ein
Dependabot-PR mit `ERR_PNPM_OUTDATED_LOCKFILE` fehlschlägt.

**Nie lokal in Dependabot-Branches mergen.** Ein lokaler Merge von `main` in einen
Dependabot-Branch erzeugt fast immer Konfliktmarker in `pnpm-lock.yaml` (die Datei ist
maschinengeneriert und nicht für manuelles Auflösen gedacht). Stattdessen:

- **`@dependabot rebase`** in der PR-Konversation kommentieren — Standardfall, solange
  der Branch nicht manuell verändert wurde.
- **`@dependabot recreate`**, falls Dependabot den Rebase mit *"this PR has been edited
  by someone other than Dependabot"* verweigert (z. B. nach einem versehentlichen
  lokalen Merge). Das baut den Branch komplett neu gegen `main`, ohne dass irgendwelche
  Konfliktmarker von Hand aufgelöst werden müssen.
