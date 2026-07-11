# Implemented v0.3.3 — Workshop Synchronization

## Scope

v0.3.3 splits update operations into two visible, separate sidebar pages:

- **Server Updater** for DayZ Dedicated Server AppID `223350`
- **Mod Updater** for DayZ Workshop AppID `221100`

This avoids mixing server binary updates with Workshop/mod synchronization.

## Server Updater

- Dedicated sidebar entry: `Server Updater`
- Shows current `DayZServer_x64.exe` snapshot:
  - path
  - file/product version
  - last write time
  - size
- Shows Steam app manifest summary:
  - `buildid`
  - `StateFlags`
  - `LastUpdated`
- Runs dedicated server update through SteamCMD.
- Supports Steam login username without storing passwords.
- Keeps v0.3.1/v0.3.2 update verification:
  - SteamCMD output parsing
  - `No subscription` detection
  - `Timed out waiting for update to start` detection
  - EXE changed/version verification before success.

## Mod Updater

- Dedicated sidebar entry: `Mod Updater`
- Uses Workshop AppID `221100`.
- Supports Steam login username without storing passwords.
- Reuses SteamCMD Steam Guard/session cache.
- Updates all Workshop IDs detected from:
  - launch profile `-mod=`
  - launch profile `-serverMod=`
  - mod table `workshop_id`
  - numeric Workshop-ID folder names
- Copies downloaded Workshop content from staging to the server root.
- Copies `.bikey` files into the server `keys` folder when available.

## Workshop Sync Report

New backend endpoint:

```text
GET /api/servers/:serverId/updates/workshop-sync-report
```

The report compares:

- Launch profile Workshop IDs
- Mod table Workshop IDs
- Server root mod folders
- SteamCMD Workshop staging folders
- `.bikey` presence and server-key sync state
- Expansion-related PBO/name hints

Flags include:

- `missing_server_folder`
- `missing_staging_download`
- `staging_newer_than_server`
- `mod_has_no_bikey`
- `server_keys_not_synced`
- `expansion_related`

This directly targets join errors such as `0x00040092 Data verification failed` for `DayZ-Expansion-Bundle`.

## Staging Sync

New backend endpoint:

```text
POST /api/servers/:serverId/updates/workshop-sync-from-staging
```

Copies already-downloaded Workshop content from:

```text
<workshopStagingRoot>\steamapps\workshop\content\221100\<workshopId>
```

to:

```text
<serverRoot>\<workshopId>
```

The server must be stopped.

## Build validation

- Backend TypeScript build passed.
- Frontend TypeScript/Vite build passed.
- Shared package TypeScript build passed.
