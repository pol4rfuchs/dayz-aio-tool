# Implemented — v0.4.6 CI Node20 Lockfile Actions Fix

## Scope

This release consolidates the v0.4.3 security cleanup, v0.4.4 native-dependency installer fix and v0.4.5 Windows runtime consistency work with GitHub Actions fixes for the Node 20 deprecation period and pnpm lockfile rollout.

## Implemented

- Pins CI, release, secret-masking and native-module workflows to Node.js `20.20.2`.
- Sets `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` where GitHub Actions must temporarily run Node 20.
- Removes `actions/setup-node` pnpm cache usage that fails before `pnpm-lock.yaml` exists.
- Adds transitional install logic:
  - uses `pnpm install --frozen-lockfile` when `pnpm-lock.yaml` exists;
  - falls back to `pnpm install --no-frozen-lockfile` with a warning while the lockfile is being generated.
- Adds a manual `Generate pnpm Lockfile` workflow to create `pnpm-lock.yaml` and remove stale `package-lock.json` on the active branch.
- Adds lockfile hygiene checks that reject `package-lock.json` and warn when `pnpm-lock.yaml` is missing.
- Removes Node 22 from the native-module matrix because DayZ AIO Windows runtime is intentionally pinned to Node 20.x.
- Keeps Windows smoke testing on `install-windows.bat`, which bootstraps the same portable Node 20.20.2 runtime as local installs.

## Required maintainer action

Run the manual workflow:

```text
Actions → Generate pnpm Lockfile → Run workflow
```

Then confirm that the resulting commit contains:

```text
pnpm-lock.yaml
```

and does not contain:

```text
package-lock.json
```

After that, CI and release workflows can use frozen pnpm installs reliably.
