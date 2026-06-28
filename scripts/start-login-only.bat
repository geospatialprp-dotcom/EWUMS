@echo off
echo ========================================
echo  EGIP Quick Login (NO Docker required)
echo ========================================
echo.
cd /d "%~dp0..\backend\api"
echo Starting mock API on http://localhost:3000 ...
echo Login: admin@egip.local / Admin@123
echo.
echo Keep this window OPEN while using the app.
echo Press Ctrl+C to stop.
echo.
node dev-server.js
