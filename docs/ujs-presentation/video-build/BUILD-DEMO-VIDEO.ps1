# Build EWUMS Hindi client demo MP4 on your Windows PC.
# Output: docs\ujs-presentation\video-build\output\EWUMS-Client-Demo-7min-Hindi-v1.mp4
#
# Usage (PowerShell, from repo root or this folder):
#   cd docs\ujs-presentation\video-build
#   .\BUILD-DEMO-VIDEO.ps1
#
# Options:
#   .\BUILD-DEMO-VIDEO.ps1 -AudioOnly     # Fast — title cards + Hindi voice (no browser)
#   .\BUILD-DEMO-VIDEO.ps1 -WithScreen     # Full — records ewumsujs.com + voice (slower)

param(
    [switch]$AudioOnly,
    [switch]$WithScreen,
    [string]$BaseUrl = "https://ewumsujs.com"
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$OutDir = Join-Path $Root "output"
$FinalVideo = Join-Path $OutDir "EWUMS-Client-Demo-7min-Hindi-v1.mp4"

Write-Host "=== EWUMS Client Demo Video Builder ===" -ForegroundColor Cyan
Write-Host "Output folder: $OutDir`n"

# --- ffmpeg ---
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "ffmpeg not found. Installing via winget..." -ForegroundColor Yellow
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: Install ffmpeg manually: https://ffmpeg.org/download.html" -ForegroundColor Red
        exit 1
    }
}

# --- Python ---
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) { $python = "py -3" } else {
        Write-Host "ERROR: Python 3 required. Install from python.org" -ForegroundColor Red
        exit 1
    }
} else {
    $python = "python"
}

# Step 1 — Hindi narration audio
Write-Host "`n[1/3] Generating Hindi narration (edge-tts)..." -ForegroundColor Green
Push-Location $Root
& $python generate-audio.py
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }

# Step 2 — Optional screen recording
if ($WithScreen -and -not $AudioOnly) {
    Write-Host "`n[2/3] Recording screen from $BaseUrl (Playwright)..." -ForegroundColor Green
    if (-not (Test-Path (Join-Path $Root "node_modules"))) {
        npm install
        npx playwright install chromium
    }
    $env:DEMO_BASE_URL = $BaseUrl
    node record-screen.mjs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Screen recording failed — building audio + title cards only." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[2/3] Skipping screen capture (use -WithScreen for live app footage)." -ForegroundColor Yellow
}

# Step 3 — Assemble MP4
Write-Host "`n[3/3] Assembling final MP4..." -ForegroundColor Green
& $python assemble-video.py
$code = $LASTEXITCODE
Pop-Location

if ($code -eq 0 -and (Test-Path $FinalVideo)) {
    Write-Host "`nSUCCESS — Video on your computer:" -ForegroundColor Green
    Write-Host "  $FinalVideo" -ForegroundColor White
    Write-Host "`nOpen folder:" -ForegroundColor Cyan
    explorer.exe /select,"$FinalVideo"
} else {
    Write-Host "`nBuild failed. See errors above." -ForegroundColor Red
    exit 1
}
