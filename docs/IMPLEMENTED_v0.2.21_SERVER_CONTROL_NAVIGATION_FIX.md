# v0.2.21 Server Control Navigation Fix

## Scope

This release adds a dedicated runtime control page instead of relying on Dashboard quick actions only.

## Implemented

- New sidebar menu item: `Server Control`.
- Dedicated page for selected-server runtime control.
- Runtime actions:
  - Start
  - Stop
  - Restart + Backup
  - Force Stop / Kill Process
  - Refresh
- Runtime status cards:
  - Selected Server
  - Runtime Status
  - PID / Uptime
  - configured game port / port 2302 status
- Launch Params Preview panel.
- Copy Launch Command button for manual PowerShell testing.
- Process details:
  - status
  - PID
  - PID alive
  - last started
  - last stopped
  - log line count
- Start Preflight panel.
- Last Process Log panel.
- Backend control summary endpoint: `GET /api/servers/:id/control`.
- Local socket-table port check for configured DayZ game port.

## Design rule

The Dashboard remains a quick overview with quick actions. Full runtime control belongs to the dedicated `Server Control` page.

## Notes

This is intentionally separate from v0.2.20 updater work:

- v0.2.20: updater and test-center fixes.
- v0.2.21: server runtime control UI/navigation.
