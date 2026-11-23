@echo off
rem Updates Diwan Offers Studio from GitHub. Your weeks, settings and .env stay as they are.
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update.ps1"
set "ERR=%ERRORLEVEL%"
if not defined DIWAN_NOPAUSE pause
exit /b %ERR%
