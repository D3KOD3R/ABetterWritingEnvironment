@echo off
setlocal

cd /d "%~dp0"
call "%~dp0scripts\launch-worktree.bat" voice-service 4312 "Voice Service" voice-service
exit /b %ERRORLEVEL%
