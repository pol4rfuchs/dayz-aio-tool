@echo off
setlocal
cd /d %~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\run-logged.ps1" -Name doctor-windows -Script "%~dp0scripts\windows\doctor.ps1" %*
