@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo Install Node.js 22 or newer first. & pause & exit /b 1)
if not exist "client\node_modules\.bin\vite.cmd" (
  call npm ci --prefix client
  if errorlevel 1 (pause & exit /b 1)
)
call npm start
if errorlevel 1 pause

