# v0.5.18 Server Update Up-To-Date Verification

Fixes the DayZ server updater result classification for the common SteamCMD case where SteamCMD exits successfully and prints `Success! App '223350' fully installed.`, but `DayZServer_x64.exe` is unchanged because the server was already current.

## Changes

- Treat unchanged `DayZServer_x64.exe` as success when SteamCMD reports a successful app install/verify.
- New verification reason: `dayz_server_already_current`.
- Manifest-only changes can be classified as `dayz_server_manifest_updated`.
- Keep hard failures strict for no subscription, access denied, Steam Guard/auth failures, disk write errors, no connection, non-zero exit code.
- Update progress UI no longer renders neutral successful verification reasons as warning alerts.

## Why

SteamCMD can fully validate an already-current DayZ Dedicated Server without changing the executable timestamp/version. The previous verifier treated that as `dayz_server_exe_unchanged_after_update` and failed the job even though SteamCMD succeeded.
