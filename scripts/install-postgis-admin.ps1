# Run as Administrator - installs PostGIS binaries into PostgreSQL 18
$ErrorActionPreference = "Stop"
$src = "$env:TEMP\postgis-pg18\postgis-pg18-binaries-3.6.4w64"
if (-not (Test-Path "$src\share\extension\postgis.control")) {
  $src = "$PSScriptRoot\..\runtime\postgis-pg18-binaries"
}
$pg = "C:\Program Files\PostgreSQL\18"

if (-not (Test-Path "$src\share\extension\postgis.control")) {
  Write-Error "PostGIS bundle not found at $src"
}

Write-Host "Installing PostGIS into $pg ..."
robocopy "$src\bin" "$pg\bin" /E /IS /IT /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
robocopy "$src\lib" "$pg\lib" /E /IS /IT /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
robocopy "$src\share" "$pg\share" /E /IS /IT /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

if (Test-Path "$pg\share\extension\postgis.control") {
  Write-Host "SUCCESS: postgis.control installed"
  exit 0
} else {
  Write-Error "FAILED: postgis.control not found after copy"
}
