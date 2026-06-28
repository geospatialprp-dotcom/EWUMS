# Start EGIP with PostgreSQL (REAL DATA) — default dev script

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot



Write-Host "=== EGIP Dev (PostgreSQL) ===" -ForegroundColor Cyan

Write-Host "This uses your REAL database — NOT dev:mock" -ForegroundColor Green



Write-Host "Stopping anything on port 3000..." -ForegroundColor Yellow

$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if ($conn) {

  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue

  Start-Sleep -Seconds 2

}



Write-Host "Starting NestJS API (PostgreSQL)..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(

  '-NoExit', '-Command',

  "cd '$root\backend\api'; Write-Host 'EGIP PostgreSQL API' -ForegroundColor Green; npm run start:dev"

)



Start-Sleep -Seconds 10



Write-Host "Starting frontend..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(

  '-NoExit', '-Command',

  "cd '$root\frontend\web'; npm run dev"

)



Write-Host ""

Write-Host "Open: http://localhost:5173/login" -ForegroundColor Green

Write-Host "API check: http://localhost:3000/api/v1/health  (must show mode=postgresql)" -ForegroundColor Green

Write-Host "Login: admin@egip.local / Admin@123" -ForegroundColor Green

Write-Host ""

Write-Host "DO NOT run: npm run dev:mock  (fake data, not your projects)" -ForegroundColor Red

