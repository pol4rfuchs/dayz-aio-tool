# v0.2.20 Updater Expansion

## Scope

This release expands the update workflow for Windows-based DayZ AIO installations.

## Implemented

- Test Center / Doctor port semantics fix:
  - Backend port `8090` occupied by the current AIO backend is now `OK`.
  - Frontend port `3100` occupied by the AIO frontend is now `OK`.
- Dedicated Server Update API:
  - Uses SteamCMD AppID `223350`.
  - Uses `+force_install_dir <serverRoot>`.
  - Requires the DayZ server to be stopped before updating.
- Workshop Mod Update API:
  - Reads Workshop IDs from launch profile `-mod=` and `-serverMod=`.
  - Also reads enabled numeric Workshop IDs from the mod table.
  - Uses AppID `221100`.
  - Downloads into `<DayZ parent>\Workshop`.
  - Copies updated mod folders into the DayZ server root.
  - Copies `.bikey` files into the server `keys` folder when available.
- Mod scan now includes numeric Workshop-ID folders, not only `@ModName` folders.
- Launch profile import registers numeric Workshop IDs in the mod table.
- Frontend Mod Manager now includes:
  - Update preflight.
  - Update DayZ Dedicated Server.
  - Update launch-profile mods.
  - Update job view.

## User-specific validated SteamCMD path

```powershell
& "C:\Server\dAYz\SteamCMD\steamcmd.exe" +force_install_dir "C:\Server\dAYz\DayZServer" +login anonymous +app_update 223350 validate +quit
```

## Safety rules

- The DayZ process must be stopped before server or mod updates.
- Dedicated server update and Workshop mod update are separate actions.
- Workshop updates do not edit `serverDZ.cfg`, `types.xml`, or mission files.
