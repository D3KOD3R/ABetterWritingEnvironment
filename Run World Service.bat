@echo off
setlocal

cd /d "%~dp0"
call "%~dp0scripts\launch-worktree.bat" world-service 4313 "World Service" world-service
exit /b %ERRORLEVEL%
