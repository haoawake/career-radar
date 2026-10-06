@echo off
rem Career Radar launcher (Windows): double-click to start. The first run installs
rem dependencies and creates the local database. Close this window to stop the server.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js was not found. Install Node.js 22.13 or newer from https://nodejs.org and run this again. & start "" https://nodejs.org/zh-cn/download & pause & exit /b 1)
if not exist node_modules\.package-lock.json (
  echo Installing dependencies, the first run takes a few minutes...
  call npm ci || (echo Installing dependencies failed, check the network and try again. & pause & exit /b 1)
)
rem Applies only the migrations that are still missing; stdin from nul so wrangler does not wait for a confirmation
call npx wrangler d1 migrations apply DB --local --config wrangler.local.json <nul || (echo Preparing the local database failed, see the output above. & pause & exit /b 1)
call npm run dev
pause
