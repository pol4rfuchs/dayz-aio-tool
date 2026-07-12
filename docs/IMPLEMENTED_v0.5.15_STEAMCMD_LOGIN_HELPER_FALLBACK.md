# v0.5.15 SteamCMD Login Helper Fallback

Fixes the SteamCMD login helper launch path after v0.5.14 still failed to open a visible SteamCMD window on some Windows setups.

## Problem

The backend attempted to launch the generated SteamCMD login helper through PowerShell/Start-Process. On some systems this did not open a visible window. When DayZ AIO runs as a Windows service, Session-0 isolation can also prevent interactive desktop windows completely.

## Changes

- Keep generating a real `.cmd` helper under `.dayz-aio-runtime/steamcmd-login/`.
- Also write a stable fallback launcher:
  - `.dayz-aio-runtime/steamcmd-login/open-steamcmd-login-last.cmd`
- Launch via `%ComSpec% /d /s /c start ...` instead of nested PowerShell quoting.
- Return deterministic fallback fields to the UI:
  - `scriptPath`
  - `manualOpenPath`
  - `manualCommand`
- UI now shows the fallback path/command when the automatic window launch does not visibly appear.

## Security

- No password field was added.
- No Steam password is stored.
- The user enters password and Steam Guard only inside SteamCMD.
- AIO only stores/uses the Steam username and SteamCMD cached session.

## Expected workflow

1. Select `Steam user/session`.
2. Enter Steam username.
3. Click `Open SteamCMD login`.
4. If a window does not appear, run the shown fallback helper manually:
   `.dayz-aio-runtime\steamcmd-login\open-steamcmd-login-last.cmd`
5. Re-run Update Preflight.
