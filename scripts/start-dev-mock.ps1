# Start EGIP with MOCK API only (no PostgreSQL) — for offline demo only

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot



Write-Host "=== EGIP Mock API (NO real data) ===" -ForegroundColor Yellow

Write-Host "Your PostgreSQL projects will NOT appear. Use start-dev.ps1 instead." -ForegroundColor Red



$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if ($conn) {

  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue

  Start-Sleep -Seconds 2

}



Start-Process powershell -ArgumentList @(

  '-NoExit', '-Command',

  "cd '$root\backend\api'; npm run dev:mock"

)



Start-Sleep -Seconds 2



Start-Process powershell -ArgumentList @(

  '-NoExit', '-Command',

  "cd '$root\frontend\web'; npm run dev"

)

