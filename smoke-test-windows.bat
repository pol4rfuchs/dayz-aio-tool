@echo off
setlocal
cd /d %~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\run-logged.ps1" -Name smoke-test-windows -Script "%~dp0scripts\windows\smoke-test.ps1" %*
