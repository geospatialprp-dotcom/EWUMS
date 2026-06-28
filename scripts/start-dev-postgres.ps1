# Start EGIP with PostgreSQL (real data) — NOT the mock API

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot



Write-Host "Checking Docker Postgres..." -ForegroundColor Yellow

$pg = docker ps --filter "name=egip-postgres" --format "{{.Names}}" 2>$null

if (-not $pg) {

  Write-Host "Starting Postgres + Redis (docker-compose.dev.yml)..." -ForegroundColor Cyan

  docker compose -f "$root\docker-compose.dev.yml" up -d

  Start-Sleep -Seconds 5

} else {

  Write-Host "Postgres already running: $pg" -ForegroundColor Green

}



Write-Host "Ensuring division schema..." -ForegroundColor Yellow

Push-Location "$root\backend\api"

npm run setup:divisions

Pop-Location



Write-Host "Stopping mock/old API on port 3000..." -ForegroundColor Yellow

Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |

  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2



Write-Host "Starting NestJS API (PostgreSQL) on http://localhost:3000 ..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(

  '-NoExit', '-Command',

  "cd '$root\backend\api'; `$env:NODE_ENV='development'; npm run start:dev"

)



Start-Sleep -Seconds 8



Write-Host "Starting frontend on http://localhost:5173 ..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(

  '-NoExit', '-Command',

  "cd '$root\frontend\web'; npm run dev"

)



Write-Host ""

Write-Host "Open: http://localhost:5173/login" -ForegroundColor Green

Write-Host "API:  PostgreSQL (NestJS) — NOT dev:mock" -ForegroundColor Green

Write-Host "Login: admin@egip.local / Admin@123" -ForegroundColor Green

Write-Host ""

Write-Host "Your Postgres projects:" -ForegroundColor Cyan

Write-Host "  - Tharali Pinder Paar (Karanprayag)" -ForegroundColor Gray

Write-Host "  - Badhangarhi (Nainital)" -ForegroundColor Gray

Write-Host "  - Dwarahat Punargathan (Ranikhet)" -ForegroundColor Gray

Write-Host "  - Majhiyakhet (Bageshwar)" -ForegroundColor Gray

