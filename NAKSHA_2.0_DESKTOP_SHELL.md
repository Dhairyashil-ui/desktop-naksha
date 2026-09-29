# NAKSHA 2.0 — DESKTOP SHELL ARCHITECTURE & RUNTIME SPECIFICATION
**Decoupled Multi-Process Desktop Platform: Tauri (Rust), React (TypeScript + Tailwind), FastAPI (Python), and Celery (Redis)**  
**Document Status:** FROZEN (Phase 4)  
**Parent Specifications:**  
- [NAKSHA_2.0_DATA_SPECIFICATION.md](file:///d:/surveynaksha/NAKSHA_2.0_DATA_SPECIFICATION.md) (10 Input Categories)  
- [NAKSHA_2.0_REQUIREMENT_ENGINE.md](file:///d:/surveynaksha/NAKSHA_2.0_REQUIREMENT_ENGINE.md) (Pre-Flight Validation Engine)  
- [NAKSHA_2.0_DATABASE_DESIGN.md](file:///d:/surveynaksha/NAKSHA_2.0_DATABASE_DESIGN.md) (PostgreSQL + PostGIS & MinIO/S3 Storage)  
- [NAKSHA_2.0_PROJECT_STRUCTURE.md](file:///d:/surveynaksha/NAKSHA_2.0_PROJECT_STRUCTURE.md) (Canonical Layout & 10 Input Types Virtualization)  

---

## 1. System Topology & Architectural Philosophy

### 1.1 The Responsive UI Paradigm
Land survey and 3D geospatial workflows involve computationally intensive operations:
- Generating dense point clouds via Structure-from-Motion (thousands of 45-megapixel UAV images).
- Filtering 500 million ground points from raw airborne LiDAR sweeps.
- Calculating topological polygon intersections across tens of thousands of cadastral parcels.
- Building multi-resolution Cloud Optimized GeoTIFF (COG) and 3D Tiles pyramids.

**Running heavy processing on the main UI thread or in a monolithic web runtime inevitably causes application freezing, UI stutter, and unresponsive interfaces.**

Naksha 2.0 decouples the desktop platform into **four isolated, specialized execution tiers**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          NAKSHA 2.0 DESKTOP ARCHITECTURE                               │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                        TIER 1: FRONTEND VIEWPORT                               │   │
│   │   • React 18 + TypeScript + Tailwind CSS                                       │   │
│   │   • MapLibre GL (2D WebGL Vector / Raster Basemap & Parcel Demarcation)        │   │
│   │   • Three.js (3D WebGL Point Cloud, Mesh & BIM IFC Model Rendering)            │   │
│   │   • 10 Clean Input Types Virtual Deck with Real-Time Pre-Flight Feedback       │   │
│   └──────────────────────────────────────┬─────────────────────────────────────────┘   │
│                                          │ IPC (Tauri Events & Async WebSockets)       │
│   ┌──────────────────────────────────────▼─────────────────────────────────────────┐   │
│   │                        TIER 2: TAURI NATIVE SHELL                              │   │
│   │   • Rust Native Runtime (Lightweight ~15MB footprint vs. 200MB+ Electron)      │   │
│   │   • OS Window Management, Native Menus & System File Dialogs                   │   │
│   │   • Sidecar Process Supervisor (Launches & monitors Python backend)            │   │
│   │   • Hardware Accelerated Webview2 Surface                                      │   │
│   └──────────────────────────────────────┬─────────────────────────────────────────┘   │
│                                          │ REST / JSON-RPC / WebSocket Streams         │
│   ┌──────────────────────────────────────▼─────────────────────────────────────────┐   │
│   │                   TIER 3: FASTAPI REST & STREAMING BACKEND                     │   │
│   │   • Python 3.12 + FastAPI + Uvicorn Async Server                               │   │
│   │   • Category Ingestion Router & Pre-Flight Requirement Engine                  │   │
│   │   • Spatial Queries against PostgreSQL 16 + PostGIS 3.4                        │   │
│   │   • MinIO / S3 Object Storage Gateway & Presigned URL Generator                │   │
│   │   • Asynchronous Job Dispatcher (Pushes tasks to Redis Broker)                 │   │
│   └──────────────────────────────────────┬─────────────────────────────────────────┘   │
│                                          │ Redis Queue (Pub/Sub & Task Broker)         │
│   ┌──────────────────────────────────────▼─────────────────────────────────────────┐   │
│   │                   TIER 4: DISTRIBUTED ASYNC WORKERS                            │   │
│   │   • Celery Worker Nodes (Multiprocessing Pools)                                │   │
│   │   • Heavy Compute: GDAL, PDAL, Laspy, OpenSfM, PyVista, Shapely                │   │
│   │   • Live Progress Streaming: Progress % & Log Traces back to WebSocket         │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Process Lifecycle & IPC Communication

### 2.1 Sidecar Supervisor (Rust)
The Tauri core (`src-tauri/src/main.rs`) manages the Python FastAPI backend as a managed sidecar child process:
1. **Bootstrapping:** Upon Tauri launch, Rust verifies port availability (`localhost:8000`), spawns the Python FastAPI process, and monitors its health check endpoint (`/health`).
2. **Heartbeat:** Rust polls the health endpoint every 5 seconds.
3. **Graceful Shutdown:** When the user closes the desktop window, Rust sends `SIGTERM` to the FastAPI backend and Celery workers, ensuring no orphaned processes or corrupt database locks remain.

### 2.2 IPC Data Contracts
- **Native OS Interactions:** Tauri IPC handles native folder picking, drag-and-drop file path resolution, and window state persistence.
- **Data & Virtual Input Queries:** The React frontend communicates with FastAPI via standard high-speed HTTP/JSON endpoints.
- **Live Pipeline Telemetry:** Long-running Celery jobs push progress (e.g. `{"jobId": "...", "progress": 64.2, "step": "Point Cloud Tiling"}`) via Redis Pub/Sub through FastAPI WebSockets directly to the React status deck.

---

## 3. Directory Layout of the Desktop Application

```
surveynaksha/
├── package.json                         # Node dependencies (React, MapLibre, Three, Tailwind)
├── vite.config.ts                       # Vite bundler with Tauri integration
├── tsconfig.json                        # TypeScript compiler config
├── tailwind.config.js                   # Modern styling & design system
├── postcss.config.js                    # PostCSS plugins
│
├── src/                                 # Tier 1: Frontend Application
│   ├── main.tsx                         # React entry point
│   ├── App.tsx                          # Master desktop shell layout
│   ├── index.css                        # Tailwind & custom scrollbar / theme CSS
│   ├── components/
│   │   ├── Header.tsx                   # Project title, Accuracy tier & CRS selector
│   │   ├── Viewport2D3D.tsx             # Dual MapLibre (2D) & Three.js (3D) viewport
│   │   ├── InputDeck.tsx                # The 10 Input Types visual cards container
│   │   ├── InputCard.tsx                # Individual Category card with status badge
│   │   ├── PreflightModal.tsx           # Deep Requirement Engine inspect & remediation
│   │   └── JobMonitor.tsx               # Active background processing progress bar
│   ├── types/
│   │   └── naksha.ts                    # TypeScript types conforming to Specs 0, 1, 2, 3
│   └── services/
│       └── api.ts                       # Axios / Fetch client connecting to FastAPI
│
├── src-tauri/                           # Tier 2: Desktop Native Shell
│   ├── Cargo.toml                       # Rust dependencies (tauri, serde, reqwest)
│   ├── tauri.conf.json                  # Window size, title, permissions, sidecar config
│   └── src/
│       └── main.rs                      # Rust application entry, sidecar supervisor
│
├── backend/                             # Tier 3 & Tier 4: Backend & Celery
│   ├── requirements.txt                 # Python dependencies
│   ├── main.py                          # FastAPI server & WebSocket dispatch
│   ├── celery_app.py                    # Celery configuration & Redis connection
│   ├── tasks/
│   │   ├── photogrammetry.py            # SfM dense reconstruction worker
│   │   ├── lidar.py                     # Point cloud tiling (COPC) & bare earth
│   │   └── vector.py                    # Cadastral topology & ULPIN validation
│   └── config.py                        # Database, S3/MinIO & Redis URLs
│
├── schema.sql                           # PostgreSQL + PostGIS schema (Phase 2)
├── project_engine.py                    # Canonical project manager (Phase 3)
└── NAKSHA_2.0_*.md                      # Specifications
```

---

## 4. Frontend Viewport Specification (Dual 2D/3D Canvas)

The center workspace features a seamless toggle between:
1. **2D MapLibre WebGL Viewport:**
   - Vector parcel boundaries (`parcels` table via Vector Tiles / GeoJSON).
   - High-resolution orthomosaic basemaps (COG raster tiles).
   - Ground Control Point monuments and survey marks.
2. **3D Three.js Viewport:**
   - 3D Point cloud rendering (LAS/LAZ streaming via WebGL point primitives).
   - 3D Architectural / BIM IFC structures with floor slicing.
   - Elevation DTM terrain wireframe with hillshading and contour ribbons.

---

## 5. Implementation Readiness & Phase Gate

This specification is **FROZEN** as the foundational schema for:
- Building the complete React + TypeScript + Tailwind frontend
- Building the Tauri Rust configuration and main entry point
- Building the Python FastAPI backend and Celery worker system
