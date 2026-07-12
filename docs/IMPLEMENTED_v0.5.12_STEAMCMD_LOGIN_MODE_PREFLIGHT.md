# v0.5.12 — SteamCMD Login Mode Preflight

Adds explicit SteamCMD credential mode handling for the DayZ server updater and Workshop/mod updater.

## Implemented

- Added explicit `steamLoginMode` support:
  - `anonymous`
  - `user`
- Kept backward compatibility with the previous `useSteamLogin` payload.
- Added shared backend auth helper:
  - `apps/backend/src/modules/updates/auth.ts`
- Passwords are never accepted, stored, logged, or passed by DayZ AIO.
- Steam user mode passes only `+login <steamUser>` to SteamCMD so SteamCMD can reuse its cached session after a manual Steam Guard login.
- Update preflight now reports:
  - selected login mode
  - anonymous-mode warning for AppID 223350 / gated Workshop access
  - likely cached SteamCMD user session
  - likely Steam Guard/manual-login requirement
- Server updater, Mod updater, and the combined Mods updater panel now expose the login mode explicitly in the UI.
- Steam username is stored only in browser `localStorage`; no password field exists.

## Operational model

Recommended flow for Steam user mode:

```powershell
& "C:\Server\dAYz\SteamCMD\steamcmd.exe" +login <STEAM_USER> +quit
```

Approve Steam Guard once. DayZ AIO then uses the username only and lets SteamCMD reuse the cached session.

## Not included

- No Steam Web API requirement for downloads.
- No password storage.
- No secret persistence in backend DB.
