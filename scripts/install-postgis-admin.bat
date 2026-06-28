@echo off
:: Right-click -> Run as administrator
echo Installing PostGIS into PostgreSQL 18...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-postgis-admin.ps1"
if exist "C:\Program Files\PostgreSQL\18\share\extension\postgis.control" (
  echo PostGIS installed successfully.
) else (
  echo PostGIS install failed. Run this file as Administrator.
)
pause
