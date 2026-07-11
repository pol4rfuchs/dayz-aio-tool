# Implemented v0.3.2 - SteamCMD Auth + Update Parser Fix

## Scope

This release fixes the SteamCMD update/authentication path discovered during real DayZ server update testing.

## Changes

- Server updater can run with a Steam username instead of forcing `anonymous`.
- Workshop/launch-profile mod updater can run with the same Steam username.
- The UI stores only the Steam username in browser localStorage; it does not store or send a Steam password.
- Steam Guard/session reuse is supported by relying on a prior manual SteamCMD login.
- SteamCMD output is parsed for hard failures even when SteamCMD also prints a misleading success line.
- Detected hard failures include:
  - `No subscription`
  - `Timed out waiting for update to start`
  - `Access Denied`
  - `No connection`
  - disk/file lock errors
  - Steam Guard/login failure hints
- Update jobs expose raw SteamCMD output tail in the UI.
- Server update verification from v0.3.1 remains enforced: `DayZServer_x64.exe` must exist and must change after update.

## Operational notes

Do not store Steam passwords in DayZ AIO. Run SteamCMD login once manually:

```powershell
& "C:\Server\dAYz\SteamCMD\steamcmd.exe" +login YOUR_STEAM_USER +quit
```

After Steam Guard is accepted, DayZ AIO can use the username and SteamCMD cached credentials/session.
