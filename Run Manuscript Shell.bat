@echo off
setlocal

cd /d "%~dp0"
call "%~dp0scripts\launch-root.bat" 4310 "Manuscript Shell" manuscript-shell
exit /b %ERRORLEVEL%
