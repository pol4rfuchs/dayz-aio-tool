# v0.2.16 Debug + Backup UI Polish

## Fixed

- Integrated the 3100/8090 port-readiness behavior into the current package line.
- Frontend now validates `selectedServerId` against `/api/servers` and clears stale browser state automatically.
- Backup page treats stale server IDs / missing backup records as an empty-state instead of a red hard error.
- Backup page now explains: "No backups yet" / "select a valid server" instead of surfacing raw 404 text.
- Debug bundle manifest reads the version from root `package.json` and also records the runtime version.
- Script log wrapper now writes UTF-8 logs instead of PowerShell UTF-16/NUL-looking output.
- `/favicon.ico` is public and returns `204`, avoiding unnecessary `401` noise in backend logs.
- UI brand bumped to v0.2.16.

## Still intentional

- Raw SQLite DB is not exported in debug bundles.
- Raw DayZ server files are not exported in debug bundles.
- Secrets remain masked in debug bundle text files.
