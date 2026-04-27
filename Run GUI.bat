@echo off
setlocal

cd /d "%~dp0"
title ABetterNovelAuthoringEnvironment - GUI Launcher

set PORT=4310

echo ============================================================
echo   ABetterNovelAuthoringEnvironment
echo   One-Click GUI Launcher
echo ============================================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found on this machine.
  echo Install Node.js so the desktop host can run.
  echo.
  pause
  exit /b 1
)

if not exist package.json (
  echo [ERROR] package.json was not found in:
  echo %cd%
  echo.
  pause
  exit /b 1
)

echo [STEP] Starting desktop host on http://127.0.0.1:%PORT%
echo [INFO] Close this window or press Ctrl+C to stop the GUI host.
echo.

if /I not "%ABE_NO_BROWSER%"=="1" (
  start "" http://127.0.0.1:%PORT%
)

call npm run desktop
set GUI_EXIT=%ERRORLEVEL%
echo.

if "%GUI_EXIT%"=="0" (
  echo [INFO] Desktop host stopped normally.
) else (
  echo [ERROR] Desktop host exited with code %GUI_EXIT%.
)

echo.
pause
exit /b %GUI_EXIT%
