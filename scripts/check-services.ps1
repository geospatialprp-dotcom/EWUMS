Write-Host "=== EGIP Service Check ===" -ForegroundColor Cyan

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) { Write-Host "[OK] Node.js: $(node -v)" -ForegroundColor Green }
else { Write-Host "[MISSING] Node.js not in PATH" -ForegroundColor Red }

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) { Write-Host "[OK] Docker CLI found" -ForegroundColor Green }
else { Write-Host "[MISSING] Docker not installed or not in PATH" -ForegroundColor Red }

function Test-Port($port, $name) {
  $hit = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
  if ($hit) { Write-Host "[OK] $name listening on port $port" -ForegroundColor Green }
  else { Write-Host "[DOWN] $name NOT running on port $port" -ForegroundColor Red }
}

Test-Port 5173 "Frontend (Vite)"
Test-Port 3000 "Backend API"
Test-Port 5432 "PostgreSQL"

Write-Host ""
Write-Host "Login requires ALL THREE services:" -ForegroundColor Yellow
Write-Host "  1. PostgreSQL on 5432  -> docker compose up -d"
Write-Host "  2. Backend API on 3000 -> cd backend\api; npm run start:dev"
Write-Host "  3. Frontend on 5173    -> cd frontend\web; npm run dev"
Write-Host ""
Write-Host "Demo login: admin@egip.local / Admin@123" -ForegroundColor Cyan
