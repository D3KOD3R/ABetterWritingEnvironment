@echo off
setlocal

cd /d "%~dp0"
title ABetterNovelAuthoringEnvironment - Test Runner

echo ============================================================
echo   ABetterNovelAuthoringEnvironment
echo   One-Click Test Runner
echo ============================================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found on this machine.
  echo Install Node.js so the repository test suite can run.
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

echo [STEP] Running unit tests...
echo.
call npm test
set TEST_EXIT=%ERRORLEVEL%
echo.

if "%TEST_EXIT%"=="0" (
  echo [PASS] All repository tests completed successfully.
) else (
  echo [FAIL] Test run finished with exit code %TEST_EXIT%.
)

echo.
pause
exit /b %TEST_EXIT%
