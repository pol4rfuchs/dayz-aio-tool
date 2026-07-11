@echo off
setlocal
cd /d %~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\run-logged.ps1" -Name start-production-windows -Script "%~dp0scripts\windows\start-production.ps1" %*
