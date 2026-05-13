@echo off
setlocal

cd /d "%~dp0"
call "%~dp0Run Manuscript Shell.bat"
exit /b %ERRORLEVEL%
