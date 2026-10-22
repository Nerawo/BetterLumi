@echo off
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if errorlevel 1 (
 echo Please install Node.js LTS first.
 pause
 exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
 call npm.cmd install
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
call npm.cmd run dev -- --open
pause
