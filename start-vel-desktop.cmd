@echo off
cd /d "%~dp0"
if exist "..\desktop-build\v0.3.0-final\Vel Studio-win32-x64\Vel Studio.exe" (
  start "" "..\desktop-build\v0.3.0-final\Vel Studio-win32-x64\Vel Studio.exe"
  exit /b 0
)
if exist "..\desktop-build\v0.3.0\Vel Studio-win32-x64\Vel Studio.exe" (
  start "" "..\desktop-build\v0.3.0\Vel Studio-win32-x64\Vel Studio.exe"
  exit /b 0
)
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer, or use the prepared Windows portable application.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 exit /b 1
)
call npm run doctor
if errorlevel 1 exit /b 1
call npm run desktop
