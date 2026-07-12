# v0.5.13 — SteamCMD Login Console

## Purpose

Adds the missing in-AIO path for the SteamCMD login bootstrap that was previously documented as a manual command:

```powershell
& "C:\Server\dAYz\SteamCMD\steamcmd.exe" +login <STEAM_USER> +quit
```

The app still never stores, receives, logs, or forwards a Steam password. Instead it opens a local interactive SteamCMD console window where the user enters the Steam password and Steam Guard code directly into SteamCMD. SteamCMD then persists its own session under the existing SteamCMD configuration directory.

## Backend

New endpoint:

```http
POST /api/servers/:serverId/updates/steam-login-session
```

Request body:

```json
{
  "steamUsername": "steam account name",
  "keepOpen": true
}
```

Behavior:

- resolves the server's configured SteamCMD path
- validates SteamCMD exists
- writes a temporary helper script under `.dayz-aio-runtime/steamcmd-login/`
- launches a Windows console via `cmd.exe start`
- runs:
  ```text
  steamcmd.exe +login <steam-user> +quit
  ```
- keeps the console open with `pause` so Steam Guard / login result remains visible
- writes only a non-secret audit entry

Non-Windows systems return a manual command hint instead of launching a console.

## Frontend

Added **Open SteamCMD login** buttons to:

- Server Updater
- Mod Updater
- combined Mods / Updater panel

The button is only active when `Steam user/session` mode is selected and a Steam username is entered.

## Security

- password field intentionally absent
- password is entered only in the SteamCMD console window
- DayZ AIO never sees the password
- DayZ AIO never stores the password
- audit metadata stores no password and uses a generic `steam-user-session` target

## Workflow

1. Select `Steam user/session`.
2. Enter Steam login user.
3. Click **Open SteamCMD login**.
4. Enter password and Steam Guard in the opened console.
5. Re-run update preflight.
6. Run DayZ server updater or mod updater.
