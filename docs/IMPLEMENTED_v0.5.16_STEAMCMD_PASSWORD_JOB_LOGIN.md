# v0.5.16 — SteamCMD Password Job Login

Adds an integrated SteamCMD credential flow for DayZ server and Workshop update jobs.

## What changed

- Adds optional `steamPassword` and `steamGuardCode` request fields for SteamCMD update jobs.
- The password is **not stored** in DB, localStorage, logs, audit entries, or generated helper files.
- The password is used only for the currently started SteamCMD job.
- SteamCMD args are built as:
  - anonymous: `+login anonymous`
  - user cached session: `+login <user>`
  - user password job: `+login <user> <password>`
  - user password + Guard: `+login <user> <password> <guard-code>`
- SteamCMD command labels, job verification command strings, queue labels, and audit metadata redact:
  - Steam user as `<steam-user>`
  - password / guard as `<steam-secret>`
- Frontend Updater/Mod Updater/Mods Updater panels now provide password and Steam Guard fields.
- Removed dependency on launching an interactive SteamCMD window for the normal update path.

## Why

Windows desktop/session isolation made opening a visible SteamCMD console unreliable. Passing credentials directly to the local SteamCMD process is the pragmatic route while still avoiding persistence and logs.

## Security stance

This version intentionally does **not** persist the password. The operational tradeoff is that SteamCMD receives the password as a process argument for the duration of the job. That is still safer than storing the password in config files, DB, helper scripts, or logs, but Windows administrators should treat the local machine as trusted during updates.
