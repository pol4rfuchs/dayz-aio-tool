@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\run-logged.ps1" -Name "install-service-windows" -Script "%~dp0scripts\windows\install-service.ps1" %*
