# v0.5.0 Test Coverage Pack

Implemented coverage for the remaining v0.4.2 backend modules called out in the backlog.

## Added tests

- `apps/backend/test/wipe-routes.test.ts`
  - wipe plan returns active storage folders and confirm token
  - wipe execute renames `storage_N` into an archived wipe folder
  - wipe execute records `wipe_cycles` and audit rows
  - wipe execute blocks while the server PID is alive

- `apps/backend/test/tools-routes.test.ts`
  - day/night calculator returns copy-paste-ready config values
  - classname finder reads `types.xml` and `cfgspawnabletypes.xml`
  - classname finder deduplicates overlapping classnames
  - classname finder blocks mission paths outside the server root
  - VAC/Steam ban check returns a clean disabled state without a Steam Web API key

## Scope

This is a coverage and regression pack only. It does not add user-facing features.
