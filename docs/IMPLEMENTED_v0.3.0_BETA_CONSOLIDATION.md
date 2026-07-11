# DayZ AIO v0.3.0-beta Consolidation Pack

This build consolidates the planned v0.2.22 through v0.2.25 roadmap into one beta-grade package.

## Included

### Crash Intelligence + Persistence Tools
- Crash scanner classifies common DayZ failure patterns:
  - `0x00020013` client/server build mismatch
  - `OnStoreLoad` / corrupted scripted variables
  - Access violation around persistence load
  - signature/key mismatch hints
  - missing PBO/addon/dependency hints
- Persistence Tools page actions:
  - scan `storage_N` folders
  - list quarantines
  - quarantine `storage_1` with copy + disabled rename
  - restore quarantine copy when active storage is absent

### Mod Dependency + Key Management
- Existing diagnostics retained and expanded workflow-ready.
- Key sync plan endpoint.
- Safe `.bikey` sync from enabled mod folders into `DayZServer\keys`.
- Creates `keys_BACKUP_<timestamp>` before copying when server keys already exist.

### Live Logs + RPT Tail
- New sidebar page: `Live Logs`.
- Runtime process buffer.
- Latest `.RPT`, `.ADM`, `.log`, script/crash file discovery.
- One-click file tail.

### RCON/Admin Panel
- Existing guarded RCON panel retained.
- Real BattlEye command execution remains disabled unless `DAYZ_AIO_BATTLEYE_RCON_ENABLED=true` is explicitly set.
- Allowlisted commands only.

## Beta Boundary

This is a feature consolidation build, not a final stable release. The safe workflows are intentionally conservative:

- No automatic destructive repair.
- Persistence quarantine requires stopped server.
- Key sync backs up existing keys first.
- RCON command execution is opt-in.

## Recommended Test Order

1. Start AIO.
2. Confirm version shows `v0.3.0-beta`.
3. Open `Server Control` and verify selected server.
4. Open `Crash Intelligence` and run scan.
5. Open `Mods` and run diagnostics + key sync plan.
6. Open `Live Logs` and verify log tails.
7. Only enable RCON command execution after credentials are verified on a test server.
