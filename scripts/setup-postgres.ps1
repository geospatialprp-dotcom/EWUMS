# Setup EGIP database on locally installed PostgreSQL (Windows)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

Write-Host "=== EGIP PostgreSQL Setup ===" -ForegroundColor Cyan

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  $defaultPsql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
  if (Test-Path $defaultPsql) { $psql = $defaultPsql }
  else {
    Write-Host "psql not found. Use pgAdmin and follow docs\POSTGRES-WINDOWS-SETUP.md" -ForegroundColor Red
    exit 1
  }
} else {
  $psql = $psql.Source
}

Write-Host "Using: $psql" -ForegroundColor Gray
Write-Host ""
Write-Host "You will be prompted for the postgres superuser password." -ForegroundColor Yellow
Write-Host ""

& $psql -U postgres -d postgres -f "$root\database\setup\01_create_database.sql"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Note: If user/database already exists, continue to extensions step." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Enabling extensions on database 'egip'..." -ForegroundColor Yellow
& $psql -U postgres -d egip -f "$root\database\setup\02_enable_extensions.sql"

Write-Host ""
Write-Host "Loading schema..." -ForegroundColor Yellow
& $psql -U egip -d egip -f "$root\database\migrations\001_platform_schema.sql"
Write-Host "Loading seed data..." -ForegroundColor Yellow
& $psql -U egip -d egip -f "$root\database\migrations\002_seed_data.sql"

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "Start backend: cd backend\api && npm run start:dev"
Write-Host "Login: admin@egip.local / Admin@123"
