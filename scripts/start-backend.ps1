# Start EGIP Backend API
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location "$root\backend\api"

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "Created .env from .env.example" -ForegroundColor Yellow
}

if (-not (Test-Path node_modules)) {
  Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
  npm install
}

Write-Host "Starting EGIP API on http://localhost:3000 ..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
npm run start:dev
