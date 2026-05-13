@echo off
setlocal

cd /d "%~dp0"
call "%~dp0scripts\launch-worktree.bat" manuscript-shell 4311 "Manuscript Shell Worktree" manuscript-shell-worktree
exit /b %ERRORLEVEL%
