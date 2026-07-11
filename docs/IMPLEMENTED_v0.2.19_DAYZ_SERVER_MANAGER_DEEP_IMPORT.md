# v0.2.19 DayZ Server Manager Deep Import

## Implemented

- Comment-tolerant scan of `server-manager.json` and `baseserver-manager.json`.
- Imports `steamWsMods[]` as DayZ `-mod=` entries.
- Imports `steamWsServerMods[]` as DayZ `-serverMod=` entries.
- Accepts numeric Workshop-ID folders in the server root, not only `@ModName` folders.
- Scans shallow legacy manager script locations such as `server_manager/Server_manager.ps1`.
- Detects legacy PowerShell launch pattern using `modServerPar.txt` and `serverModServerPar.txt`.
- Generates launch params with config, mods, server mods, BattlEye path, profile path, port, and supported startup flags.
- Adds source/hint metadata for import preview.
- Adds an import action for existing saved servers in the Server Config UI.

## Safety behavior

The Start preflight still blocks Expansion/modded servers when no `-mod=` entry is present. After a successful manager import, the block should clear and any remaining issues should be regular warnings, such as missing backup or profile-path review notes.
