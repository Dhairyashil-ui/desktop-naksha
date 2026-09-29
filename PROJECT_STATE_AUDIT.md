# PROJECT_STATE_AUDIT.md
## Naksha 2.0 — Complete Technical State Audit
**Audit Date:** 2026-09-29 | **Auditor:** Antigravity AI (Code Inspection)  
**Purpose:** Provide another AI with exact truth about what is implemented, mocked, partial, or missing.

---

## 1. PROJECT OVERVIEW

| Item | Value |
|------|-------|
| **Project name** | Naksha 2.0 — Land Survey & Cadastral Intelligence |
| **Purpose** | Desktop application for 3D cadastral demarcation: ingest survey data (LiDAR, photogrammetry, GIS, GNSS), process into 3D property model, match with government records, generate statutory deliverable packages |
| **Desktop framework** | Tauri 1.x (Rust + Webview) — NOT actively compiled/used in dev; UI runs as plain web app on port 5173 |
| **Frontend framework** | React 18 + TypeScript 5.4 |
| **Backend framework** | FastAPI (Python 3.12) |
| **Programming languages** | TypeScript/TSX (frontend), Python 3.12 (backend), Rust (Tauri shell, skeleton only) |
| **Build tools** | Vite 5.1.6 (frontend), uvicorn (backend ASGI server) |
| **Package managers** | npm (frontend), pip (Python packages — no virtualenv/pyproject.toml present) |
| **Frontend entry point** | src/main.tsx -> src/App.tsx |
| **Backend entry point** | backend/main.py |

### Commands to Run the Project

```bash
# Terminal 1 — Frontend (Vite dev server)
npm run dev                        # starts http://localhost:5173

# Terminal 2 — Backend (must be started manually)
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Tauri desktop (NOT currently functional — Tauri CLI not compiled)
# npm run tauri dev

# Database migration (applies schema.sql to Supabase)
python backend/migrate.py

# Celery worker (NOT currently running — no Redis running locally)
# celery -A backend.celery_app worker --loglevel=info
```

> **IMPORTANT:** The app is currently used as a pure **web app at http://localhost:5173**. The Tauri desktop wrapper is defined in code but not actively compiled or launched.

---

## 2. COMPLETE PROJECT TREE

```
d:/surveynaksha/
├── index.html                        # Vite entry HTML
├── vite.config.ts                    # Vite config, port 5173, Tauri env prefix
├── tsconfig.json                     # TypeScript config
├── tailwind.config.js                # TailwindCSS config
├── package.json                      # npm deps: React18, Three.js, MapLibre, Tauri API
├── schema.sql                        # PostgreSQL DDL — 18+ tables (PostGIS, LADM schema)
├── project_engine.py                 # Python: file ingestion + local folder tree builder
│
├── src/
│   ├── main.tsx                      # React root, mounts <App/>
│   ├── index.css                     # Global CSS + custom scrollbar
│   ├── App.tsx                       # All screen routing via useState (no router library)
│   ├── types/
│   │   ├── naksha.ts                 # ProjectVirtualState, InputChannel, ProcessingStageId
│   │   ├── canonical.ts              # TypeScript types for CanonicalProject, Parcel, Building
│   │   ├── packages.ts               # DeliverablePackage types
│   │   └── record_matching.ts        # RecordMatchResult types
│   └── components/
│       ├── NewProjectScreen.tsx      # Screen 1: Create project (UI only, no API call)
│       ├── DataInputsScreen.tsx      # Screen 2: 10 input channel overview
│       ├── CategoryUploadScreen.tsx  # Screen 3: Upload files per category (browser picker + drag/drop)
│       ├── DatasetScannerScreen.tsx  # Screen 4: Animated scanning UI (MOCKED timers)
│       ├── JobGraphScreen.tsx        # Screen 5: DAG visualization via WebSocket
│       ├── ProcessingScreen.tsx      # Screen 6: Three.js 3D viewer + pipeline steps
│       ├── CanonicalModelScreen.tsx  # Screen 7: Canonical data tree view
│       ├── Property3DLayerScreen.tsx # Screen 8: 3D building floor/unit explorer
│       ├── Property3DViewer.tsx      # Three.js building viewer (procedurally generated geometry)
│       ├── RecordMatchingScreen.tsx  # Screen 9: Government record matching display
│       ├── ValidationScreen.tsx      # Screen 10: 8 validation checks display
│       ├── OutputScreen.tsx          # Screen 11: Package download screen
│       ├── PackageOutputsScreen.tsx  # Screen 12: Detailed package browser
│       ├── JobMonitor.tsx            # Floating: background job monitor (bottom-right)
│       ├── LogPanel.tsx              # Floating: operation log (bottom-left)
│       ├── ArchitectureModal.tsx     # Modal: live architecture status panel
│       ├── Header.tsx                # App top navigation bar
│       ├── Real3DViewer.tsx          # Three.js 7-stage 3D animation (PROCEDURAL geometry)
│       ├── Viewport2D3D.tsx          # MapLibre 2D map + Three.js point cloud (SIMULATED)
│       ├── InputCard.tsx             # Single input channel card
│       ├── InputDeck.tsx             # 10 input cards overview
│       └── PreflightModal.tsx        # Pre-processing preflight check modal
│
├── backend/
│   ├── main.py                       # FastAPI app: ALL 40+ API endpoints (1045 lines)
│   ├── config.py                     # Settings (DB URL, Redis, MinIO)
│   ├── database.py                   # SQLAlchemy engine -> Supabase PostgreSQL (REAL connection)
│   ├── storage.py                    # MinIO/S3 client with local fallback (boto3 NOT installed)
│   ├── migrate.py                    # Applies schema.sql to PostgreSQL
│   ├── readiness_engine.py           # Readiness % formula (REAL formula, STATIC input scores)
│   ├── validation_engine.py          # 8-check validator (HARDCODED results, not real file analysis)
│   ├── record_matcher.py             # Record matching logic (HARDCODED catalog of 64 units)
│   ├── package_builders.py           # 4 package builders (MOCK manifests, stub file contents)
│   ├── background_engine.py          # asyncio job engine with simulated stages
│   ├── operation_logger.py           # Phase 23: log ring buffer + WebSocket broadcast
│   ├── celery_app.py                 # Celery config (defined but Redis NOT running)
│   ├── queue.py                      # Redis/in-memory queue wrapper (fallback to in-memory)
│   ├── requirements.txt              # Python deps list (NOT all installed)
│   ├── workers/
│   │   └── __init__.py               # GDALPDALWorker, PhotogrammetryWorker, AI3DWorker (ALL MOCKED)
│   ├── tasks/
│   │   └── processing_tasks.py       # Celery tasks: process_photogrammetry etc. (time.sleep stubs)
│   ├── canonical_model/
│   │   ├── models.py                 # Pydantic domain models (Project, Parcel, Building, Floor, Unit)
│   │   ├── builder.py                # Builds canonical project for Pune_Residential_001 (HARDCODED)
│   │   └── exporter.py               # LADM JSON / GeoJSON-FG export
│   └── job_graph/
│       ├── models.py                 # JobGraph, JobNode models
│       ├── pipeline_definition.py    # Creates the canonical JOB_001 DAG (HARDCODED structure)
│       └── executor.py               # DAG executor: _simulate_node_execution (asyncio.sleep stubs)
│
├── src-tauri/
│   ├── tauri.conf.json               # Tauri configuration
│   ├── Cargo.toml                    # Rust dependencies
│   └── src/main.rs                   # Rust: spawns Python backend via Command::new("python")
│
├── storage_cache/                    # EMPTY — local MinIO fallback directory (unused)
└── NAKSHA_2.0_*.md                   # 18 architecture/spec documents (design docs only)
```

---

## 3. CURRENT USER FLOW (Screen-by-Screen)

### Step 1 — New Project Screen
**UI:** User fills project name, location, date. Clicks "Create Project".  
**Frontend:** `handleCreateProject()` in App.tsx — updates local React state only.  
**API called:** NONE. No backend call. No database record created by this action.  
**Data created:** React state `project.title` updated.

### Step 2 — Data Inputs Screen
**UI:** Shows 10 input channels. Status/readiness scores pre-loaded from `INITIAL_PROJECT_STATE` in App.tsx — a hardcoded TypeScript object.  
**API called:** None on load. Data is static frontend state.  
**What the user sees:** Channel 1 Photogrammetry: "94% READY", Channel 2 LiDAR: "EMPTY". These are **hardcoded initial values**, not read from the database.

### Step 3 — Upload Category Screen
**UI:** Browser file picker or drag-and-drop zone.  
**Frontend:** `processUploadedFiles()` classifies files by name/extension, builds a GroupedBundle object in React state.  
**API called:** NONE. Files are read in the browser but never sent to the backend or saved anywhere.  
**What happens to the file:** Browser reads FileList, counts images, checks filename patterns. **No file bytes reach the backend.**

### Step 4 — Dataset Scanner Screen
**UI:** Sequential animated scan: "Reading files -> Checking format -> Extracting metadata -> Checking CRS -> etc."  
**How it works:** A `useEffect` with `setTimeout(300ms)` advances through `SCAN_STEPS` array.  
**Real scanning:** NONE. The timer is fake. `completenessScore = 80` is hardcoded. `qualityScore` is 72 or 78 depending on a checkbox. No file is actually read, parsed, or validated.

### Step 5 — Job Graph Screen
**UI:** Animated DAG visualization showing nodes completing in sequence.  
**API:** Connects to `WS /ws/jobs/graph/{job_id}`.  
**Backend:** `JobGraphExecutor._simulate_node_execution()` runs `asyncio.sleep(0.15)` twice per node, marks it complete. No real processing occurs.

### Step 6 — Processing Screen
**UI:** Seven-stage animated 3D viewer + pipeline step list.  
**3D viewer:** Three.js scene with procedurally generated point clouds using `Math.random()`. No real point cloud data loaded.  
**Pipeline steps:** Stage buttons advance `currentStageIdx` state locally. No API call made.

### Step 7 — Canonical Model Screen
**UI:** Tree view of Project -> Parcel -> Building -> Floors -> Units.  
**API called:** `GET /api/v2/canonical/project/{project_id}`  
**Backend:** `build_canonical_project_pune_001()` returns a **hardcoded Python object**. Not derived from uploaded files.

### Step 8 — Property 3D Layer Screen
**UI:** 3D building viewer with clickable units per floor.  
**Data:** `GET /api/v2/property/units` -> 64 units from hardcoded canonical project.  
**3D model:** Three.js procedurally-built box geometry. Not a real processed building.

### Step 9 — Record Matching Screen
**UI:** Table of 64 units vs government records. Shows matched/mismatched.  
**API:** `GET /api/v2/records/matching/summary` -> `get_canonical_record_matching_catalog()`  
**Backend:** `record_matcher.py` loops over 64 hardcoded units. No real government database queried.

### Step 10 — Validation Screen
**UI:** 8 check items with pass/fail indicators.  
**API:** `GET /api/v2/validation/final?simulate_failure=false`  
**Backend:** `run_final_validation()` returns hardcoded report. Checks always PASS unless `simulate_failure=True`.

### Step 11 — Output / Package Screen
**UI:** Shows 4 package buttons with download links.  
**API:** `GET /api/v2/packages` and `GET /api/v2/packages/download/{package_id}`  
**Backend:** `generate_package_archive_in_memory()` builds real ZIP file with stub text file contents, not actual data files.

---

## 4. CURRENT 10 INPUT MODULES

| # | Category | UI Implemented | File Upload | Files Stored | Extension Validation | MIME Validation | CRS Detection | Quality Analysis | Status |
|---|---------|---------------|------------|-------------|--------------------|-----------------|--------------|--------------|----|
| 1 | Photogrammetry | YES | Browser only | NO | Frontend only | NO | NO | NO | MOCKED |
| 2 | LiDAR / Point Cloud | YES | Browser only | NO | Frontend only | NO | NO | NO | MOCKED |
| 3 | GIS / CAD | YES | Browser only | NO | Frontend only | NO | NO | NO | MOCKED |
| 4 | GNSS / Survey | YES | Browser only | NO | Frontend only | NO | NO | NO | MOCKED |
| 5 | DEM / Elevation | YES | Browser only | NO | Frontend only | NO | NO | NO | MOCKED |
| 6 | Architectural / BIM | YES (EMPTY state) | Browser only | NO | Frontend only | NO | NO | NO | NOT IMPLEMENTED |
| 7 | Property & Vertical Data | YES | Browser only | NO | Frontend only | NO | NO | NO | MOCKED |
| 8 | Imagery / Orthophoto | YES (Pending) | Browser only | NO | Frontend only | NO | NO | NO | NOT IMPLEMENTED |
| 9 | Project / Metadata | YES | Browser only | NO | Frontend only | NO | NO | NO | MOCKED |
| 10 | Supporting Documents | YES | Browser only | NO | Frontend only | NO | NO | NO | MOCKED |

**Critical finding:** No uploaded file ever reaches the backend. `CategoryUploadScreen.tsx` uses `<input type="file">` and drag-and-drop. There is no `fetch()` or form submission sending file bytes to any endpoint. The backend has **no UploadFile endpoint** — confirmed by searching `main.py` for `UploadFile`: zero results.

---

## 5. FILE UPLOAD SYSTEM

| Feature | Status | Evidence |
|---------|--------|---------|
| Browser file picker | REAL | `<input type="file" multiple>` in CategoryUploadScreen.tsx:92 |
| Drag-and-drop | REAL (UI only) | handleDrop() in CategoryUploadScreen.tsx:98 |
| File size limits | NOT IMPLEMENTED | No size check anywhere |
| Extension validation | PARTIAL — UI only | Filename toLowerCase().endsWith() checks in frontend |
| MIME validation | NOT IMPLEMENTED | None |
| File hashing | NOT CONNECTED | project_engine.py has SHA256 code but is never called from UI |
| Upload progress | NOT IMPLEMENTED | No XHR/fetch progress |
| Chunked upload | NOT IMPLEMENTED | None |
| Storage path | NOT IMPLEMENTED | storage_cache/ is empty |
| Database reference | NOT IMPLEMENTED | dataset_files table has 0 rows |
| File sent to backend | **NEVER** | No POST multipart endpoint exists in main.py |

---

## 6. DATA SCANNING / VALIDATION ENGINE

All validation shown in DatasetScannerScreen.tsx is a **timed UI animation with hardcoded results.**

| Validation Check | Status | Detail |
|-----------------|--------|--------|
| File format validation | MOCKED | setTimeout steps; no file read |
| CRS detection | NOT IMPLEMENTED | No pyproj/GDAL/laspy calls |
| Coordinate validation | NOT IMPLEMENTED | |
| Point count | NOT IMPLEMENTED | "12.4M points" is hardcoded string |
| Image blur | MOCKED | autoFilterBlur checkbox toggles qualityScore 72->78 |
| Image overlap | MOCKED | Hardcoded status: 'warning' in QUALITY_CHECKS array |
| Dataset completeness | MOCKED | `const completenessScore = 80;` (line 63) |
| Data quality score | MOCKED | `const qualityScore = autoFilterBlur ? 78 : 72;` (line 66) |

---

## 7. READINESS PERCENTAGE

The formula in `backend/readiness_engine.py` is **mathematically real**:
```python
overall_readiness = round((0.75 * avg_required_score) + (0.25 * calculated_opt))
```

However the input scores are **hardcoded** in main.py:
```python
scores = (req and req.scores) or {
    "cat_01": 90.0, "cat_02": 100.0, "cat_03": 95.0, "cat_04": 90.0, "cat_05": 80.0,
    "cat_06": 70.0, "cat_07": 100.0, "cat_08": 90.0, "cat_09": 100.0, "cat_10": 60.0
}
```

There is also a special benchmark override that returns exactly `overall_readiness = 89, required_data_pct = 100, optional_data_pct = 72` when it detects the above hardcoded values.

The frontend `DataInputsScreen.tsx` shows readiness percentages from `INITIAL_PROJECT_STATE` in App.tsx (hardcoded TypeScript constant). The readiness API is not called by the frontend on load.

**VERDICT: Formula is real. Input scores are static hardcoded values, not derived from uploaded file analysis.**

---

## 8. DATABASE

| Item | Detail |
|------|--------|
| Technology | **PostgreSQL 17.6** (Supabase cloud, region: AP-Southeast-1 Singapore) |
| PostGIS version | 3.3.7 |
| Connection | SQLAlchemy + psycopg2-binary |
| ORM | SQLAlchemy (text() queries — no ORM model classes) |
| Migration tool | Custom backend/migrate.py (reads schema.sql, executes statements) |
| DB latency | ~1655ms (cross-region) |

### Tables Present in Live Database (18 total, confirmed):
buildings, dataset_files, floors, ground_control_points, input_datasets, job_input_bindings, organizations, parcel_mutations, parcels, processed_artifacts, processing_jobs, project_snapshots, projects, property_titles, surveys, units, users, validation_results

### Live Row Counts (verified by direct query):

| Table | Rows | Notes |
|-------|------|-------|
| projects | **1** | Haveli Taluka Cadastre & 3D Land Demarcation (seeded) |
| input_datasets | **20** | Seeded dataset entries |
| dataset_files | **0** | No real files ever uploaded |
| processing_jobs | **0** | No jobs persisted |
| buildings | **1** | Seeded building |
| floors | **8** | Seeded floors |
| units | **2** | Only 2 units seeded (not all 64) |
| parcels | **1** | Seeded parcel |
| validation_results | **0** | Never written |
| processed_artifacts | **0** | Never written |

---

## 9. FILE STORAGE

| Storage System | Status |
|----------------|--------|
| MinIO / S3 | NOT CONNECTED — boto3 NOT installed. storage.py falls back to local filesystem |
| Local filesystem fallback | Configured at storage_cache/ directory |
| storage_cache/ directory | **EMPTY** — no files ever stored |

**What happens when a user "uploads" a file:**
1. Browser reads the file via FileList API
2. React component stores file metadata (name, count) in local state
3. User clicks "Save Dataset"
4. onDatasetSaved() is called → app navigates to scanner screen
5. **The actual file bytes are discarded.** Nothing is POSTed.

**VERDICT: No file ever reaches persistent storage in the current implementation.**

---

## 10. PROCESSING ENGINE

| Processing Operation | Status | Library | Evidence |
|---------------------|--------|---------|---------|
| Photogrammetry (SfM) | MOCKED | time.sleep(2) | tasks/processing_tasks.py:20 — "Simulate stage work" comment |
| LiDAR reading | MOCKED | None | workers/__init__.py returns hardcoded {"filtered_points": 12418920} |
| LiDAR classification | MOCKED | None | Hardcoded |
| Point cloud fusion (ICP) | MOCKED | None | background_engine.py:200-204 — asyncio.sleep(1.2) |
| DEM generation | MOCKED | None | workers/__init__.py — hardcoded elevation min/max |
| Building reconstruction | MOCKED | None | background_engine.py:206-210 — sleep stages |
| AI segmentation | MOCKED | None | pipeline_definition.py:197 — hardcoded {"model": "PointNet++ CadastreNet"} |
| Floor detection | MOCKED | None | workers/__init__.py:58 — arithmetic z_min + (i * 3.0) |
| Unit detection | MOCKED | None | workers/__init__.py:77 — floor_count * units_per_floor |
| Record matching | MOCKED | None | record_matcher.py — deterministic loop over 64 hardcoded units |
| Final validation | MOCKED | None | validation_engine.py — hardcoded pass/fail |
| 3D model generation | MOCKED | None | Three.js procedural geometry with Math.random() |
| Package generation | PARTIAL | Python zipfile | Real ZIP created but contains stub text files |

---

## 11. AI / ML MODELS

| Model | Status |
|-------|--------|
| ALIKED | NOT IMPLEMENTED — not found anywhere in codebase |
| LightGlue | NOT IMPLEMENTED — not found anywhere in codebase |
| PatchMatchNet | NOT IMPLEMENTED |
| CasMVSNet | NOT IMPLEMENTED |
| GeoTransformer | NOT IMPLEMENTED |
| KPConv | NOT IMPLEMENTED |
| PointCleanNet | NOT IMPLEMENTED |
| RandLA-Net | NOT IMPLEMENTED |

**No AI model is installed, imported, or called anywhere in the project.**

`open3d` 0.19.0 is installed on the system but is **not imported or used** anywhere in the project code.

The string `{"model": "PointNet++ CadastreNet", "miou_accuracy": 0.942}` in pipeline_definition.py is **hardcoded metadata**, not a real model invocation.

---

## 12. INSTALLED vs REQUIRED PYTHON PACKAGES

| Package | In requirements.txt | Installed on System | Used in Code |
|---------|--------------------|--------------------|--------------|
| fastapi | YES | YES (0.128.0) | YES |
| uvicorn | YES | YES (0.24.0) | YES |
| sqlalchemy | YES | YES (2.0.49) | YES |
| psycopg2-binary | YES | YES (2.9.12) | YES |
| celery | YES | YES (5.6.3) | DEFINED, NOT RUNNING |
| redis | YES | YES (7.4.0) | DEFINED, NOT CONNECTED |
| pydantic | YES | YES (2.12.5) | YES |
| open3d | YES | YES (0.19.0) | NOT IMPORTED IN PROJECT |
| boto3 | YES | **NO** | CALLED in storage.py — will fail |
| minio | YES | **NO** | Referenced in config.py |
| geoalchemy2 | YES | **NO** | Referenced in schema.sql |
| shapely | YES | **NO** | Not imported in project |
| laspy | YES | **NO** | Not imported in project |
| pdal | YES | **NO** | Not imported in project |
| pyproj | YES | **NO** | Not imported in project |
| rasterio | YES | **NO** | Not imported in project |
| fiona | YES | **NO** | Not imported in project |

---

## 13. BACKGROUND JOB SYSTEM

| Component | Status | Evidence |
|-----------|--------|---------|
| Redis | NOT RUNNING | task_broker.is_connected = False at startup |
| Celery | DEFINED NOT RUNNING | celery_app.py exists; no worker process |
| In-memory queue | REAL FALLBACK | task_broker.in_memory_queue in queue.py |
| asyncio background task | REAL STRUCTURE | asyncio.create_task() in background_engine.py |
| Job state persistence | PARTIAL | Attempts PostgreSQL UPDATE; silently catches exceptions |
| WebSocket job streaming | REAL | /ws/jobs/{job_id} sends asyncio Queue events |
| Actual computation | SIMULATED | asyncio.sleep(1.2) with string progress labels only |
| Job cancellation | NOT IMPLEMENTED | No cancel endpoint |

---

## 14. 3D VIEWER

| Feature | Status | Technology |
|---------|--------|-----------|
| Viewer technology | REAL | Three.js 0.162.0 |
| OrbitControls | REAL | OrbitControls from three/examples |
| Point cloud display | MOCKED | Math.random() generated, not from files |
| GLB/GLTF loading | NOT IMPLEMENTED | No GLTFLoader in project |
| LAS/LAZ visualization | NOT IMPLEMENTED | No laspy or potree |
| Building mesh | MOCKED — Procedural | Three.js BoxGeometry |
| Unit selection (raycasting) | REAL | THREE.Raycaster in Property3DViewer.tsx |
| MapLibre map | REAL | MapLibre-GL 4.1.1 |
| **Is model from user data?** | **NO** | Procedural geometry only |

---

## 15. OUTPUT PACKAGES

| Package | Generator | Real Content? | Download Works? |
|---------|-----------|--------------|----------------|
| TBK Package | get_tbk_package() + ZIP | NO — stub text files | YES — ZIP downloads |
| GIB Package | get_gib_package() + ZIP | NO — stub text files | YES — ZIP downloads |
| Vertical Property ZIP | get_vertical_property_package() + ZIP | NO — stub text files | YES — ZIP downloads |
| 3D Survey ZIP | get_3d_survey_package() + ZIP | NO — stub text files | YES — ZIP downloads |

**What the ZIP contains:**
- `PACKAGE_MANIFEST.json` — real JSON describing the package
- `CADASTRAL_CERTIFICATE.txt` — real text certificate
- Each declared file (e.g., `orthophoto/haveli_orthomosaic_5cm_cog.tif`) — a 5-line text stub: filename, description, declared size, hash, certification note

---

## 16. ALL APIs

| Method | URL | Status |
|--------|-----|--------|
| GET | /health | REAL |
| GET | /api/v2/projects/{id}/virtual-inputs | MOCKED (hardcoded) |
| POST | /api/v2/projects/{id}/jobs/dispatch | MOCKED (returns random job ID) |
| WS | /ws/projects/{id}/telemetry | MOCKED (range 0-100 loop) |
| POST | /api/v2/projects/{id}/readiness | REAL formula, static input |
| GET | /api/v2/jobs/graph/template | REAL structure, no real data |
| WS | /ws/jobs/graph/{job_id} | MOCKED (asyncio.sleep nodes) |
| GET | /api/v2/processing/stages | MOCKED (hardcoded) |
| GET | /api/v2/canonical/project/{id} | MOCKED (hardcoded builder) |
| GET | /api/v2/canonical/tree/{id} | MOCKED (hardcoded) |
| GET | /api/v2/canonical/export/{id} | MOCKED (hardcoded data) |
| GET | /api/v2/property/units | MOCKED (from hardcoded canonical) |
| GET | /api/v2/property/units/{unit} | MOCKED |
| GET | /api/v2/records/matching/summary | MOCKED (64 hardcoded units) |
| GET | /api/v2/records/matching/unit/{unit} | MOCKED |
| GET | /api/v2/validation/final | MOCKED (hardcoded results) |
| POST | /api/v2/validation/resolve-issue/{id} | MOCKED |
| GET | /api/v2/packages | MOCKED (hardcoded manifests) |
| GET | /api/v2/packages/{id} | MOCKED |
| POST | /api/v2/packages/generate-all | MOCKED |
| GET | /api/v2/packages/download/{id} | **REAL** (stub content) |
| GET | /api/v2/packages/download-all | **REAL** (stub content) |
| GET | /api/v2/database/health | **REAL** — live Supabase query |
| GET | /api/v2/database/projects | **REAL** — live PostgreSQL |
| GET | /api/v2/database/parcels | **REAL** — live PostGIS query |
| GET | /api/v2/database/buildings | **REAL** — live PostgreSQL |
| GET | /api/v2/database/units | **REAL** — live PostgreSQL |
| GET | /api/v2/architecture/status | REAL DB + MOCKED worker status |
| GET | /api/v2/jobs/{job_id} | REAL (in-memory state) |
| GET | /api/v2/jobs/list/all | REAL (in-memory state) |
| POST | /api/v2/jobs/dispatch | REAL dispatch, SIMULATED processing |
| WS | /ws/jobs/{job_id} | REAL WS, SIMULATED progress |
| GET | /api/v2/logs | REAL (in-memory ring buffer + seed) |
| POST | /api/v2/logs | REAL |
| WS | /ws/logs | REAL (ring buffer broadcast) |

**Missing:** There is NO file upload endpoint. No `POST /api/v2/datasets/upload` or any multipart form endpoint exists.

---

## 17. AUTHENTICATION

**Status: NOT IMPLEMENTED**

- No login screen
- No JWT or session tokens
- No RBAC
- No user table queries
- All API endpoints are publicly accessible without any authentication

---

## 18. SECURITY ISSUES

| Issue | Severity |
|-------|----------|
| Supabase database credentials hardcoded in database.py:18 as default parameter | CRITICAL |
| MinIO credentials hardcoded in config.py | HIGH |
| All API endpoints publicly accessible (no auth) | CRITICAL |
| CORS set to allow_origins=["*"] | MEDIUM |
| Some f-string SQL queries in main.py (SQL injection risk) | MEDIUM |

---

## 19. CURRENT MOCK DATA INVENTORY

| Location | Mock Data | Must Replace? |
|----------|-----------|--------------|
| App.tsx:24-152 | INITIAL_PROJECT_STATE — hardcoded 10 channels | YES |
| backend/canonical_model/builder.py | Entire Pune Residential 001 project (8 floors, 64 units) | YES |
| backend/record_matcher.py:141-204 | 64 hardcoded units, 8 owner names, 2 injected mismatches | YES |
| backend/validation_engine.py:54-143 | 8 hardcoded check results | YES |
| backend/package_builders.py:52-553 | 4 package manifests with fake file sizes and SHA256s | YES |
| backend/background_engine.py:45-68 | JOB #1024 initialized at 70% in Fusion stage | YES |
| backend/workers/__init__.py | All 3 workers return hardcoded dicts | YES |
| backend/job_graph/pipeline_definition.py | Hardcoded metrics for 15 pipeline nodes | YES |
| backend/operation_logger.py:70-116 | 31 seeded log entries | PARTIAL |
| backend/main.py:229-237 | /ws/projects/{id}/telemetry sends range(0,101,10) | YES |
| DatasetScannerScreen.tsx:63,66 | completenessScore = 80, qualityScore = 72 | YES |
| CategoryUploadScreen.tsx:76-89 | handleSimulateStandardUpload() creates fake bundle | PARTIAL |
| Real3DViewer.tsx | All Math.random() point clouds and procedural geometry | YES |
| Viewport2D3D.tsx:33-80 | Simulated LiDAR point cloud | YES |
| src-tauri/src/main.rs:19-29 | get_backend_status() returns hardcoded JSON | YES |

---

## 20. WHAT IS ACTUALLY REAL (Do Not Rebuild)

1. React UI shell — 12 screens, navigation, all screen layouts
2. FastAPI backend structure — 35+ endpoints, all routes defined
3. PostgreSQL schema — schema.sql — complete LADM-compliant DDL with PostGIS
4. Database connection — live Supabase connection working (1655ms latency)
5. Supabase tables seeded — 1 project, 20 input_datasets, 1 building, 8 floors, 1 parcel
6. Canonical data model (Pydantic) — Project, Parcel, Building, Floor, Unit, Coordinates, Survey, GovernmentRecords, Validation
7. Readiness engine formula — correct weighted calculation in readiness_engine.py
8. Record matching logic — deterministic attribute-level matching with 1% area tolerance
9. Package builders structure — all 4 package manifests + real ZIP download working
10. Three.js 3D viewer — real WebGL renderer, OrbitControls, raycasting, stage switching
11. MapLibre integration — real 2D map rendering
12. WebSocket infrastructure — asyncio Queue broadcast, heartbeat, backlog delivery
13. Job graph DAG structure — 15-node pipeline definition, topological sort execution
14. Background job engine — asyncio task dispatch, in-memory state, WS streaming
15. Operation logger — ring buffer, WebSocket broadcast, seeded entries
16. Tauri Rust shell skeleton — Python sidecar spawn code, window event handling
17. project_engine.py — real file copy + SHA256 + folder scaffolding (needs UI connection)
18. schema.sql — real DDL including operation_logs table

---

## 21. WHAT IS MISSING (Priority Order)

### CRITICAL — Blocks everything else
1. **File upload backend endpoint** — POST /api/v2/datasets/upload (multipart) — nothing connects browser files to server
2. **Real file storage** — MinIO setup OR local filesystem storage; boto3 must be installed
3. **Authentication** — login, JWT tokens, RBAC for all roles
4. **Move credentials to .env** — Supabase and MinIO credentials currently hardcoded

### HIGH — Core functionality
5. **Real file validation** — file header parsing, CRS detection using laspy, rasterio, fiona, pyproj
6. **Real photogrammetry pipeline** — COLMAP/OpenSfM integration
7. **Real LiDAR pipeline** — laspy/PDAL reading, classification, noise filtering
8. **Real point cloud fusion** — Open3D ICP registration
9. **Real building reconstruction** — Poisson/alpha shape from fused cloud
10. **Real readiness scores** — replace hardcoded scores with computed ones from file analysis
11. **Connect project_engine.py to UI** — file ingestion on upload
12. **Install missing packages** — laspy, pdal, shapely, pyproj, fiona, rasterio, geoalchemy2, minio, boto3
13. **Redis + Celery workers** — start actual worker processes
14. **Government record API** — Mahabhulekh or equivalent

### MEDIUM
15. **Real output package content** — actual orthophotos, point clouds, meshes inside ZIPs
16. **Tauri compilation** — compile Rust, test desktop launcher
17. **dataset_files table population** — write file records on upload
18. **processing_jobs table population** — persist job states reliably
19. **validation_results table population** — write actual validation results

### LOW
20. **Unit tests** — zero tests exist anywhere
21. **Project creation via API** — NewProjectScreen -> POST /api/v2/projects
22. **Error boundaries** — silent .catch(() => {}) everywhere
23. **AI models** — ALIKED, LightGlue, GeoTransformer, KPConv, RandLA-Net

---

## 22. FILE-LEVEL EVIDENCE

| Conclusion | File | Location | Evidence |
|-----------|------|---------|---------|
| No file upload endpoint | backend/main.py | All 1045 lines | Zero UploadFile occurrences |
| Scanner is fake | DatasetScannerScreen.tsx | L46-58 | setTimeout(300ms) per step |
| Scanner scores hardcoded | DatasetScannerScreen.tsx | L63-66 | `const completenessScore = 80;` |
| 3D viewer is procedural | Real3DViewer.tsx | L172-210 | Math.random() for all coordinates |
| Processing is simulated | background_engine.py | L173-245 | asyncio.sleep(1.2) comment "Simulates true compute stages" |
| Celery tasks are stubs | tasks/processing_tasks.py | L20 | Comment: "Simulate stage work" |
| Workers return hardcoded data | workers/__init__.py | L18-84 | Hardcoded {"filtered_points": 12418920} |
| Canonical model is hardcoded | canonical_model/builder.py | L22-240 | def build_canonical_project_pune_001() — one static project |
| Record matching is hardcoded | record_matcher.py | L141-204 | 64-unit for loop, 2 injected mismatches |
| Validation is hardcoded | validation_engine.py | L54-143 | Checks always PASSED unless simulate_failure=True |
| Packages contain stub files | package_builders.py | L617-625 | f.path written as plain text stubs |
| DB is live and real | database.py | L72-114 | check_database_health() returns ONLINE, PG17, 18 tables |
| DB has seeded data | Live query | Verified | 1 project, 20 datasets, 1 building, 8 floors |
| Dataset files table empty | Live query | Verified | dataset_files: 0 rows |
| Storage cache empty | storage_cache/ | Directory listing | Empty directory |
| No AI models installed | System check | pip show | No torch, no ALIKED, no laspy installed |
| No auth exists | All main.py routes | All endpoints | No Depends(get_current_user) anywhere |
| Credentials hardcoded | database.py:18 | Line 18 | Supabase password as default argument |

---

## 23. FINAL TRUTH TABLE

### REAL
- PostgreSQL 17.6 + PostGIS 3.3.7 database (live Supabase, 18 tables, connected)
- SQLAlchemy database queries to live PostgreSQL
- Database schema (schema.sql) — complete LADM-compliant DDL
- WebSocket infrastructure (asyncio Queue, heartbeat, backlog)
- Three.js WebGL renderer (real rendering engine, OrbitControls, raycasting)
- MapLibre GL map (real tile rendering)
- FastAPI HTTP server and all route definitions
- Package ZIP download (real HTTP download of a real ZIP archive)
- PACKAGE_MANIFEST.json inside ZIPs (real JSON)
- Readiness calculation formula (readiness_engine.py)
- Operation logger ring buffer + WebSocket broadcast
- project_engine.py file ingestion code (SHA256, folder tree, metadata)
- Pydantic domain models (Project, Parcel, Building, Floor, Unit, etc.)

### MOCKED
- All 10 input channel readiness percentages (hardcoded in INITIAL_PROJECT_STATE)
- Dataset scanner scanning animation (setTimeout timers, completenessScore = 80)
- All processing worker outputs (hardcoded dicts in workers/__init__.py)
- Background job pipeline stages (asyncio.sleep with string labels)
- Celery task implementations (time.sleep stubs)
- Job graph node execution (_simulate_node_execution)
- Old telemetry WebSocket (for loop 0->100)
- Canonical project data (hardcoded Pune Residential 001 in builder.py)
- Government record matching catalog (64 hardcoded units, injected mismatches)
- Final validation results (always PASSED unless simulate_failure flag)
- All 4 package file contents (plain text stubs inside ZIPs)
- Package checksums and file sizes (declared but not computed from real files)
- 3D viewer point clouds (Math.random() positions)
- 3D viewer building geometry (procedural Three.js boxes)
- All metric strings: "12.4M points", "1,420 frames", "RMSE: 0.011m", "miou: 0.942"
- Blur detection (UI checkbox, not real analysis)

### PARTIAL
- File upload — browser UI works; backend persistence missing
- Background job engine — real dispatch + WS streaming; fake computation
- Database population — seeded rows exist; upload/processing writes nothing
- Package generation — real ZIP structure; stub content inside
- Project creation — UI works; no API call to create DB record
- Readiness engine — real formula; static hardcoded input scores

### NOT IMPLEMENTED
- File upload backend endpoint (UploadFile)
- Real file storage (MinIO not running; boto3 not installed)
- Real file validation (laspy, rasterio, fiona, pyproj not installed)
- Authentication / login / RBAC
- Real photogrammetry (COLMAP/OpenSfM)
- Real LiDAR processing (PDAL/laspy)
- Real point cloud fusion (Open3D ICP)
- Real building reconstruction from point cloud
- Real floor/unit segmentation
- Real government record API connection
- Real package content (actual orthophotos, point clouds, meshes)
- Celery + Redis worker infrastructure (not running)
- Any form of testing (unit, integration, e2e — zero test files)
- AI model integration (ALIKED, LightGlue, GeoTransformer, etc.)
- Tauri desktop compilation
