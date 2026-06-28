# Start EGIP Database (PostgreSQL + Redis + GeoServer)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Host "Docker is not installed." -ForegroundColor Red
  Write-Host ""
  Write-Host "Install Docker Desktop from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
  Write-Host "Then run this script again." -ForegroundColor Yellow
  exit 1
}

Write-Host "Starting PostgreSQL, Redis, GeoServer..." -ForegroundColor Cyan
docker compose up -d

Write-Host ""
Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

docker compose ps
Write-Host ""
Write-Host "Database should be ready on localhost:5432" -ForegroundColor Green
Write-Host "User: egip  Password: egip_secret  Database: egip" -ForegroundColor Green
