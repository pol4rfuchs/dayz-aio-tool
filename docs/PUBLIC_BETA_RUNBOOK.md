# DayZ AIO Public Beta Runbook

## Standard update order

1. Stop the DayZ server.
2. Create a backup/snapshot.
3. Run Server Updater.
4. Verify `DayZServer_x64.exe` version and timestamp.
5. Run Mod Updater with Steam login.
6. Sync staging to server.
7. Sync keys.
8. Start server.
9. Join-test with one client.
10. Check Live Logs and Crash Monitor.

## Common errors

### `0x00020013`

Client/server build mismatch. Run Server Updater with Steam login and verify `DayZServer_x64.exe`.

### `0x00040092`

Data verification / mod PBO mismatch. Run Mod Updater with Steam login, sync staging to server, then sync keys.

### `No subscription`

SteamCMD entitlement/auth problem. Use Steam login, not anonymous.

### `Timed out waiting for update to start`

SteamCMD did not actually start a useful update. Treat as failed even if a later `Success!` line appears.

### `Access Denied` for Workshop AppID `221100`

Protected Workshop content. Use Steam login with an account that owns/has access to DayZ and subscribed Workshop items.
