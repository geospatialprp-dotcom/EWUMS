@echo off
title EGIP Application Launcher
echo ========================================
echo   Starting EGIP Application
echo ========================================
echo.

cd /d "%~dp0.."

echo [1/2] Starting API server...
start "EGIP API" cmd /k "cd /d %~dp0..\backend\api && npm run start:dev"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Frontend...
start "EGIP Frontend" cmd /k "cd /d %~dp0..\frontend\web && npm run dev"

echo.
echo ========================================
echo   EGIP is starting!
echo ========================================
echo   Frontend: http://localhost:5173
echo   API:      http://localhost:3000
echo   Login:    admin@egip.local / Admin@123
echo.
echo   Two terminal windows opened - keep them open.
echo ========================================
pause
