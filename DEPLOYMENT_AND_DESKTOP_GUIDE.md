# Naksha 2.0 — Desktop Shell, Render Cloud Deployment & Download Guide

This document outlines the complete setup for **Naksha 2.0**:
1. Official Application Logo & Desktop Icons
2. Tauri Windows Desktop App & Installers (`.msi`, `.exe`, portable)
3. Online Download Link Distribution (GitHub Releases & Cloud Hosting)
4. FastAPI Backend Deployment on Render Cloud

---

## 1. Official Logo & App Icon System

The logo provided in `image.png` has been processed and integrated across all platforms:

| Target | File Path | Description |
| :--- | :--- | :--- |
| **Desktop Master Icon** | `src-tauri/icons/icon-master.png` | 1024x1024 high-resolution squircle icon with Obsidian cadastral backdrop |
| **Windows App Icon** | `src-tauri/icons/icon.ico` | Multi-resolution icon (16, 24, 32, 48, 64, 128, 256 px) for Windows taskbar & explorer |
| **macOS App Icon** | `src-tauri/icons/icon.icns` | High-DPI icon for Apple macOS dock & Finder |
| **Web Favicon** | `public/favicon.ico` & `public/favicon.png` | Browser tab icon for web application |
| **Web Logo** | `public/logo.png` | Clean SVG/PNG asset served at `/logo.png` |
| **UI Header** | `src/components/survey/SurveyHeader.tsx` | Interactive brand header with official logo & version badge |

---

## 2. Desktop Application (Tauri Shell)

The desktop application is built with **Tauri 1.8** and **Rust 1.98**, wrapping the modern React 18 UI with native Windows capabilities:
- **Embedded Python Supervisor**: Automatically checks `http://127.0.0.1:8000/health`, spawns `uvicorn backend.main:app` if offline, and cleanly terminates child processes on app close.
- **Native File System & Dialogs**: Fast local directory picking for survey packages and point clouds.
- **Hardware-Accelerated 3D Viewport**: Native WebView2 GPU rendering for Three.js 3D cadastral models.

### Generated Desktop Installers:
All bundles are located in `dist-desktop/`:

1. **`Naksha 2.0_2.0.0_x64-setup.exe`**: Modern NSIS Windows Setup Wizard (recommended for end users).
2. **`Naksha 2.0_2.0.0_x64_en-US.msi`**: Enterprise WiX Windows Installer (ideal for system administrators & enterprise rollout).
3. **`Naksha 2.0.exe`**: Portable standalone executable (no installation required).
4. **`Naksha-2.0-Windows-x64.zip`**: Complete distribution zip ready for online upload.

### Building Locally:
```powershell
# Rebuild frontend and package release desktop bundles:
npm run tauri build

# Or generate distributable zip package:
.\package-desktop-release.ps1
```

---

## 3. Online Download Link Setup

You can host your installers online with direct download links using either **GitHub Releases** (recommended, 100% free with automated CI/CD) or cloud hosting:

### Option A: Automated GitHub Releases (Recommended)
A GitHub Actions workflow is included at `.github/workflows/desktop-release.yml`.

Whenever you push a tag:
```bash
git tag v2.0.0
git push origin v2.0.0
```
GitHub Actions will automatically:
1. Build the Tauri application on a Windows runner.
2. Produce both `.msi` and `.exe` installers.
3. Publish them to GitHub Releases.

Your users can then download directly via permanent URLs:
- **Installer URL**: `https://github.com/<YOUR_GITHUB_USER>/surveynaksha/releases/latest/download/Naksha-2.0_2.0.0_x64-setup.exe`
- **MSI URL**: `https://github.com/<YOUR_GITHUB_USER>/surveynaksha/releases/latest/download/Naksha-2.0_2.0.0_x64_en-US.msi`

### Option B: Cloud Storage / CDN
Upload `dist-desktop/Naksha-2.0-Windows-x64.zip` or `Naksha 2.0_2.0.0_x64-setup.exe` directly to:
- **Cloudflare R2 / AWS S3**: Fast global CDN download links.
- **Google Drive / Dropbox**: Shareable link for surveyor field teams.

---

## 4. Backend Deployment on Render Cloud

The FastAPI backend is fully containerized and configured for Render.

### Render Configuration Files:
- **`Dockerfile`**: Debian Bookworm base with GDAL, PROJ, and headless 3D libraries.
- **`render.yaml`**: Infrastructure-as-code Blueprint for 1-click deployment.
- **`backend/requirements.txt`**: Complete production dependencies.

### Step-by-Step Render Deployment:

1. **Push your code to GitHub / GitLab**.
2. **Log into Render** ([render.com](https://render.com)).
3. Click **New +** -> **Blueprint**.
4. Select your `surveynaksha` repository.
5. Render will detect `render.yaml` and configure:
   - **Service Name**: `surveynaksha-backend`
   - **Environment**: `Docker`
   - **Health Check Path**: `/health`
   - **Port**: `10000`
6. Click **Apply**.
7. Once deployed, Render will provide your public API URL:
   `https://surveynaksha-backend.onrender.com`

---

## 5. Connecting Desktop App to Render Backend

You can connect Naksha 2.0 to your live Render backend in any of the following ways:

### Method 1: In-App UI Switcher (No Rebuild Required)
1. Open Naksha 2.0 Desktop.
2. In the top-right header, click the **LOCAL ENGINE / RENDER CLOUD** button.
3. Enter your Render URL (e.g. `https://surveynaksha-backend.onrender.com`).
4. Click **Test** to verify connection latency & status.
5. Click **Save & Connect**. The app will reload and immediately use the Render cloud!

### Method 2: Build-Time Environment Variable
Set `VITE_BACKEND_URL` in your `.env` before building:
```env
VITE_BACKEND_URL=https://surveynaksha-backend.onrender.com
```
Then run:
```powershell
npm run tauri build
```
The desktop app will now default to your Render backend out of the box!
