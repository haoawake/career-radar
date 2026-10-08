@echo off
setlocal
cd /d "%~dp0"
echo [Career Radar] Windows launcher
where node >nul 2>&1
if errorlevel 1 (
  echo Please install Node.js 22.13 or later: https://nodejs.org/
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo Node.js 22.13 or newer is required.
  pause
  exit /b 1
)
if not exist "node_modules\.package-lock.json" (
  echo Installing required dependencies on first launch...
  call npm ci
  if errorlevel 1 goto fail
)
echo Preparing local database...
call npx --no-install wrangler d1 migrations apply DB --local --config wrangler.local.json
if errorlevel 1 goto fail
echo Launching Career Radar. Open the local address shown below in your browser.
echo Press Ctrl+C to stop the server.
call npm run dev
pause
exit /b 0
:fail
echo Startup failed. Please review the error above.
pause
exit /b 1
