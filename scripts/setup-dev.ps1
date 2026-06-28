# EGIP Development Setup Script (Windows PowerShell)

Write-Host "=== EGIP Development Setup ===" -ForegroundColor Cyan

# Start Docker services
Write-Host "`nStarting PostgreSQL, Redis, GeoServer..." -ForegroundColor Yellow
Set-Location $PSScriptRoot\..
docker compose up -d

Write-Host "`nWaiting for PostgreSQL..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Backend setup
Write-Host "`nInstalling backend dependencies..." -ForegroundColor Yellow
Set-Location backend\api
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install

# Frontend setup
Write-Host "`nInstalling frontend dependencies..." -ForegroundColor Yellow
Set-Location ..\..\frontend\web
npm install

Write-Host "`n=== Setup Complete ===" -ForegroundColor Green
Write-Host "Start backend:  cd backend\api && npm run start:dev"
Write-Host "Start frontend: cd frontend\web && npm run dev"
Write-Host "API docs:       http://localhost:3000/api/docs"
Write-Host "Web app:        http://localhost:5173"
Write-Host "Login:          admin@egip.local / Admin@123"
