@echo off
setlocal EnableExtensions

cd /d "%~dp0"
title ABetterNovelAuthoringEnvironment - Live Server Host

set "PORT=4310"
set "ABE_NO_BROWSER=1"
set "ABE_LOG_PATH=%TEMP%\ABetterNovelAuthoringEnvironment-live\desktop.log"

echo ============================================================
echo   ABetterNovelAuthoringEnvironment
echo   Live Server Host
echo ============================================================
echo.
echo [STEP] Starting desktop host for Live Server mode on http://127.0.0.1:%PORT%
echo [INFO] Open apps/editor/public/index.html with Live Server in your editor.
echo [INFO] Logs are written outside the repo so Live Server should not keep reloading.
echo [INFO] Close this window or press Ctrl+C to stop the host.
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found on this machine.
  echo Install Node.js so the desktop host can run.
  echo.
  if /I not "%ABE_NO_PAUSE%"=="1" pause
  exit /b 1
)

call npm run desktop
set "LIVE_SERVER_HOST_EXIT=%ERRORLEVEL%"
echo.

if "%LIVE_SERVER_HOST_EXIT%"=="0" (
  echo [INFO] Desktop host stopped normally.
) else (
  echo [ERROR] Desktop host exited with code %LIVE_SERVER_HOST_EXIT%.
)

echo.
if /I not "%ABE_NO_PAUSE%"=="1" pause
exit /b %LIVE_SERVER_HOST_EXIT%
