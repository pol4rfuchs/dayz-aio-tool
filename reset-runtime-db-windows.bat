@echo off
setlocal
cd /d %~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\run-logged.ps1" -Name reset-runtime-db-windows -Script "%~dp0scripts\windows\reset-runtime-db.ps1" %*
