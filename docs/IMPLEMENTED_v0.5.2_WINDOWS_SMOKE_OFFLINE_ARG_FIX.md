# v0.5.2 — Windows Smoke Offline Argument Fix

## Problem

`windows-installer-smoke.yml` called:

```cmd
smoke-test-windows.bat -Offline
```

Through the `cmd -> batch -> run-logged.ps1 -> smoke-test.ps1` wrapper chain, `-Offline` could arrive as the first positional argument instead of binding to the PowerShell `[switch]$Offline` parameter. The smoke test then treated `-Offline` as the API base URL and failed with:

```text
Invalid API base URI '-Offline'. Use an absolute URI such as http://localhost:8090.
```

## Fix

`smoke-test.ps1` now normalizes this forwarded form before URI validation:

```powershell
if ($Api -ieq "-Offline") {
  $Offline = $true
  $Api = "http://localhost:8090"
}
```

This preserves normal API smoke usage while making the offline CI invocation safe.

## Validation target

The Windows Installer Smoke Test now checks installer/build/doctor/offline artifacts without trying to parse `-Offline` as an HTTP URI.
