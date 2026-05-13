@echo off
setlocal EnableExtensions

set "PORT=%~1"
set "WINDOW_TITLE=%~2"
set "SANDPIT_SLUG=%~3"

if "%PORT%"=="" (
  echo [ERROR] Port was not provided.
  exit /b 1
)

if "%WINDOW_TITLE%"=="" (
  set "WINDOW_TITLE=Manuscript Shell"
)

if "%SANDPIT_SLUG%"=="" (
  set "SANDPIT_SLUG=manuscript-shell"
)

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"

cd /d "%REPO_ROOT%" || (
  echo [ERROR] Could not change directory to:
  echo %REPO_ROOT%
  echo.
  if /I not "%ABE_NO_PAUSE%"=="1" pause
  exit /b 1
)

title ABetterNovelAuthoringEnvironment - Abe Sandpit "%WINDOW_TITLE%"

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found on this machine.
  echo Install Node.js so the desktop host can run.
  echo.
  if /I not "%ABE_NO_PAUSE%"=="1" pause
  exit /b 1
)

if not exist package.json (
  echo [ERROR] package.json was not found in:
  echo %cd%
  echo.
  if /I not "%ABE_NO_PAUSE%"=="1" pause
  exit /b 1
)

echo ============================================================
echo   ABetterNovelAuthoringEnvironment
echo   %WINDOW_TITLE%
echo ============================================================
echo.
echo [STEP] Starting desktop host on http://127.0.0.1:%PORT%
echo [INFO] Close this window or press Ctrl+C to stop the host.
echo.

if /I not "%ABE_NO_BROWSER%"=="1" (
  start "" "http://127.0.0.1:%PORT%/?sandpit=%SANDPIT_SLUG%"
)

call npm run desktop
set "LAUNCH_EXIT=%ERRORLEVEL%"
echo.

if "%LAUNCH_EXIT%"=="0" (
  echo [INFO] Desktop host stopped normally.
) else (
  echo [ERROR] Desktop host exited with code %LAUNCH_EXIT%.
)

echo.
if /I not "%ABE_NO_PAUSE%"=="1" pause
exit /b %LAUNCH_EXIT%
