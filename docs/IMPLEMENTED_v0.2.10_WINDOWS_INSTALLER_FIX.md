# DayZ AIO v0.2.10 — Windows Installer Fix Pack

## Fixed

- Replaced `RandomNumberGenerator.Fill()` with a Windows PowerShell-compatible RNG implementation.
- Added isolated npm cache under `.dayz-aio-runtime/npm-cache`.
- Added npm install retry after local cache cleanup.
- Added npm debug-log tail output on installer failure.
- Added explicit npm/node path logging during install.
- Avoided brittle PowerShell native-command error handling around npm output.

## Why

Some Windows PowerShell/.NET combinations do not expose `RandomNumberGenerator.Fill()`. Also, npm may crash with `Exit handler never called!` when using a corrupted/global npm cache. The installer now isolates npm cache per project and prints useful diagnostics.
