# ── Naksha 2.0 Local Desktop Packager ──
# Packages the compiled Tauri executable and assets into a clean distributable release zip

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Naksha 2.0 Desktop Release Packager     " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$distDir = "dist-desktop"
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}

# Locate compiled executable (Release or Debug)
$exePath = "src-tauri\target\release\Naksha 2.0.exe"
if (-not (Test-Path $exePath)) {
    $exePath = "src-tauri\target\debug\Naksha 2.0.exe"
}

if (-not (Test-Path $exePath)) {
    Write-Host "[ERROR] Could not find compiled Naksha 2.0.exe. Run 'npm run tauri build' first." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Copying executable: $exePath" -ForegroundColor Green
Copy-Item $exePath "$distDir\Naksha 2.0.exe" -Force

# Copy logo and documentation
Copy-Item "image.png" "$distDir\app-logo.png" -Force -ErrorAction SilentlyContinue

# Create Readme for end users
$readmeContent = @"
======================================================
  Naksha 2.0 Desktop -- Land Survey & Cadastre System
======================================================

HOW TO RUN:
1. Double-click "Naksha 2.0.exe" to launch the desktop platform.
2. The desktop shell automatically bridges to your local Python engine
   or can connect to your remote cloud backend on Render.
3. For cloud connectivity, set your Render API URL in the header status indicator.

Requirements:
- Windows 10/11 (64-bit)
- Microsoft Edge WebView2 (pre-installed on modern Windows)
"@
Set-Content -Path "$distDir\README.txt" -Value $readmeContent

# Look for MSI bundle if generated (prefer release)
$msiPath = "src-tauri\target\release\bundle\msi\Naksha 2.0_2.0.0_x64_en-US.msi"
if (-not (Test-Path $msiPath)) {
    $msiPath = "src-tauri\target\debug\bundle\msi\Naksha 2.0_2.0.0_x64_en-US.msi"
}
if (Test-Path $msiPath) {
    Write-Host "[INFO] Found installer: $msiPath" -ForegroundColor Green
    Copy-Item $msiPath "$distDir\" -Force
}

# Look for NSIS setup exe bundle if generated (prefer release)
$nsisPath = "src-tauri\target\release\bundle\nsis\Naksha 2.0_2.0.0_x64-setup.exe"
if (-not (Test-Path $nsisPath)) {
    $nsisPath = "src-tauri\target\debug\bundle\nsis\Naksha 2.0_2.0.0_x64-setup.exe"
}
if (Test-Path $nsisPath) {
    Write-Host "[INFO] Found NSIS setup: $nsisPath" -ForegroundColor Green
    Copy-Item $nsisPath "$distDir\" -Force
}

# Create zip archive using Python's streaming zipfile
$zipPath = "dist-desktop\Naksha-2.0-Windows-x64.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Write-Host "[INFO] Creating distribution zip: $zipPath" -ForegroundColor Yellow

$tempZipDir = "$env:TEMP\naksha_dist_temp"
if (Test-Path $tempZipDir) { Remove-Item -Recurse -Force $tempZipDir }
New-Item -ItemType Directory -Path $tempZipDir | Out-Null
Copy-Item "$distDir\*" $tempZipDir -Recurse -Force

python -c "
import shutil, os
shutil.make_archive(r'dist-desktop/Naksha-2.0-Windows-x64', 'zip', r'$tempZipDir')
"
Remove-Item -Recurse -Force $tempZipDir -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "[SUCCESS] Desktop package ready at: $distDir" -ForegroundColor Green
Write-Host "You can upload 'Naksha-2.0-Windows-x64.zip' or the .msi installer to your online download link!" -ForegroundColor Cyan
