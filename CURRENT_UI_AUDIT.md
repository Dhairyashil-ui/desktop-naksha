# TECHNICAL AUDIT: CURRENT UI IMPLEMENTATION (NAKSHA 2.0 DESKTOP)

> **Document Type:** Technical Audit & Baseline Architecture Report  
> **Target Application:** Naksha 2.0 Land Survey, Cadastral Intelligence & 3D Property Desktop  
> **Workspace Path:** `d:/surveynaksha`  
> **Branch / Commit State:** `real-processing-foundation`  
> **Auditor:** DeepMind Antigravity AI Engineering Team  
> **Status:** FORENSIC AUDIT COMPLETE — ZERO CODE MODIFICATIONS  
> **Purpose:** Handover document for the architectural and UX design of the NEW Survey Team workflow.

---

## EXECUTIVE SUMMARY & AUDIT RULES

This audit reports strictly on what **actually exists** in the frontend codebase as of today. No screens are assumed to exist because of route names; no APIs are assumed connected because a button is visible; no progress bars are reported as genuine unless backed by byte/operation-level backend telemetry.

Every UI feature is classified under one of seven unambiguous statuses:
- **`REAL`**: Backed by live backend endpoints, physical disk operations, real database transactions, or genuine hardware telemetry.
- **`PARTIAL`**: Real frontend code or partial API connection exists, but relies on fallbacks, simulated intervals, or incomplete integration.
- **`MOCKED`**: UI exists and animates or renders, but data is hardcoded, generated via in-memory loops, or driven by synthetic timers (`setTimeout` / `setInterval`).
- **`STATIC`**: Hardcoded SVG, HTML, or text with zero interactivity or dynamic data binding.
- **`PLACEHOLDER`**: Stub UI element (alert box, disabled button, dummy modal).
- **`NOT IMPLEMENTED`**: Desired workflow capability does not exist in any screen or component.
- **`UNKNOWN`**: Code exists but exhibits undetermined runtime behavior.

---

## 1. CURRENT APPLICATION ENTRY FLOW

### 1.1 Startup Trace
```
Operating System: Windows
       ↓
Tauri Desktop Executable (src-tauri/src/main.rs)
  • Spawns Python FastAPI backend: "python -m uvicorn backend.main:app --port 8000 --host 127.0.0.1"
  • Verifies http://127.0.0.1:8000/health (timeout: 15s)
  • Opens Native Window (1440x900, minWidth: 1024, minHeight: 700)
       ↓
HTML Document: index.html
  • Loads Inter & JetBrains Mono Google Fonts
  • Loads unpkg MapLibre GL 4.1.1 CSS link
  • Mounts <div id="root"></div>
  • Executes <script type="module" src="/src/main.tsx">
       ↓
React Entry Point: src/main.tsx
  • ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
       ↓
Root React Component: src/App.tsx
  • Initializes currentScreen = 'NEW_PROJECT' (line 156)
  • Initializes project = INITIAL_PROJECT_STATE (lines 25–153)
  • Always renders JobMonitor (fixed bottom-right) and LogPanel (fixed bottom-left)
       ↓
First Rendered Screen: src/components/NewProjectScreen.tsx
  • Displays "New Project" minimalist form with pre-filled inputs:
    - Name: "Pune_Residential_001"
    - Location: "Pune, Maharashtra (18.5204° N, 73.8567° E)"
    - Date: "29 Sep 2026"
```

### 1.2 Flow Specifics
- **Entry File:** `index.html` $\rightarrow$ [`src/main.tsx`](file:///d:/surveynaksha/src/main.tsx#L1-L11).
- **Root Component:** [`src/App.tsx`](file:///d:/surveynaksha/src/App.tsx#L1-L521).
- **Tauri Entry Point:** [`src-tauri/src/main.rs`](file:///d:/surveynaksha/src-tauri/src/main.rs#L185-L221).
- **First Rendered Screen:** [`src/components/NewProjectScreen.tsx`](file:///d:/surveynaksha/src/components/NewProjectScreen.tsx#L1-L141).
- **Authentication Flow:** **`NOT IMPLEMENTED`** (Zero login screens, zero JWT/session headers, zero user roles).
- **Initial Route:** Virtual screen state `'NEW_PROJECT'` (`App.tsx` line 156).
- **Default Project:** `INITIAL_PROJECT_STATE` (`App.tsx` line 25: `projectId: '8f4a169b-e8f0-466d-9657-3f9f83656ab1'`, title: `'Haveli Taluka Cadastre & 3D Land Demarcation'`).
- **Navigation Mechanism:** Strictly state-driven conditional rendering inside `App.tsx:renderScreenContent()` using `useState<'NEW_PROJECT' | 'DATA_INPUTS' | 'UPLOAD_CATEGORY' | 'SCANNER' | 'PROCESSING' | 'JOB_GRAPH' | 'WORKSPACE' | 'CANONICAL_MODEL' | 'PROPERTY_3D' | 'RECORD_MATCHING' | 'VALIDATION' | 'PACKAGES'>`. **No URL router (`react-router-dom`) is installed or used.**

---

## 2. COMPLETE FRONTEND FILE STRUCTURE

The frontend source code is located entirely in `src/`. Below is the exhaustive file-level inventory:

```
src/
├── App.tsx                     # Master state controller & virtual router (19.6 KB)
├── main.tsx                    # React 18 DOM mount point (250 B)
├── index.css                   # Tailwind layers, scrollbars, glassmorphism CSS (1.06 KB)
├── config/
│   └── api.ts                  # Backend URL (8000) & WebSocket base declarations (282 B)
├── types/
│   ├── naksha.ts               # Core domain types, 10 input channels, stage metadata (10.8 KB)
│   ├── canonical.ts            # Canonical data model interfaces & fallback Pune tree (15.4 KB)
│   ├── record_matching.ts      # 3D unit <-> government record match types (1.52 KB)
│   └── packages.ts             # Deliverable package schemas (1.08 KB)
└── components/
    ├── Header.tsx              # Top navigation bar for WORKSPACE mode (10.0 KB)
    ├── NewProjectScreen.tsx    # Project initiation form (5.82 KB)
    ├── DataInputsScreen.tsx    # Core 10-input channel readiness matrix (17.3 KB)
    ├── CategoryUploadScreen.tsx# Real file drag/drop XHR uploader & validator (16.3 KB)
    ├── DatasetScannerScreen.tsx# 10-stage SSE physical file verification scanner (18.0 KB)
    ├── ProcessingScreen.tsx    # 3-column processing monitor with 3D viewer (15.9 KB)
    ├── Real3DViewer.tsx        # Three.js 6-layer point cloud & LOD-2 viewer (31.5 KB)
    ├── Property3DLayerScreen.tsx# Floor/Apartment strata demarcation view (23.2 KB)
    ├── Property3DViewer.tsx    # Three.js 8-floor 64-unit strata parcel viewer (16.5 KB)
    ├── RecordMatchingScreen.tsx# Title matching table & conflict audit screen (29.2 KB)
    ├── ValidationScreen.tsx    # Pre-output gatekeeper & cadastral issue modal (21.1 KB)
    ├── OutputScreen.tsx        # Minimalist 4-package export download screen (7.72 KB)
    ├── PackageOutputsScreen.tsx# UNUSED / OBSOLETE package screen (30.0 KB)
    ├── CanonicalModelScreen.tsx# Unified canonical tree & LADM JSON exporter (31.3 KB)
    ├── JobGraphScreen.tsx      # DAG pipeline tree with synthetic execution (18.2 KB)
    ├── Viewport2D3D.tsx        # Split 2D SVG / 3D Three.js terrain viewport (10.1 KB)
    ├── InputDeck.tsx           # 10-channel grid container (5.01 KB)
    ├── InputCard.tsx           # Individual channel status card (5.30 KB)
    ├── PreflightModal.tsx      # Input channel detail modal (9.0 KB)
    ├── JobMonitor.tsx          # Floating bottom-right Celery job pill (9.41 KB)
    ├── LogPanel.tsx            # Floating bottom-left real-time terminal (16.8 KB)
    └── ArchitectureModal.tsx   # PostgreSQL 17 / PostGIS live telemetry modal (8.46 KB)
```

### Detailed Component Responsibility & Reality Audit

| File Path | Controls Screen / Component | Responsibility | Usage Status | Mock Data Present? | API Call Present? |
|---|---|---|---|---|---|
| [`App.tsx`](file:///d:/surveynaksha/src/App.tsx) | Root Container | Manages screen switching state, project initialization, top-level event handlers | **ACTIVE** | Yes (`INITIAL_PROJECT_STATE`) | Yes (`POST /api/v2/projects`, `GET /inputs/live`, `POST /jobs/dispatch`) |
| [`NewProjectScreen.tsx`](file:///d:/surveynaksha/src/components/NewProjectScreen.tsx) | `NEW_PROJECT` Screen | Captures project name, jurisdiction, survey date | **ACTIVE** | Sample jurisdictions list | Yes (delegates to `App.tsx` API call) |
| [`DataInputsScreen.tsx`](file:///d:/surveynaksha/src/components/DataInputsScreen.tsx) | `DATA_INPUTS` Screen | Displays the 10 data categories, readiness scores, and scan button | **ACTIVE** | Yes (`INITIAL_INPUTS` default) | Yes (`POST /projects/{id}/scan`, `GET /inputs/live`) |
| [`CategoryUploadScreen.tsx`](file:///d:/surveynaksha/src/components/CategoryUploadScreen.tsx) | `UPLOAD_CATEGORY` Screen | Drag & drop file selection, real byte progress upload, file validation | **ACTIVE** | None | Yes (`POST /api/v2/datasets/upload`, `POST /datasets/{id}/validate`) |
| [`DatasetScannerScreen.tsx`](file:///d:/surveynaksha/src/components/DatasetScannerScreen.tsx) | `SCANNER` Screen | 10-stage physical file verification via Server-Sent Events | **ACTIVE** | None (dynamic fallback only) | Yes (`GET /datasets/{id}/scan/stream`, `POST /datasets/{id}/scan`) |
| [`ProcessingScreen.tsx`](file:///d:/surveynaksha/src/components/ProcessingScreen.tsx) | `PROCESSING` Screen | 3-column monitor: 10 pipeline steps, center 3D viewer, right metrics | **ACTIVE** | Hardcoded metrics ("64/64", "14.8m") | No (embeds `Real3DViewer`) |
| [`Real3DViewer.tsx`](file:///d:/surveynaksha/src/components/Real3DViewer.tsx) | Center 3D Viewport | Three.js rendering of point clouds, building massing, floor slabs, units | **ACTIVE** | Yes (`generateDeterministicScan()`) | Yes (`GET /api/v2/visualization/scene-layers`) |
| [`Property3DLayerScreen.tsx`](file:///d:/surveynaksha/src/components/Property3DLayerScreen.tsx) | `PROPERTY_3D` Screen | 3D unit strata demarcation, floor isolation, ULPIN-3D viewer | **ACTIVE** | Yes (all 64 units in memory) | **NO** (Zero API calls) |
| [`Property3DViewer.tsx`](file:///d:/surveynaksha/src/components/Property3DViewer.tsx) | 3D Strata Viewport | Three.js BoxGeometry renderer for floors and apartments | **ACTIVE** | Yes (receives 64 in-memory boxes) | **NO** (Zero API calls) |
| [`RecordMatchingScreen.tsx`](file:///d:/surveynaksha/src/components/RecordMatchingScreen.tsx) | `RECORD_MATCHING` Screen | 3D unit ↔ government deed title cross-verification table | **ACTIVE** | Yes (`getFallbackUnits()`) | Yes (`GET /api/v2/records/matching/summary`) |
| [`ValidationScreen.tsx`](file:///d:/surveynaksha/src/components/ValidationScreen.tsx) | `VALIDATION` Screen | 9 certified validation checklist items, conflict resolver modal | **ACTIVE** | Yes (fallback checks array) | Yes (`GET /api/v2/validation/final`, `POST /resolve-issue`) |
| [`OutputScreen.tsx`](file:///d:/surveynaksha/src/components/OutputScreen.tsx) | `PACKAGES` Screen | Minimalist UI with download buttons for TBK, GIB, 3D Survey, Vertical Property | **ACTIVE** | None | Yes (`/api/v2/packages/download/{id}`, `/download-all`) |
| [`PackageOutputsScreen.tsx`](file:///d:/surveynaksha/src/components/PackageOutputsScreen.tsx) | Obsolete Packages View | Legacy 4-package previewer with synthetic intervals | **UNUSED** | Yes (`FALLBACK_PACKAGES`) | Yes (`/api/v2/packages`) |
| [`CanonicalModelScreen.tsx`](file:///d:/surveynaksha/src/components/CanonicalModelScreen.tsx) | `CANONICAL_MODEL` Screen | Interactive JSON/Tree viewer for unified project data & LADM export | **ACTIVE** | Yes (`CANONICAL_PUNE_001`) | Yes (`GET /api/v2/canonical/project/PROJ-PUNE-001`) |
| [`JobGraphScreen.tsx`](file:///d:/surveynaksha/src/components/JobGraphScreen.tsx) | `JOB_GRAPH` Screen | Visual DAG tree of pipeline steps | **ACTIVE** | Yes (hardcoded DAG nodes) | **NO** (Zero API calls; uses `setInterval`) |
| [`Viewport2D3D.tsx`](file:///d:/surveynaksha/src/components/Viewport2D3D.tsx) | Workspace Upper Half | 2D vector cadastre & 3D Three.js terrain overview | **ACTIVE** (Workspace) | Yes (static SVG polygons & sine wave points) | **NO** (Zero API calls) |
| [`InputDeck.tsx`](file:///d:/surveynaksha/src/components/InputDeck.tsx) | Workspace Lower Half | Grid deck displaying all 10 input channels | **ACTIVE** (Workspace) | Receives project channels | **NO** (File drop triggers `alert()`) |
| [`InputCard.tsx`](file:///d:/surveynaksha/src/components/InputCard.tsx) | Deck Tile | Card component representing one input channel | **ACTIVE** (Workspace) | None | **NO** |
| [`PreflightModal.tsx`](file:///d:/surveynaksha/src/components/PreflightModal.tsx) | Inspection Modal | Displays required vs optional attributes for a clicked channel | **ACTIVE** (Workspace) | Static checklist items | **NO** |
| [`JobMonitor.tsx`](file:///d:/surveynaksha/src/components/JobMonitor.tsx) | Floating Bottom-Right | Displays status of asynchronous pipeline job | **ACTIVE** (Global) | Yes (`DEFAULT_JOB_DATA`) | Yes (`GET /api/v2/jobs/{id}`, `POST /dispatch`, WS) |
| [`LogPanel.tsx`](file:///d:/surveynaksha/src/components/LogPanel.tsx) | Floating Bottom-Left | Real-time terminal log viewer for system events | **ACTIVE** (Global) | Yes (`SEED_ENTRIES`) | Yes (`GET /api/v2/logs`, `WS /ws/logs`) |
| [`ArchitectureModal.tsx`](file:///d:/surveynaksha/src/components/ArchitectureModal.tsx) | Diagnostics Modal | Inspects live Supabase PostgreSQL 17 + PostGIS pooler status | **ACTIVE** (Global) | None | Yes (`GET /api/v2/database/health`) |

---

## 3. ROUTING IMPLEMENTATION

Naksha 2.0 does **not** use `react-router`, `react-router-dom`, or browser hash/history routing.  
All navigation is performed by updating the `currentScreen` state variable in [`src/App.tsx:156`](file:///d:/surveynaksha/src/App.tsx#L156).

### Complete Route / Screen Inventory

| Virtual Route | Component | Purpose | Navigation Source | Auth Req | Current Status |
|---|---|---|---|---|---|
| `'NEW_PROJECT'` | [`NewProjectScreen`](file:///d:/surveynaksha/src/components/NewProjectScreen.tsx) | Project creation form | App launch; `Header` $\rightarrow$ "New Project"; `DataInputs` $\rightarrow$ "Back" | None | **`REAL`** (Creates project in PostgreSQL) |
| `'DATA_INPUTS'` | [`DataInputsScreen`](file:///d:/surveynaksha/src/components/DataInputsScreen.tsx) | Master 10-input channel readiness matrix | Submitted `NewProjectScreen`; `Header` $\rightarrow$ "10 Inputs"; Back from other screens | None | **`REAL`** (Reads PostgreSQL live channels) |
| `'UPLOAD_CATEGORY'` | [`CategoryUploadScreen`](file:///d:/surveynaksha/src/components/CategoryUploadScreen.tsx) | Real file upload & pre-validation | Click missing row in `DataInputsScreen` | None | **`REAL`** (XHR upload to backend storage) |
| `'SCANNER'` | [`DatasetScannerScreen`](file:///d:/surveynaksha/src/components/DatasetScannerScreen.tsx) | 10-stage physical file verification | After upload confirmed; Click non-missing row in `DataInputs` | None | **`REAL`** (SSE stream from FastAPI) |
| `'PROCESSING'` | [`ProcessingScreen`](file:///d:/surveynaksha/src/components/ProcessingScreen.tsx) | 3-column reconstruction pipeline monitor | `DataInputs` $\rightarrow$ "Dispatch Pipeline"; `Header` $\rightarrow$ "3D Process" | None | **`PARTIAL`** (Viewer loads real or fallback data; status metrics are hardcoded) |
| `'JOB_GRAPH'` | [`JobGraphScreen`](file:///d:/surveynaksha/src/components/JobGraphScreen.tsx) | DAG execution graph | `Header` $\rightarrow$ "JOB 001" | None | **`MOCKED`** (Simulated execution via `setInterval`) |
| `'WORKSPACE'` | [`Viewport2D3D`](file:///d:/surveynaksha/src/components/Viewport2D3D.tsx) + [`InputDeck`](file:///d:/surveynaksha/src/components/InputDeck.tsx) | Split view 2D cadastre + 10-channel deck | `DataInputs` $\rightarrow$ "Open 2D/3D Inspection"; `Processing` $\rightarrow$ "Inspect Cadastre" | None | **`MOCKED`** (Static SVG + sine-wave points) |
| `'CANONICAL_MODEL'` | [`CanonicalModelScreen`](file:///d:/surveynaksha/src/components/CanonicalModelScreen.tsx) | Unified canonical JSON/Tree & LADM export | `Header` $\rightarrow$ "Canonical Model"; `DataInputs` footer link | None | **`REAL`** (Reads real project JSON from API; falls back to static Pune model) |
| `'PROPERTY_3D'` | [`Property3DLayerScreen`](file:///d:/surveynaksha/src/components/Property3DLayerScreen.tsx) | 3D strata volume & floor isolation view | `Header` $\rightarrow$ "3D Property" | None | **`MOCKED`** (64 hardcoded BoxGeometry units in memory) |
| `'RECORD_MATCHING'` | [`RecordMatchingScreen`](file:///d:/surveynaksha/src/components/RecordMatchingScreen.tsx) | Unit ↔ deed matching table & conflict audit | `Header` $\rightarrow$ "Record Match" | None | **`PARTIAL`** (Queries backend endpoint; falls back to 16 hardcoded units) |
| `'VALIDATION'` | [`ValidationScreen`](file:///d:/surveynaksha/src/components/ValidationScreen.tsx) | 9 certified validation checklist items | `Header` $\rightarrow$ "Validation" | None | **`PARTIAL`** (Queries `/validation/final?simulate_failure=...`) |
| `'PACKAGES'` | [`OutputScreen`](file:///d:/surveynaksha/src/components/OutputScreen.tsx) | 4 deliverable package download screen | `Header` $\rightarrow$ "Outputs (4)"; `Validation` $\rightarrow$ "Proceed to Packages" | None | **`REAL`** (Downloads real backend ZIPs via HTTP) |

### Dead / Unreferenced Route Files
- [`src/components/PackageOutputsScreen.tsx`](file:///d:/surveynaksha/src/components/PackageOutputsScreen.tsx): Exists in the repository (576 lines), but is **nowhere imported or referenced** in `App.tsx` or any other active file. Replaced by `OutputScreen.tsx`.

---

## 4. LAYOUT SYSTEM

### 4.1 Global vs Screen Layouts
The application does **not** have a unified layout wrapper. The UI is split into two conflicting visual architectures:

1. **Minimalist White Architecture (Phases 5–20):**
   - Used by `NewProjectScreen`, `DataInputsScreen`, `CategoryUploadScreen`, `DatasetScannerScreen`, `ProcessingScreen`, `Property3DLayerScreen`, `RecordMatchingScreen`, `ValidationScreen`, `OutputScreen`.
   - Layout: Pure white full-screen background (`bg-white text-zinc-900`), single centered column or 3-column split, top back button with centered `NAKSHA 2.0` brand label, minimal single-line footer.
   - **Does NOT render `Header.tsx` or any navigation bar.** Users can only navigate via explicit "Back" or "Proceed" buttons.

2. **Dark Workspace Architecture (Phase 1–4):**
   - Used only when `currentScreen === 'WORKSPACE'` (`App.tsx` lines 457–498).
   - Layout: Dark background (`bg-naksha-darkest text-slate-100`).
   - Top Header (`Header.tsx`): 64px height, dark slate styling, brand icon, project metadata, PostGIS status indicator, 9 screen jumping buttons, and "Run Pipeline" CTA.
   - Upper Section: 48% height `Viewport2D3D.tsx`.
   - Lower Section: Remaining height `InputDeck.tsx` containing 10 `InputCard.tsx` items.

### 4.2 Layout Component Inventory
- **Header:** [`src/components/Header.tsx`](file:///d:/surveynaksha/src/components/Header.tsx) (**`PARTIAL`** — Only visible in `'WORKSPACE'` screen).
- **Sidebar:** **`NOT IMPLEMENTED`** (No sidebar exists in any screen).
- **Main Content:** Direct conditional container in [`src/App.tsx:317-500`](file:///d:/surveynaksha/src/App.tsx#L317-L500).
- **Footer:** **`STATIC`** (Each white screen renders its own static footer text; e.g. `DataInputsScreen.tsx:408`).
- **Breadcrumbs:** **`NOT IMPLEMENTED`**.
- **Modal System:** Local state React modals:
  - [`ArchitectureModal.tsx`](file:///d:/surveynaksha/src/components/ArchitectureModal.tsx): Live database health inspector (**`REAL`**).
  - [`PreflightModal.tsx`](file:///d:/surveynaksha/src/components/PreflightModal.tsx): Input channel detail card (**`STATIC`**).
  - Conflict Resolver Modal in [`ValidationScreen.tsx:340`](file:///d:/surveynaksha/src/components/ValidationScreen.tsx#L340) (**`PARTIAL`**).
- **Notification / Toast System:** **`NOT IMPLEMENTED`** (No toast library; only `window.alert()` in `App.tsx:313`).
- **Floating Overlays:**
  - [`JobMonitor.tsx`](file:///d:/surveynaksha/src/components/JobMonitor.tsx): Mounted globally at `fixed bottom-6 right-6 z-40` (**`REAL`** via WebSocket/polling).
  - [`LogPanel.tsx`](file:///d:/surveynaksha/src/components/LogPanel.tsx): Mounted globally at `fixed bottom-6 left-6 z-40` (**`REAL`** via WebSocket/REST).

---

## 5. CURRENT SURVEY TEAM UI

This section evaluates the UI against the core requirements of an operational field survey team.

| Survey Team Requirement | Current Screen / Component | Current Implementation Status | Forensic Finding |
|---|---|---|---|
| **Survey Team / Surveyor Profile** | None | **`NOT IMPLEMENTED`** | No login, no surveyor ID, no field crew profile, no active surveyor name display. |
| **Surveyor Assignment / Task Inbox** | None | **`NOT IMPLEMENTED`** | There is no screen showing assigned tasks, job orders, or survey mandates. |
| **Survey Project Selection** | [`NewProjectScreen.tsx`](file:///d:/surveynaksha/src/components/NewProjectScreen.tsx) | **`PARTIAL`** | Form creates a project in PostgreSQL, but there is no list to choose from existing assigned projects. |
| **Survey Parcel Demarcation** | [`Viewport2D3D.tsx`](file:///d:/surveynaksha/src/components/Viewport2D3D.tsx) | **`MOCKED / STATIC`** | Hardcoded SVG polygons labeled `Survey No. 45/1A` and `45/1B`. |
| **10-Channel Field Data Upload** | [`CategoryUploadScreen.tsx`](file:///d:/surveynaksha/src/components/CategoryUploadScreen.tsx) | **`REAL`** | Real XHR file upload storing raw files into backend storage cache. |
| **Field Data Validation** | [`DatasetScannerScreen.tsx`](file:///d:/surveynaksha/src/components/DatasetScannerScreen.tsx) | **`REAL`** | 10-stage physical file check on disk streaming via Server-Sent Events. |
| **Pipeline Processing** | [`ProcessingScreen.tsx`](file:///d:/surveynaksha/src/components/ProcessingScreen.tsx) | **`PARTIAL`** | Stage stepper animates and displays real or deterministic 3D scenes; backend job triggered. |
| **3D Strata / Property Viewer** | [`Property3DLayerScreen.tsx`](file:///d:/surveynaksha/src/components/Property3DLayerScreen.tsx) | **`MOCKED`** | Procedural BoxGeometry units with hardcoded Pune owners; no connection to uploaded project files. |
| **Survey & Cadastral Report** | None | **`NOT IMPLEMENTED`** | No printable or downloadable survey report (only JSON LADM in `CanonicalModelScreen`). |
| **ULPIN Assignment** | Static strings across 5 files | **`STATIC / MOCKED`** | Hardcoded `27-07-005-012345` / `MH-PUN-2026-0942`; no dynamic generation from parcel coordinates. |
| **Property Card Generation** | None | **`NOT IMPLEMENTED`** | Zero UI for generating, viewing, or exporting City Survey Property Cards (Milkat Patra). |

> **Conclusion for Section 5:** A true end-to-end **Survey Team workflow is NOT IMPLEMENTED.** The application currently transitions immediately from a generic "New Project" creation form into raw data category upload without surveyor assignment, parcel selection, or field task management.

---

## 6. CURRENT PROJECT / PARCEL SELECTION

### Evaluation of Assigned Parcel Workflow:
`Assigned survey parcels` $\rightarrow$ `Parcel selection` $\rightarrow$ `Project opening`

- **Assigned Survey Parcels Component:** **`NOT IMPLEMENTED`**. There is no table, list, or API query for assigned parcels.
- **Parcel Selection Component:** **`NOT IMPLEMENTED`**. The user cannot select or search for a parcel.
- **Project Selection / Opening:** **`PARTIAL`**.
  - Users can create a project via `NewProjectScreen.tsx`, which triggers `POST /api/v2/projects` (`App.tsx` line 171).
  - However, there is **no UI to open an existing project**, view past projects, or search projects. Once a project is created, its ID is stored in React memory (`projectId`).
- **Map Component:** **`MOCKED / STATIC`**.
  - `Viewport2D3D.tsx` lines 163–216 render a **static SVG canvas** with hardcoded coordinates:
    ```xml
    <polygon points="220,140 440,120 460,260 210,290" />
    <text x="310" y="200">ULPIN: 27-24-004-101</text>
    <text x="310" y="215">Survey No. 45/1A • 1.24 Ha</text>
    ```
  - MapLibre GL is imported in `package.json` (`maplibre-gl: ^4.1.1`) and linked in `index.html`, but **is never instantiated in any React component**.
- **Parcel Details:** **`STATIC / MOCKED`**. Hardcoded in `types/canonical.ts:231-240`:
  ```ts
  parcel: {
    survey_number: '142',
    sub_division: 'B',
    ulpin: 'MH-PUN-2026-0942',
    village: 'Haveli',
    taluka: 'Haveli',
    district: 'Pune',
    state: 'Maharashtra',
    legal_recorded_area_sqm: 1600.0,
    gis_computed_area_sqm: 1598.4
  }
  ```
- **Existing ULPIN Display:** **`STATIC`**. Hardcoded text in `Viewport2D3D.tsx:176` (`27-24-004-101`), `Real3DViewer.tsx:443` (`MH-PUN-0942`), and `types/canonical.ts:234`.

---

## 7. CURRENT 10-INPUT UPLOAD UI

The upload interface exists in two separate places in the codebase:
1. Primary: [`CategoryUploadScreen.tsx`](file:///d:/surveynaksha/src/components/CategoryUploadScreen.tsx) (opened when clicking a missing row in `DataInputsScreen`).
2. Secondary: [`InputDeck.tsx`](file:///d:/surveynaksha/src/components/InputDeck.tsx) (in the `WORKSPACE` screen).

### Category-by-Category Forensic Audit

| Category | Category ID | UI Component | Drag / Drop | Multi-file | File List | Upload Status | Validation Status | Progress | Error State | API Call | Backend Connection | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1. Photogrammetry** | `CAT_01_PHOTOGRAMMETRY` | `CategoryUploadScreen` | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** (XHR bytes) | **REAL** | `POST /api/v2/datasets/upload` | Saves to `storage_cache/` | **`REAL`** |
| **2. LiDAR / Point Cloud** | `CAT_02_LIDAR_POINT_CLOUD` | `CategoryUploadScreen` | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** (XHR bytes) | **REAL** | `POST /api/v2/datasets/upload` | Saves to `storage_cache/` | **`REAL`** |
| **3. GIS / CAD** | `CAT_03_GIS_CAD` | `CategoryUploadScreen` | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** (XHR bytes) | **REAL** | `POST /api/v2/datasets/upload` | Saves to `storage_cache/` | **`REAL`** |
| **4. GNSS / Survey** | `CAT_04_GNSS_SURVEY` | `CategoryUploadScreen` | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** (XHR bytes) | **REAL** | `POST /api/v2/datasets/upload` | Saves to `storage_cache/` | **`REAL`** |
| **5. DEM / Elevation** | `CAT_05_DEM_ELEVATION` | `CategoryUploadScreen` | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** (XHR bytes) | **REAL** | `POST /api/v2/datasets/upload` | Saves to `storage_cache/` | **`REAL`** |
| **6. Architectural / BIM** | `CAT_06_ARCHITECTURAL_BIM` | `CategoryUploadScreen` | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** (XHR bytes) | **REAL** | `POST /api/v2/datasets/upload` | Saves to `storage_cache/` | **`REAL`** |
| **7. Property & Vertical Data** | `CAT_07_PROPERTY_VERTICAL_DATA` | `CategoryUploadScreen` | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** (XHR bytes) | **REAL** | `POST /api/v2/datasets/upload` | Saves to `storage_cache/` | **`REAL`** |
| **8. Imagery / Orthophoto** | `CAT_08_IMAGERY_ORTHOPHOTO` | `CategoryUploadScreen` | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** (XHR bytes) | **REAL** | `POST /api/v2/datasets/upload` | Saves to `storage_cache/` | **`REAL`** |
| **9. Project / Metadata** | `CAT_09_PROJECT_METADATA` | `CategoryUploadScreen` | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** (XHR bytes) | **REAL** | `POST /api/v2/datasets/upload` | Saves to `storage_cache/` | **`REAL`** |
| **10. Supporting Documents** | `CAT_10_SUPPORTING_DOCS` | `CategoryUploadScreen` | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** | **REAL** (XHR bytes) | **REAL** | `POST /api/v2/datasets/upload` | Saves to `storage_cache/` | **`REAL`** |

### Upload Code Analysis & Gotchas
1. **Real Upload Flow (`CategoryUploadScreen.tsx:65-147`):**
   - Appends files to a `FormData` payload with `project_id`, `category_id`, and `dataset_name`.
   - Uses an explicit `XMLHttpRequest` with `xhr.upload.onprogress` to calculate **actual physical bytes uploaded** (`Math.round((event.loaded / event.total) * 100)`).
   - Upon upload completion, automatically fires `POST /api/v2/datasets/{dataset_id}/validate` to inspect headers, CRS, and points.
   - Saves files to disk under `storage_cache/{project_id}/{category_id}/{dataset_id}/`.
2. **Mock Fallback in `DataInputsScreen.tsx:167-187`:**
   - If `onOpenUpload` is not passed or a fallback is triggered, a synthetic hidden `<input type="file">` is clicked. Upon file selection, it immediately marks the channel as:
     ```ts
     status: 'Valid', completeness: 100, quality: 90, readyForProcessing: true
     ```
     without uploading anything to the backend.
3. **Mock Drop in `InputDeck.tsx:36-42` & `App.tsx:311-314`:**
   - Dragging and dropping files onto the `InputDeck` calls `handleFilesDropped`, which executes:
     ```ts
     alert(`Received ${files.length} file(s). Naksha Ingestion Dispatcher automatically routed these into their respective Input Types without exposing filesystem folders!`);
     ```
     This is purely a **`PLACEHOLDER`**.

---

## 8. CURRENT UPLOAD STATE MANAGEMENT

Upload state is managed using standard React `useState` hooks.  
**No Redux, Zustand, Context API, or localStorage is used.**

### Exact State Data Structures

1. In [`src/components/CategoryUploadScreen.tsx:15-25`](file:///d:/surveynaksha/src/components/CategoryUploadScreen.tsx#L15-L25):
```typescript
interface UploadState {
  status: 'idle' | 'uploading' | 'validating' | 'done' | 'error';
  progress: number;            // 0-100 from xhr.upload.onprogress
  datasetId?: string;          // Returned by POST /api/v2/datasets/upload
  datasetName?: string;
  filesUploaded?: number;      // Actual files saved on disk
  totalBytes?: number;         // Total bytes transferred
  validationResult?: {
    quality_score: number;
    ready_for_processing: boolean;
    crs_detected?: string;
    point_count?: number;
    checks: Array<{ check: string; status: 'pass' | 'warning' | 'fail'; value?: string }>;
  };
  error?: string;
  rejected?: Array<{ filename: string; reason: string }>;
}
```

2. In [`src/components/DataInputsScreen.tsx:11-22`](file:///d:/surveynaksha/src/components/DataInputsScreen.tsx#L11-L22):
```typescript
interface DataInputItem {
  id: string;                  // e.g. "cat_01"
  num: string;                 // e.g. "01"
  name: string;                // e.g. "Photogrammetry"
  status: DatasetStatus;       // 'Missing' | 'Scanning' | 'Invalid' | 'Partial' | 'Valid' | 'Processing' | 'Completed'
  tier: DatasetTier;           // 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL'
  completeness: number;        // 0-100
  quality: number;             // 0-100
  readyForProcessing: boolean;
  filesFound?: number;
  datasetId?: string;
}
```

3. In [`src/App.tsx:25-153`](file:///d:/surveynaksha/src/App.tsx#L25-L153):
`ProjectVirtualState` stores the 10 channels. When an upload finishes, `handleDatasetSaved` triggers `refreshLiveChannels()`, fetching `GET /api/v2/projects/{projectId}/inputs/live` and updating `project.channels` from PostgreSQL.

---

## 9. CURRENT VALIDATION UI

### 9.1 Post-Upload Validation Flow
After clicking `[ SELECT FILES ]` $\rightarrow$ `UPLOAD & VALIDATE` in `CategoryUploadScreen.tsx`, clicking `CONFIRM DATASET →` routes to `DatasetScannerScreen.tsx` (`currentScreen = 'SCANNER'`).

### 9.2 `DatasetScannerScreen.tsx` Forensic Analysis
- **Scanning Animation:** Pulse and spin icons next to currently active step.
- **Percentage:** Driven by `currentStepIdx * 10` (10 steps total).
- **Checklist:** Displays 10 sequential pipeline stages:
  1. Uploaded files (Inspecting physical files on disk)
  2. File signature (Verifying magic byte signatures)
  3. Format parser (Parsing format headers and structures)
  4. Metadata extraction (Extracting counts, camera tags)
  5. Coordinate/CRS detection (Detecting EPSG)
  6. Geometry checks (Evaluating spatial bounding box)
  7. Dataset requirements (Validating mandatory components)
  8. Quality checks (Evaluating quantitative metrics)
  9. Completeness calculation (Calculating verified completeness)
  10. Final dataset status (Persisting verdict to PostgreSQL)
- **Backend Connection:** **`REAL`**. Connects via Server-Sent Events to `GET /api/v2/datasets/{targetId}/scan/stream`. Each progress event emitted corresponds to a real server check. Direct POST fallback (`POST /api/v2/datasets/{targetId}/scan`) exists if streaming fails.
- **Verdict Persistence:** Verdict (completeness, quality, status) is stored in the PostgreSQL database.

### 9.3 `ValidationScreen.tsx` (Pre-Output Gatekeeper) Forensic Analysis
- Located at virtual route `'VALIDATION'` (accessed via Header button).
- Shows 9 cadastral checks: CRS, Geometry validity, 2D parcel association, 3D geometry validity, Floor consistency, Unit boundary consistency, Record association, Topology, Coordinate validity.
- **Backend Connection:** **`PARTIAL`**.
  - Calls `GET /api/v2/validation/final?simulate_failure=${failureFlag}`.
  - Notice the query parameter: `simulate_failure=true|false`.
  - When failure is triggered, it loads mock issue data (`active_issues: [ { headline: 'Boundary Overlap Detected', ... } ]`).
  - Clicking "Resolve Issue" calls `POST /api/v2/validation/resolve-issue/{id}`, then runs a `setTimeout` of 1200ms before clearing the issue.

---

## 10. CURRENT PROGRESS IMPLEMENTATION

Below is the complete forensic catalog of all timer-driven, simulated, and synthetic progress indicators across the frontend:

| File Path | Code Location | What Visually Shows | Actual Source / Mechanism | Classification |
|---|---|---|---|---|
| [`App.tsx`](file:///d:/surveynaksha/src/App.tsx#L287-L308) | `handleDispatchPipeline` | "Processing In Background..." spinner $\rightarrow$ Photogrammetry & Orthophoto "Completed" | `setTimeout(..., 2500)` switches state locally | **`MOCKED`** |
| [`JobGraphScreen.tsx`](file:///d:/surveynaksha/src/components/JobGraphScreen.tsx#L330-L370) | `handleRunGraph` | DAG nodes turning from PENDING $\rightarrow$ RUNNING $\rightarrow$ SUCCESS | `setInterval(..., 280)` advances nodes artificially | **`MOCKED`** |
| [`OutputScreen.tsx`](file:///d:/surveynaksha/src/components/OutputScreen.tsx#L35-L39) | `handleDownloadSingle` | Spinner on package button $\rightarrow$ Checkmark | `setTimeout(..., 800)` clears spinner | **`MOCKED TIMER`** |
| [`OutputScreen.tsx`](file:///d:/surveynaksha/src/components/OutputScreen.tsx#L52-L60) | `handleDownloadAll` | "PREPARING ARCHIVE..." spinner $\rightarrow$ Checkmark | `setTimeout(..., 1200)` clears spinner | **`MOCKED TIMER`** |
| [`PackageOutputsScreen.tsx`](file:///d:/surveynaksha/src/components/PackageOutputsScreen.tsx#L55-L72) | `handleGenerateAll` | Progress bar 10% $\rightarrow$ 100% | `setInterval(..., 200)` adding +15% every 200ms | **`MOCKED`** (Unused file) |
| [`ValidationScreen.tsx`](file:///d:/surveynaksha/src/components/ValidationScreen.tsx#L217-L233) | `handleResolveIssue` | "Resolving boundary overlap..." spinner | `setTimeout(..., 1200)` + `setTimeout(..., 600)` | **`MOCKED TIMER`** |
| [`CategoryUploadScreen.tsx`](file:///d:/surveynaksha/src/components/CategoryUploadScreen.tsx#L83-L88) | `xhr.upload.onprogress` | 0% to 95% upload progress bar | **Actual physical byte stream** (`event.loaded / event.total`) | **`REAL`** |
| [`DatasetScannerScreen.tsx`](file:///d:/surveynaksha/src/components/DatasetScannerScreen.tsx#L109-L171) | `executeRealScan` | 10% to 100% step progression | **Server-Sent Events stream** from backend scanner | **`REAL`** |
| [`JobMonitor.tsx`](file:///d:/surveynaksha/src/components/JobMonitor.tsx#L59-L110) | `useEffect` | Celery job progress (70% $\rightarrow$ stages) | WebSocket messages & `setInterval(fetchLatestJob, 2500)` polling | **`REAL / PARTIAL`** |

---

## 11. CURRENT PROCESSING SCREEN

### 11.1 Component Breakdown
- **Component File:** [`src/components/ProcessingScreen.tsx`](file:///d:/surveynaksha/src/components/ProcessingScreen.tsx) (384 lines).
- **Layout:** 3-column horizontal flex layout with pure white background:
  1. **Left Column (Processing Checklist, w-64):**
     - Lists 10 pipeline steps: Data Validation, Coordinate Alignment, Photogrammetry, LiDAR Processing, Point Cloud Fusion, Building Reconstruction, Property Segmentation, Record Matching, Validation, Package Generation.
     - Steps are marked `✓` (done), `●` (active blue pulsing dot), or `○` (pending).
     - Clicking any step manually jumps the active stage.
  2. **Center Column (Real 3D Viewer, flex-1):**
     - Title: "REAL 3D VIEWER".
     - 7-Stage Stepper Buttons: `1. PHOTOGRAMMETRY` $\rightarrow$ `2. LIDAR` $\rightarrow$ `3. FUSION` $\rightarrow$ `4. BUILDING` $\rightarrow$ `5. PROPERTY` $\rightarrow$ `6. RECORD MATCHING` $\rightarrow$ `7. VALIDATION`.
     - Subtitle banner (e.g. "CADASTRAL STRATA DELINEATION • Extracting 3D legal property unit boundaries").
     - Viewport window embedding `<Real3DViewer />`.
     - Callout overlays:
       - Stage 6: Floating card showing Unit 402 owner, CTS number, ULPIN, and "100% REVENUE TITLE MATCHED".
       - Stage 7: Floating card showing Cadastral Validation checks.
     - Bottom Controls: "Auto-Rotate 360°" and "Reset View" buttons.
  3. **Right Column (Status Metrics, w-64):**
     - Point Cloud count (e.g. `14.8M Points`).
     - Buildings count (e.g. `1 Structure`).
     - Floors count (e.g. `4 Floors`).
     - Units count (e.g. `16 Units`).
     - Government Records (e.g. `64 / 64 (100%)`).
     - Progress (e.g. `78%`).
     - **All right-column metrics are hardcoded** in `src/types/naksha.ts:CANONICAL_PROCESSING_STAGES`.

### 11.2 Nature of the 3D Object Rendered
**CRITICAL CLASSIFICATION:**
The 3D model shown is **C) PROCEDURALLY GENERATED** with **B) STATIC FALLBACK FILE**.
- It is **NOT** reconstructed from user-uploaded drone photos or LAS files.
- If backend endpoint `/api/v2/visualization/scene-layers` is unreachable, `Real3DViewer.tsx` calls `generateDeterministicScan()` (lines 678–775).
- Point clouds are synthesized using deterministic trigonometry loops:
  - Ground: `for (let x = -15; x <= 15; x += 0.8)`
  - Walls: `for (let h = 0.2; h <= 14.8; h += 0.35)`
- The building envelope is a literal `THREE.BoxGeometry(11, 15, 15)`.
- The floor slabs are four `THREE.BoxGeometry(11.2, 0.18, 15.2)`.
- The units are sixteen `THREE.BoxGeometry(5.2, 3.3, 7.1)`.

---

## 12. CURRENT THREE.JS / 3D VIEWER

### 12.1 Technical Specifications
- **Component:** [`src/components/Real3DViewer.tsx`](file:///d:/surveynaksha/src/components/Real3DViewer.tsx) & [`src/components/Property3DViewer.tsx`](file:///d:/surveynaksha/src/components/Property3DViewer.tsx).
- **Library & Version:** Three.js `^0.162.0` (with `three/examples/jsm/controls/OrbitControls.js`).
- **Scene:** `THREE.Scene()` with `scene.background = new THREE.Color(0xffffff)` (pure white studio background).
- **Camera:** `THREE.PerspectiveCamera(45, width / height, 0.1, 1000)` positioned at `(24, 20, 28)`.
- **Controls:** `OrbitControls` with damping enabled (`dampingFactor = 0.05`), max polar angle `Math.PI / 2 - 0.04` (prevents camera dipping below ground plane).
- **Lighting:**
  - `AmbientLight(0xffffff, 0.85)`
  - Key `DirectionalLight(0xffffff, 0.95)` at `(25, 40, 25)` casting soft shadows (`PCFSoftShadowMap`)
  - Fill `DirectionalLight(0xf1f5f9, 0.45)` at `(-20, 16, -20)`
- **Ground Grid:** `THREE.GridHelper(36, 36, 0xd4d4d8, 0xf4f4f5)` + shadow receiving plane.

### 12.2 Layer System in `Real3DViewer.tsx`
The viewer maintains 6 explicit `THREE.Group` instances:
1. `lidarGroup`: BufferGeometry points (`PointsMaterial({ size: 0.14 })`) + scanner tripod cylinder + cyan sweep cone mesh.
2. `photoGroup`: BufferGeometry points (`PointsMaterial({ size: 0.13 })`) + dashed purple aerial flight trajectory curve (`CatmullRomCurve3`).
3. `fusedGroup`: Combined point cloud + blue co-registration ring mesh (`RingGeometry(8, 8.2)`).
4. `buildingGroup`: Building point cloud + translucent superstructure massing mesh (`BoxGeometry(11, 15, 15)`) + black edge lines (`EdgesGeometry`).
5. `floorGroup`: 4 horizontal floor slabs (`BoxGeometry(11.2, 0.18, 15.2)`).
6. `unitGroup`: 16 colored strata unit boxes (`BoxGeometry(5.2, 3.3, 7.1)`) with raycasting selection and label sprites.

### 12.3 3D Assets Loaded
- **GLB / GLTF files loaded:** **ZERO**. No `.glb` or `.gltf` loaders are called in any frontend viewer.
- **External OBJ / PLY / LAS files loaded:** **ZERO**. All geometry is constructed dynamically in memory using Three.js geometry primitives and typed float arrays.

---

## 13. CURRENT 3D BUILDING

### Reality Check: Procedural Geometry vs Reconstructed Mesh
The building in the current UI is **100% PROCEDURAL BOX GEOMETRY**.

Evidence from [`src/components/Real3DViewer.tsx:324-341`](file:///d:/surveynaksha/src/components/Real3DViewer.tsx#L324-L341):
```typescript
// LoD-2 Massing Envelope Mesh
const massGeo = new THREE.BoxGeometry(11, 15, 15);
const massMat = new THREE.MeshStandardMaterial({
  color: 0xf8fafc,
  transparent: true,
  opacity: 0.35,
  roughness: 0.2
});
const massMesh = new THREE.Mesh(massGeo, massMat);
massMesh.position.y = 7.5;
massMesh.castShadow = true;
buildingGroup.current.add(massMesh);

const edgesGeo = new THREE.EdgesGeometry(massGeo);
const edgesMat = new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 1.5 });
const edges = new THREE.LineSegments(edgesGeo, edgesMat);
edges.position.y = 7.5;
buildingGroup.current.add(edges);
```

Evidence from [`src/components/Property3DViewer.tsx:174-180`](file:///d:/surveynaksha/src/components/Property3DViewer.tsx#L174-L180):
```typescript
// Building Envelope Wireframe Ghost
const bldgBoxGeo = new THREE.BoxGeometry(8, 12, 10);
const bldgEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(bldgBoxGeo),
  new THREE.LineBasicMaterial({ color: 0xd4d4d8, linewidth: 1 })
);
bldgEdges.position.y = 6;
scene.add(bldgEdges);
```

> **Verdict:** There is **no real 3D mesh reconstruction pipeline connected to the UI**. The building envelope is a static wireframe cube of dimensions $11\text{m} \times 15\text{m} \times 15\text{m}$ or $8\text{m} \times 12\text{m} \times 10\text{m}$.

---

## 14. CURRENT FLOOR / APARTMENT UI

### 14.1 Strata Demarcation Hierarchy
The application provides a dedicated screen: [`Property3DLayerScreen.tsx`](file:///d:/surveynaksha/src/components/Property3DLayerScreen.tsx).  
It displays the hierarchy:
$$\text{Building} \longrightarrow \text{Floor (1 to 8)} \longrightarrow \text{Apartment (Units 101 to 808)} \longrightarrow \text{3D Volume}$$

### 14.2 Apartment Reality Audit
- **Are apartments hardcoded?** **YES**.
  - All 64 apartments are generated by an in-memory immediately-invoked function expression in [`src/components/Property3DLayerScreen.tsx:20-126`](file:///d:/surveynaksha/src/components/Property3DLayerScreen.tsx#L20-L126).
  - 8 floors $\times$ 8 units per floor = 64 units.
  - Owners are assigned from a hardcoded 8-name array (`Rajesh M. Patil`, `Sunita R. Kulkarni`, `Amit V. Deshmukh`, etc.).
  - Default selected unit: `Unit 302` (`Sunita R. Kulkarni`, carpet area: $84.50\text{ m}^2$, $X=385435.42$, $Y=2048168.18$, $Z=546.65$).
- **How is apartment geometry generated?**
  - In [`Property3DViewer.tsx:194-220`](file:///d:/surveynaksha/src/components/Property3DViewer.tsx#L194-L220):
    ```typescript
    const uWidth = 8 / 2 - 0.12;   // 2 units along X
    const uLength = 10 / 4 - 0.12; // 4 units along Z
    const uHeight = floorHeight - 0.16;
    const uGeo = new THREE.BoxGeometry(uWidth, uHeight, uLength);
    ```
  - Every apartment is an identical extruded cuboid box colored from a pastel palette (`0x38bdf8`, `0x34d399`, `0xfbbf24`, etc.).
- **Interactive Features:**
  - **Floor Isolation:** Clicking floor buttons (1 through 8) hides all other floor meshes.
  - **Exploded View:** Toggling "Exploded View" shifts each floor group upwards by `(f - 1) * 3.2` meters.
  - **Unit Click:** Raycasting selects unit and updates the right-hand metadata inspector.

---

## 15. CURRENT ULPIN UI

### 15.1 ULPIN Audit Across the Application

| Location | Formatter / Value | Data Source | Generation Logic | Connected to Authority? |
|---|---|---|---|---|
| [`Viewport2D3D.tsx:176`](file:///d:/surveynaksha/src/components/Viewport2D3D.tsx#L176) | `27-24-004-101` | Static SVG string | Hardcoded in SVG `<text>` | **NO** |
| [`ProcessingScreen.tsx:39`](file:///d:/surveynaksha/src/components/ProcessingScreen.tsx#L39) | `MH-PUN-2026-0942-8812` | React state | Hardcoded initial state | **NO** |
| [`Property3DLayerScreen.tsx:91`](file:///d:/surveynaksha/src/components/Property3DLayerScreen.tsx#L91) | `27-07-005-012345-F03-A` | Generated in memory | Template: `${base_ulpin}-F${floor}-${unitLetter}` | **NO** |
| [`RecordMatchingScreen.tsx:132`](file:///d:/surveynaksha/src/components/RecordMatchingScreen.tsx#L132) | `27-07-005-012345-302` | In-memory catalog | Template: `27-07-005-012345-${unitNum}` | **NO** |
| [`CanonicalModelScreen.tsx:381`](file:///d:/surveynaksha/src/components/CanonicalModelScreen.tsx#L381) | `27-07-005-012345-F03-A` | Canonical JSON model | Read from JSON property `display_ulpin_3d` | **NO** |

- **Where Stored:** Exclusively in frontend TypeScript objects and in the PostgreSQL `cadastral_parcels` table.
- **How Generated:** Client-side string concatenation (`base_ulpin + '-' + floor_id + '-' + unit_id`).
- **Connection to Bhu-Naksha / NIC:** **`NOT IMPLEMENTED`**. Zero network requests are made to Bhu-Naksha or any state land records API.

---

## 16. CURRENT REPORT UI

- **Generate Report:** **`NOT IMPLEMENTED`** (No button or action generates a PDF or printable survey report).
- **Report Preview:** **`NOT IMPLEMENTED`** (No document viewer or report preview screen).
- **Report Download:** **`PARTIAL`**.
  - In `CanonicalModelScreen.tsx:108-143`, users can download an **ISO 19152 LADM JSON file** (`NAKSHA_MH-PUN-2026-VIL04_ISO19152_LADM.json`) generated on the fly via `URL.createObjectURL(new Blob(...))`.
  - There is no human-readable survey report (no PDF, DOCX, or HTML summary).
- **Report Status / Metadata:** **`PARTIAL`** (Displayed as raw JSON properties in the Canonical tree).

---

## 17. CURRENT BHU-NAKSHA FLOW

A forensic search for `bhu`, `bhunaksha`, and `bhu-naksha` across all frontend and backend code yields:

- **Is there an actual API?** **`NO / NOT IMPLEMENTED`**.
- **Is there a mock API?** **`NO`**.
- **Is there a fake "Send to Bhu-Naksha" button?** **`NO`**. There is no button anywhere in the UI with this label.
- **What happens after clicking?** N/A (no such control exists).
- **What response is expected?** N/A.
- **Is ULPIN actually received from Bhu-Naksha?** **`NO`**. All ULPIN strings are fabricated locally.

> **Gotcha:** Backend file [`backend/cadastral_identity.py:49`](file:///d:/surveynaksha/backend/cadastral_identity.py#L49) contains an enum member `COMPACT_BHU_AADHAAR = "COMPACT_BHU_AADHAAR"`, but this is merely an internal string formatting algorithm. No external Bhu-Naksha gateway exists.

---

## 18. CURRENT NOTIFICATION SYSTEM

- **Toast Notifications:** **`NOT IMPLEMENTED`** (No toast library installed; no `react-toastify`, `sonner`, or custom toast container).
- **Snackbars:** **`NOT IMPLEMENTED`**.
- **System / OS Notifications:** **`NOT IMPLEMENTED`** (Tauri notification API is not configured).
- **Alerts:** [`src/App.tsx:313`](file:///d:/surveynaksha/src/App.tsx#L313) uses browser-native `alert()`.
- **Can the application display "ULPIN Generated"?** **`NO / NOT IMPLEMENTED`**. No code or component in the repository displays this message.

---

## 19. CURRENT PROPERTY CARD UI

- **Create Property Card:** **`NOT IMPLEMENTED`**.
- **Property Card Preview:** **`NOT IMPLEMENTED`**.
- **Download Property Card:** **`NOT IMPLEMENTED`**.
- **Save Property Card:** **`NOT IMPLEMENTED`**.

> **Note:** The string `property_card` only appears in [`backend/dataset_model.py:191`](file:///d:/surveynaksha/backend/dataset_model.py#L191) as a keyword heuristic to classify uploaded files in Category 07 or 10. There is no UI representation of a Maharashtra City Survey Property Card (Milkat Patra / Akhiv Patrika).

---

## 20. CURRENT DATABASE CONNECTION FROM UI

Tracing the path from user action to PostgreSQL database:

| User Action | UI Component | Frontend Function | API Endpoint | Backend Route & DB Operation | Classification |
|---|---|---|---|---|---|
| **Create Project** | `NewProjectScreen.tsx` | `handleCreateProject()` | `POST /api/v2/projects` | `backend/project_engine.py` $\rightarrow$ `INSERT INTO projects` | **`REAL`** |
| **Upload Files** | `CategoryUploadScreen.tsx` | `handleUpload()` | `POST /api/v2/datasets/upload` | `backend/ingestion.py` $\rightarrow$ `INSERT INTO datasets`, saves files to disk | **`REAL`** |
| **Validate Dataset** | `CategoryUploadScreen.tsx` | `validateRes` | `POST /api/v2/datasets/{id}/validate` | `backend/ingestion.py` $\rightarrow$ Runs file checks, updates `datasets` row | **`REAL`** |
| **Stream Scan** | `DatasetScannerScreen.tsx` | `executeRealScan()` | `GET /api/v2/datasets/{id}/scan/stream` | `backend/scanner.py` $\rightarrow$ Reads physical files, persists metrics to DB | **`REAL`** |
| **Refresh Live Channels** | `DataInputsScreen.tsx` | `handleScanData()` | `GET /api/v2/projects/{id}/inputs/live` | `backend/main.py` $\rightarrow$ `SELECT` across `datasets` grouped by channel | **`REAL`** |
| **Run Pipeline** | `Header.tsx` | `handleDispatchPipeline()` | `POST /api/v2/jobs/dispatch` | `backend/job_engine.py` $\rightarrow$ Dispatches Celery worker background task | **`REAL`** |
| **Inspect DB Health** | `ArchitectureModal.tsx` | `fetchStatus()` | `GET /api/v2/database/health` | `backend/main.py` $\rightarrow$ Queries PostgreSQL `version()` & PostGIS | **`REAL`** |
| **Download Package** | `OutputScreen.tsx` | `handleDownloadSingle()` | `GET /api/v2/packages/download/{id}` | `backend/deliverable_packages.py` $\rightarrow$ Streams compiled ZIP file | **`REAL`** |
| **Load 3D Scene** | `Real3DViewer.tsx` | `fetchLayers()` | `GET /api/v2/visualization/scene-layers` | `backend/visualization.py` $\rightarrow$ Returns layer JSON | **`REAL / PARTIAL`** |
| **Record Matching** | `RecordMatchingScreen.tsx` | `fetchMatchingData()` | `GET /api/v2/records/matching/summary` | Relative URL without `API_BASE`; falls back to mock catalog | **`PARTIAL`** |
| **Run Job Graph** | `JobGraphScreen.tsx` | `handleRunGraph()` | None | **NEVER REACHES BACKEND** (`setInterval` simulation) | **`MOCKED`** |
| **Generate Report** | None | None | None | **NEVER REACHES BACKEND** | **`NOT IMPLEMENTED`** |
| **Send to Bhu-Naksha** | None | None | None | **NEVER REACHES BACKEND** | **`NOT IMPLEMENTED`** |
| **Receive ULPIN** | None | None | None | **NEVER REACHES BACKEND** | **`NOT IMPLEMENTED`** |
| **Create Property Card**| None | None | None | **NEVER REACHES BACKEND** | **`NOT IMPLEMENTED`** |

---

## 21. CURRENT API SERVICE LAYER

There is no dedicated centralized API client (like an Axios instance with interceptors). Frontend fetch calls are written directly inside individual components using `fetch()` or `XMLHttpRequest`.

### Complete Frontend API Call Inventory

| HTTP Method | Target URL | Initiating Component | Request Payload | Response Schema | Real / Mock Backend |
|---|---|---|---|---|---|
| `POST` | `${API_BASE}/api/v2/projects` | `App.tsx:171` | `{ name, location, survey_date, status, target_crs_epsg, accuracy_tier }` | `{ project_id, code, name, location, ... }` | **REAL** (PostgreSQL) |
| `GET` | `${API_BASE}/api/v2/projects/{id}/inputs/live` | `App.tsx:212`, `DataInputsScreen:118` | None | `{ project_id, channels: [...] }` | **REAL** (PostgreSQL) |
| `POST` | `${API_BASE}/api/v2/projects/{id}/scan` | `DataInputsScreen:115` | None | `{ status: "SUCCESS", scanned: true }` | **REAL** |
| `POST` | `${API_BASE}/api/v2/datasets/upload` | `CategoryUploadScreen:81` | `FormData` (files, project_id, category_id, dataset_name) | `{ dataset_id, dataset_name, files_saved, total_bytes }` | **REAL** (Disk storage) |
| `POST` | `${API_BASE}/api/v2/datasets/{id}/validate` | `CategoryUploadScreen:123` | None | `{ quality_score, ready_for_processing, crs_detected, checks: [...] }` | **REAL** |
| `GET` | `${API_BASE}/api/v2/datasets/{id}/scan/stream` | `DatasetScannerScreen:110` | None (SSE stream) | `data: { type: 'step'|'complete', data: {...} }` | **REAL** (SSE) |
| `POST` | `${API_BASE}/api/v2/datasets/{id}/scan` | `DatasetScannerScreen:114` | None (Fallback) | `{ dataset_id, steps: [...], quality: number, ... }` | **REAL** |
| `POST` | `${API_BASE}/api/v2/jobs/dispatch` | `App.tsx:280`, `JobMonitor:115` | None | `{ job: { job_id, status, ... } }` | **REAL** (Celery) |
| `GET` | `${API_BASE}/api/v2/jobs/JOB%20%231024` | `JobMonitor:60` | None | `{ job_id, overall_progress, stages: [...] }` | **REAL** |
| `GET` | `http://127.0.0.1:8000/api/v2/visualization/scene-layers` | `Real3DViewer:100` | None | `{ layers: { lidar, photogrammetry, fused, building, floors, units } }` | **REAL / PARTIAL** |
| `GET` | `http://localhost:8000/api/v2/canonical/project/PROJ-PUNE-001` | `CanonicalModelScreen:55` | None | Canonical project JSON tree | **REAL / PARTIAL** |
| `GET` | `/api/v2/records/matching/summary` | `RecordMatchingScreen:164` | None (Relative path) | `{ units: [...] }` | **PARTIAL** |
| `GET` | `/api/v2/validation/final?simulate_failure=...` | `ValidationScreen:122` | Query params | `{ checks: [...], overall_percentage, active_issues }` | **PARTIAL** |
| `POST` | `/api/v2/validation/resolve-issue/{id}` | `ValidationScreen:197` | `{ resolution_type: 'OVERRIDE_APPROVED' }` | `{ status: 'RESOLVED', report: {...} }` | **PARTIAL** |
| `GET` | `${API_BASE}/api/v2/packages/download/{id}` | `OutputScreen:27` | Browser navigation | ZIP binary stream | **REAL** |
| `GET` | `${API_BASE}/api/v2/packages/download-all` | `OutputScreen:44` | Browser navigation | Combined ZIP binary stream | **REAL** |
| `GET` | `${API_BASE}/api/v2/logs?limit=100` | `LogPanel:78` | None | `{ entries: [...] }` | **REAL** |
| `GET` | `${backendUrl}/api/v2/database/health` | `ArchitectureModal:18` | None | `{ status: "CONNECTED", database: "postgres", postgis: "3.3.7" }` | **REAL** |

---

## 22. CURRENT WEBSOCKET IMPLEMENTATION

WebSockets are implemented in exactly two components:

1. **`LogPanel.tsx:89`:**
   - **URL:** `${WS_BASE}/ws/logs` (`ws://127.0.0.1:8000/ws/logs`).
   - **Events Handled:**
     - `payload.type === 'BACKLOG'`: Bulk loads existing operational logs into panel state.
     - `payload.type === 'NEW_ENTRY'`: Appends live log item (`payload.entry`) into terminal view.
2. **`JobMonitor.tsx:79`:**
   - **URL:** `${WS_BASE}/ws/jobs/JOB%20%231024` (`ws://127.0.0.1:8000/ws/jobs/JOB%20%231024`).
   - **Events Handled:**
     - Raw JSON job status payload containing `{ job_id, overall_progress, current_stage, stages: [...] }`.
     - Connection fallback: Automatically falls back to HTTP polling every 2500ms via `setInterval(fetchLatestJob, 2500)` if WebSocket errors or disconnects.

---

## 23. CURRENT STATE MACHINE

- **Formal State Machine (XState / Finite State Machine):** **`NOT IMPLEMENTED`**.
- The target lifecycle:
  $$\text{ASSIGNED} \rightarrow \text{UPLOADING} \rightarrow \text{VALIDATING} \rightarrow \text{READY} \rightarrow \text{PROCESSING} \rightarrow \text{3D\_READY} \rightarrow \text{REPORT\_READY} \rightarrow \text{SENT\_TO\_BHUNAKSHA} \rightarrow \text{ULPIN\_GENERATED} \rightarrow \text{PROPERTY\_CARD\_READY} \rightarrow \text{COMPLETED}$$
  does **not** exist in code.

### Existing Equivalent State Mechanism
The application currently approximates state transitions through a combination of:
1. `currentScreen` in [`src/App.tsx:156`](file:///d:/surveynaksha/src/App.tsx#L156) (controls which component renders).
2. Channel readiness scores calculated dynamically in [`src/types/naksha.ts:calculateReadinessScores()`](file:///d:/surveynaksha/src/types/naksha.ts):
   - Computes `requiredScore` (channels 1, 2, 3, 4, 7) and `optionalScore`.
   - Sets `processingStatus = 'BLOCKED'` | `'PARTIAL'` | `'READY'`.
3. Discrete dataset status strings defined in `src/types/naksha.ts:DatasetStatus`:
   `'Missing' | 'Scanning' | 'Invalid' | 'Partial' | 'Valid' | 'Processing' | 'Completed'`.

---

## 24. CURRENT CSS / DESIGN SYSTEM

- **Framework:** **Tailwind CSS v3.4.1** configured in `tailwind.config.js` with `postcss: ^8.4.35` and `autoprefixer: ^10.4.18`.
- **Primary Typography:**
  - UI Sans: `Inter` (Google Fonts, weights 400, 500, 600, 700).
  - Code / Telemetry / Metrics: `JetBrains Mono` (Google Fonts, weights 400, 500, 600).
- **Color Palettes:**
  - **Minimalist Light Palette (Primary UI):** `bg-white`, `text-zinc-900`, `text-zinc-500`, borders `border-zinc-200` or `border-zinc-100`, accents in `bg-zinc-900` or `bg-emerald-600`.
  - **Legacy Dark Palette (`tailwind.config.js`):** `naksha-darkest: #0B0F19`, `naksha-dark: #111827`, `naksha-panel: #1E293B`, `naksha-border: #334155`, `naksha-accent: #2563EB`.
- **Card Styling:**
  - White UI: `border border-zinc-200 rounded-xl bg-zinc-50/50`.
  - Dark UI: Custom CSS `.glass-panel` and `.glass-card` in `src/index.css` with `backdrop-filter: blur(8px)`.
- **Border Radius:** Heavy use of `rounded-lg` (8px), `rounded-xl` (12px), and `rounded-2xl` (16px).
- **Icons:** `lucide-react: ^0.359.0` used universally across all screens.
- **Responsive Behavior:** Fixed desktop viewports (`h-screen`, `max-h-screen`, `overflow-hidden`), designed primarily for 1440x900 resolution (Tauri window spec). Mobile responsiveness is not supported.

---

## 25. CURRENT REUSABLE UI COMPONENTS

The following existing components have solid architectural foundations and can be preserved or adapted for the new Survey Team workflow:

1. [`src/components/CategoryUploadScreen.tsx`](file:///d:/surveynaksha/src/components/CategoryUploadScreen.tsx):
   - **Why Reusable:** Contains genuine `XMLHttpRequest` byte progress tracking, drag-and-drop file rejection handling, SHA-256 server storage, and direct validation invocation.
2. [`src/components/DatasetScannerScreen.tsx`](file:///d:/surveynaksha/src/components/DatasetScannerScreen.tsx):
   - **Why Reusable:** Fully operation-driven Server-Sent Events listener that updates verification checklist items without synthetic timers.
3. [`src/components/Real3DViewer.tsx`](file:///d:/surveynaksha/src/components/Real3DViewer.tsx):
   - **Why Reusable:** Complete, clean Three.js scene architecture with camera damping, soft shadow maps, 6-layer toggle group, raycasting unit selection, and clean disposal logic.
4. [`src/components/ArchitectureModal.tsx`](file:///d:/surveynaksha/src/components/ArchitectureModal.tsx):
   - **Why Reusable:** Excellent runtime telemetry inspector that verifies PostgreSQL 17 and PostGIS connection health.
5. [`src/components/LogPanel.tsx`](file:///d:/surveynaksha/src/components/LogPanel.tsx):
   - **Why Reusable:** Working WebSocket and REST terminal log component with auto-scroll and level filtering.
6. [`src/components/JobMonitor.tsx`](file:///d:/surveynaksha/src/components/JobMonitor.tsx):
   - **Why Reusable:** Production-ready background job status widget with WebSocket listener and polling fallback.
7. [`src/components/OutputScreen.tsx`](file:///d:/surveynaksha/src/components/OutputScreen.tsx):
   - **Why Reusable:** Clean minimalist layout with direct anchor download triggers for compiled deliverable packages.

---

## 26. CURRENT MOCKED UI COMPONENTS

The following components present an interface that looks operational, but is driven by hardcoded data or synthetic timers:

1. **[`src/components/Viewport2D3D.tsx`](file:///d:/surveynaksha/src/components/Viewport2D3D.tsx):**
   - Labeled "2D MapLibre Cadastre", but renders **static SVG text and polygons**. No MapLibre instance is loaded.
   - 3D mode renders a synthetic mathematical sine wave point grid.
2. **[`src/components/JobGraphScreen.tsx`](file:///d:/surveynaksha/src/components/JobGraphScreen.tsx):**
   - DAG pipeline tree advances automatically via a JavaScript `setInterval(..., 280)` timer. Has zero backend connection.
3. **[`src/components/Property3DLayerScreen.tsx`](file:///d:/surveynaksha/src/components/Property3DLayerScreen.tsx):**
   - All 64 apartments and owners (`Rajesh M. Patil`, `Sunita R. Kulkarni`) are hardcoded in an in-memory loop. No API is queried.
4. **[`src/components/Property3DViewer.tsx`](file:///d:/surveynaksha/src/components/Property3DViewer.tsx):**
   - Renders 64 colored `THREE.BoxGeometry` cuboids arranged in a $2 \times 4 \times 8$ grid. Not generated from survey measurements.
5. **[`src/components/RecordMatchingScreen.tsx`](file:///d:/surveynaksha/src/components/RecordMatchingScreen.tsx):**
   - Falls back to `getFallbackUnits()`, a hardcoded list of 16 units with pre-scripted discrepancies (e.g. Unit 304 area mismatch, Unit 402 floor mismatch).
6. **[`src/components/ProcessingScreen.tsx`](file:///d:/surveynaksha/src/components/ProcessingScreen.tsx):**
   - Right-side status column metrics ("64 / 64", "14.8M Points", "4 Floors") are hardcoded constants.

---

## 27. CURRENT DESIGN LIMITATIONS

The current UI exhibits fundamental technical and structural constraints that prevent it from supporting the target Survey Team workflow:

1. **Missing Ingestion Gatekeeper (No Parcel / Task Context):**
   - The application starts with an arbitrary "Project Name" and immediately demands data uploads.
   - There is no concept of an **Assigned Cadastral Parcel** (Village, Taluka, Survey No., Sub-division, Base 2D ULPIN) existing prior to data upload.
2. **Disconnected 3D Geometry:**
   - The 3D viewer displays procedural boxes rather than loading the real LAS point clouds, photogrammetry outputs, or LoD-2 meshes produced by backend workers.
3. **Absence of City Survey Property Card Generation:**
   - There is no component capable of formatting, previewing, or exporting a standardized Maharashtra Property Card (Akhiv Patrika / 7-12 vertical extract).
4. **Absence of Bhu-Naksha Integration:**
   - There is no mechanism to dispatch cadastral packages to NIC Bhu-Naksha or receive an authoritative 3D ULPIN acknowledgement.
5. **No Role-Based Navigation:**
   - The UI contains buttons for deep architectural inspection, DAG graph simulations, and canonical JSON inspection, which clutter the surveyor's field workflow.
6. **Dual Styling Inconsistency:**
   - The application is split between dark cyberpunk-style cards (`Viewport2D3D`, `InputDeck`) and pure white Swiss-style pages (`DataInputsScreen`, `ProcessingScreen`).

---

## 28. CURRENT UI VISUAL & SCREEN INVENTORY

| Screen Name | Current Route State | Primary Component | Major Visual Elements | Navigates To / From | Status |
|---|---|---|---|---|---|
| **New Project** | `'NEW_PROJECT'` | `NewProjectScreen.tsx` | Project name input, location picker popover, survey date, `[CREATE PROJECT]` button | Default start screen; leads to `'DATA_INPUTS'` | **`REAL`** |
| **10 Data Inputs** | `'DATA_INPUTS'` | `DataInputsScreen.tsx` | 10 numbered input rows, readiness score percentages, tier badges, `[SCAN DATA]` button | From `NewProject`; leads to `'UPLOAD_CATEGORY'`, `'SCANNER'`, `'PROCESSING'` | **`REAL`** |
| **Category Upload** | `'UPLOAD_CATEGORY'` | `CategoryUploadScreen.tsx` | Dashed drag-drop zone, file list with byte sizes, XHR progress bar, validation cards | From `DataInputs`; leads back to `DataInputs` or `Scanner` | **`REAL`** |
| **Dataset Scanner** | `'SCANNER'` | `DatasetScannerScreen.tsx` | 10-step vertical checklist, progress percentage, real-time SSE stage output | From `CategoryUpload`; leads back to `DataInputs` | **`REAL`** |
| **3D Processing** | `'PROCESSING'` | `ProcessingScreen.tsx` | Left checklist, center Three.js 3D viewer with 7-stage stepper, right metrics | From `DataInputs` (`Dispatch Pipeline`); leads to `Workspace` | **`PARTIAL`** |
| **3D Property Layer** | `'PROPERTY_3D'` | `Property3DLayerScreen.tsx` | 3D strata building model, floor isolation buttons (1–8), exploded view toggle, ULPIN-3D card | From `Header`; leads to `Processing` or `CanonicalModel` | **`MOCKED`** |
| **Record Matching** | `'RECORD_MATCHING'` | `RecordMatchingScreen.tsx` | Unit list, MATCH / CONFLICT / UNRESOLVED badges, side-by-side deed comparison | From `Header`; leads to `Property3D` or `CanonicalModel` | **`PARTIAL`** |
| **Validation Gatekeeper**| `'VALIDATION'` | `ValidationScreen.tsx` | 9 certified checks, overall percentage (100%), issue resolution modal | From `Header`; leads to `Packages` | **`PARTIAL`** |
| **Output Deliverables**| `'PACKAGES'` | `OutputScreen.tsx` | Minimalist buttons for `[TBK]`, `[GIB]`, `[VERTICAL PROPERTY]`, `[3D SURVEY]`, `[DOWNLOAD ALL]` | From `Validation`; leads back to `DataInputs` | **`REAL`** |
| **Canonical Model** | `'CANONICAL_MODEL'`| `CanonicalModelScreen.tsx` | Left JSON tree inspector, right node attribute viewer, LADM export button | From `Header`; leads to `Processing` | **`REAL`** |
| **Job Graph** | `'JOB_GRAPH'` | `JobGraphScreen.tsx` | Interactive DAG nodes, level 1 & 2 categories, synthetic execution controls | From `Header`; leads to `Workspace` | **`MOCKED`** |
| **Full Workspace** | `'WORKSPACE'` | `Viewport2D3D.tsx` + `InputDeck.tsx` | Top `Header`, upper 2D/3D split viewport, lower 10-channel grid deck | From `DataInputs` or `Processing` | **`MOCKED`** |

### Screenshot Artifacts Recorded in System
- `app_main_view_1790692423840.png`: Full desktop workspace view showing top header, 2D vector cadastre SVG, and bottom 10-input cards.
- `job_monitor_initial_1790692370419.png`: Bottom-right background job monitor widget in initial active state.
- `lidar_click_view_1790692750445.png`: Category 02 (LiDAR) click view with pre-flight requirement attributes.
- `property_data_click_view_1790692830508.png`: Category 07 (Property & Vertical Data) inspection view.

---

## 29. FILE-LEVEL EVIDENCE

1. **Entry Point & Window Shell:**
   - [`src-tauri/src/main.rs:85-161`](file:///d:/surveynaksha/src-tauri/src/main.rs#L85-L161): Rust function `spawn_python_backend()` executes Python uvicorn on port 8000 and monitors health before opening the desktop window.
2. **No URL Routing Installed:**
   - [`package.json:12-21`](file:///d:/surveynaksha/package.json#L12-L21): Dependencies include `react`, `three`, `maplibre-gl`, `lucide-react`, and `@tauri-apps/api`. `react-router` is completely absent.
3. **Synthetic Pipeline Dispatch:**
   - [`src/App.tsx:287-308`](file:///d:/surveynaksha/src/App.tsx#L287-L308):
     ```typescript
     setTimeout(() => {
       setIsProcessing(false);
       // Mark Photogrammetry and Imagery as Completed
       setInputs(prev => prev.map(item => item.num === '01' ? { ...item, status: 'Completed' } : item));
     }, 2500);
     ```
4. **Real File Upload Byte Progress:**
   - [`src/components/CategoryUploadScreen.tsx:83-88`](file:///d:/surveynaksha/src/components/CategoryUploadScreen.tsx#L83-L88):
     ```typescript
     xhr.upload.onprogress = (event) => {
       if (event.lengthComputable) {
         const percentComplete = Math.min(95, Math.round((event.loaded / event.total) * 100));
         setUploadState(prev => ({ ...prev, progress: percentComplete }));
       }
     };
     ```
5. **Real Server-Sent Events Scanner:**
   - [`src/components/DatasetScannerScreen.tsx:110-155`](file:///d:/surveynaksha/src/components/DatasetScannerScreen.tsx#L110-L155):
     ```typescript
     const response = await fetch(`${API_BASE}/api/v2/datasets/${targetId}/scan/stream`);
     const reader = response.body.getReader();
     // decodes data: {"type": "step", "data": {...}}
     ```
6. **Synthetic DAG Execution:**
   - [`src/components/JobGraphScreen.tsx:330-369`](file:///d:/surveynaksha/src/components/JobGraphScreen.tsx#L330-L369):
     ```typescript
     const stepInterval = setInterval(() => {
       // Advances mock DAG nodes every 280ms
     }, 280);
     ```
7. **Procedural 3D Building Geometry:**
   - [`src/components/Real3DViewer.tsx:324`](file:///d:/surveynaksha/src/components/Real3DViewer.tsx#L324):
     ```typescript
     const massGeo = new THREE.BoxGeometry(11, 15, 15);
     ```
8. **In-Memory Hardcoded 64-Unit Strata:**
   - [`src/components/Property3DLayerScreen.tsx:20-63`](file:///d:/surveynaksha/src/components/Property3DLayerScreen.tsx#L20-L63):
     ```typescript
     const ALL_UNITS: PropertyUnit3D[] = (() => {
       // Loops f: 1..8, u: 1..8 with hardcoded owners and coordinates
     })();
     ```
9. **Fake File Drop Handler:**
   - [`src/App.tsx:311-314`](file:///d:/surveynaksha/src/App.tsx#L311-L314):
     ```typescript
     const handleFilesDropped = (files: FileList) => {
       alert(`Received ${files.length} file(s)...`);
     };
     ```
10. **MapLibre Fake 2D Viewport:**
    - [`src/components/Viewport2D3D.tsx:163-202`](file:///d:/surveynaksha/src/components/Viewport2D3D.tsx#L163-L202): Pure static SVG `<polygon>` elements without MapLibre map initialization.

---

## 30. FINAL UI AUDIT TABLE

| UI Feature | Component | Route State | Status | Real / Mock | Backend Connected | Reusable? |
|---|---|---|---|---|---|---|
| **Project Creation** | `NewProjectScreen.tsx` | `'NEW_PROJECT'` | **REAL** | Real form | **YES** (`POST /api/v2/projects`) | **YES** |
| **Project Selection / List**| None | None | **NOT IMPLEMENTED** | None | **NO** | Rebuild |
| **Assigned Parcel Inbox** | None | None | **NOT IMPLEMENTED** | None | **NO** | Rebuild |
| **10 Input Modules Matrix**| `DataInputsScreen.tsx` | `'DATA_INPUTS'` | **REAL** | Real channel list | **YES** (`GET /inputs/live`) | **YES** |
| **File Upload (XHR)** | `CategoryUploadScreen.tsx` | `'UPLOAD_CATEGORY'` | **REAL** | Real byte stream | **YES** (`POST /datasets/upload`) | **YES** |
| **Physical File Scanner** | `DatasetScannerScreen.tsx` | `'SCANNER'` | **REAL** | Real SSE stream | **YES** (`GET /scan/stream`) | **YES** |
| **Readiness Percentage** | `DataInputsScreen.tsx` | `'DATA_INPUTS'` | **REAL** | Computed logic | **YES** (from channel scores) | **YES** |
| **Start Pipeline Action** | `DataInputsScreen.tsx` | `'DATA_INPUTS'` | **PARTIAL** | Real API call + fake timer | **YES** (`POST /jobs/dispatch`) | **YES** |
| **Processing Monitor** | `ProcessingScreen.tsx` | `'PROCESSING'` | **PARTIAL** | Real stepper / mock metrics | **PARTIAL** | **YES** |
| **3D Scene Engine** | `Real3DViewer.tsx` | `'PROCESSING'` | **PARTIAL** | Real WebGL / mock geometry | **YES** (`GET /scene-layers`) | **YES** |
| **Point Cloud Display** | `Real3DViewer.tsx` | `'PROCESSING'` | **MOCKED** | Deterministic math loops | **PARTIAL** | Adapt |
| **3D Building Model** | `Real3DViewer.tsx` | `'PROCESSING'` | **MOCKED** | Static `BoxGeometry` | **NO** | Replace |
| **Floor Segmentation** | `Property3DViewer.tsx` | `'PROPERTY_3D'` | **MOCKED** | Hardcoded 8 floor slabs | **NO** | Replace |
| **Apartment Strata Units** | `Property3DViewer.tsx` | `'PROPERTY_3D'` | **MOCKED** | 64 hardcoded in-memory boxes| **NO** | Replace |
| **Title Record Matching** | `RecordMatchingScreen.tsx` | `'RECORD_MATCHING'` | **PARTIAL** | Relative fetch + mock fallback| **PARTIAL** | Adapt |
| **Validation Gatekeeper** | `ValidationScreen.tsx` | `'VALIDATION'` | **PARTIAL** | Real endpoint + sim param | **YES** (`GET /validation/final`) | **YES** |
| **Deliverable Packages** | `OutputScreen.tsx` | `'PACKAGES'` | **REAL** | Real ZIP binary download | **YES** (`GET /packages/download`)| **YES** |
| **Survey Cadastral Report**| None | None | **NOT IMPLEMENTED** | None | **NO** | Rebuild |
| **Send to Bhu-Naksha** | None | None | **NOT IMPLEMENTED** | None | **NO** | Rebuild |
| **ULPIN Notification** | None | None | **NOT IMPLEMENTED** | None | **NO** | Rebuild |
| **ULPIN Display** | Various | Various | **STATIC / MOCKED** | Hardcoded text strings | **NO** | Adapt |
| **Property Card UI** | None | None | **NOT IMPLEMENTED** | None | **NO** | Rebuild |
| **Workflow Completion** | `OutputScreen.tsx` | `'PACKAGES'` | **PARTIAL** | Visual status only | **NO** | Adapt |
| **Database Persistence** | Multiple | Multiple | **REAL** | PostgreSQL 17 + PostGIS | **YES** | **YES** |

---

## 31. CURRENT ACTUAL UI FLOW DIAGRAM

```
========================================================================================
                              ACTUAL CURRENT APPLICATION FLOW
========================================================================================

START (Application Launch)
  ↓
src-tauri/src/main.rs (Spawns Python backend on port 8000, checks /health)
  ↓
src/main.tsx → src/App.tsx
  ↓
[Screen 1: NEW_PROJECT] (NewProjectScreen.tsx)
  • User fills Name, Location, Survey Date
  • Submits form → Fires POST /api/v2/projects (Saves to PostgreSQL)
  ↓
[Screen 2: DATA_INPUTS] (DataInputsScreen.tsx)
  • Displays 10 categories in "Missing" state (Readiness: 0%)
  • User clicks a Category Row (e.g. "01 Photogrammetry")
  ↓
[Screen 3: UPLOAD_CATEGORY] (CategoryUploadScreen.tsx)
  • User selects or drops physical files
  • Clicks [UPLOAD & VALIDATE]
  • Genuine XHR upload streams physical bytes to POST /api/v2/datasets/upload
  • Files saved to storage_cache/ on server
  • Executes POST /api/v2/datasets/{id}/validate
  • User clicks [CONFIRM DATASET →]
  ↓
[Screen 4: SCANNER] (DatasetScannerScreen.tsx)
  • Real-time Server-Sent Events stream from GET /api/v2/datasets/{id}/scan/stream
  • 10 sequential checks verified on disk
  • User clicks [PROCEED TO DATA INPUTS →]
  ↓
[Screen 2: DATA_INPUTS] (DataInputsScreen.tsx)
  • Category 01 now shows "Valid" (Quality: 94%, Completeness: 100%)
  • Overall Data Readiness score updates
  • When mandatory categories are satisfied → [DISPATCH PROCESSING PIPELINE] unlocks
  • User clicks [DISPATCH PROCESSING PIPELINE]
  • Fires POST /api/v2/jobs/dispatch + executes setTimeout(..., 2500)
  ↓
[Screen 5: PROCESSING] (ProcessingScreen.tsx)
  • Left column: 10 pipeline steps (animated with blue pulse)
  • Center column: Three.js Real3DViewer renders procedural BoxGeometry building
  • Right column: Hardcoded metrics ("14.8M Points", "64/64 Records")
  • User clicks [INSPECT CADASTRE] button (unlocked at Stage 7)
  ↓
[Screen 6: WORKSPACE] (Viewport2D3D.tsx + InputDeck.tsx)
  • Header navigation becomes visible
  • Top half: Static SVG vector parcels (ULPIN: 27-24-004-101) or sine-wave 3D points
  • Bottom half: 10 Input Cards
  • User can jump to other screens via Header buttons:
      ├─→ [Canonical Model] (CanonicalModelScreen.tsx: Real JSON tree / LADM download)
      ├─→ [3D Property] (Property3DLayerScreen.tsx: 64 hardcoded in-memory units)
      ├─→ [Record Match] (RecordMatchingScreen.tsx: Deed matching with Unit 304 conflict)
      ├─→ [Validation] (ValidationScreen.tsx: 9 certified checks)
      └─→ [Outputs (4)] (OutputScreen.tsx: Minimalist download buttons)
  ↓
[Screen 7: PACKAGES] (OutputScreen.tsx)
  • User clicks [TBK], [GIB], [VERTICAL PROPERTY], [3D SURVEY], or [DOWNLOAD ALL]
  • Downloads real compiled ZIP packages from backend storage
  ↓
[STOPS HERE — WORKFLOW TERMINATES]
  • No Survey Report is generated.
  • No Bhu-Naksha dispatch occurs.
  • No ULPIN notification is received.
  • No Property Card (Milkat Patra) is generated or viewed.
========================================================================================
```

---

## 32. WHAT CAN BE REUSED

The following components and subsystems should be **preserved and integrated** into the new Survey Team workflow:

1. **`CategoryUploadScreen.tsx`:** The core drag-and-drop file upload engine with `XMLHttpRequest` progress reporting, multi-file selection, and instant validation calls.
2. **`DatasetScannerScreen.tsx`:** The 10-stage Server-Sent Events file scanner UI that communicates directly with the backend physical inspection pipeline.
3. **`Real3DViewer.tsx` (Scene Shell & Controls):** The Three.js WebGL renderer, studio lighting, camera damping, orbit controls, ground datum grid, and layer toggle buttons.
4. **`OutputScreen.tsx`:** The minimalist package download interface for exporting TBK, GIB, 3D Survey, and Vertical Property archives.
5. **`LogPanel.tsx`:** The real-time operations console connected via WebSocket to `/ws/logs`.
6. **`JobMonitor.tsx`:** The floating background Celery task monitor connected via WebSocket to `/ws/jobs/{id}`.
7. **`ArchitectureModal.tsx`:** The live PostgreSQL 17 + PostGIS telemetry diagnostics dialog.
8. **`readinessEngine` logic (`calculateReadinessScores` in `types/naksha.ts`):** The quantitative weighting algorithm that determines readiness from required vs. optional channel tiers.

---

## 33. WHAT SHOULD BE REPLACED

The following components are fundamentally tied to synthetic, mocked, or placeholder workflows and **must be replaced or rewritten**:

1. **`NewProjectScreen.tsx`:** Must be replaced with an **Assigned Parcel / Survey Mandate Selection Screen** that pulls real assigned survey tasks from the database rather than prompting the user for an arbitrary project name.
2. **`Viewport2D3D.tsx`:** Must be replaced because its 2D cadastre is a static SVG drawing with fake parcel coordinates, and its 3D view is a mathematical sine wave.
3. **`JobGraphScreen.tsx`:** Must be replaced because its DAG execution is entirely simulated via a client-side `setInterval(..., 280)` timer with zero backend job graph connection.
4. **In-Memory Strata Generator in `Property3DLayerScreen.tsx`:** The `ALL_UNITS = (() => { ... })()` generator with hardcoded Pune owners must be replaced by a real database query fetching the 3D property units generated by backend reconstruction.
5. **Procedural `BoxGeometry` in `Real3DViewer.tsx` & `Property3DViewer.tsx`:** The static wireframe cubes must be replaced by real mesh / GLTF loading and actual reconstructed point cloud buffers.
6. **`PackageOutputsScreen.tsx`:** Dead, unreferenced code containing timer-based progress bars; should be discarded.
7. **Drop Alert in `InputDeck.tsx`:** The `alert("Received X files...")` handler must be removed and routed to real file ingestion.

---

## 34. FINAL ANSWER

### A. CURRENT UI THAT IS REAL
1. **Project Creation Form:** [`NewProjectScreen.tsx`](file:///d:/surveynaksha/src/components/NewProjectScreen.tsx) creates genuine project rows in PostgreSQL via `POST /api/v2/projects`.
2. **10-Channel Upload Engine:** [`CategoryUploadScreen.tsx`](file:///d:/surveynaksha/src/components/CategoryUploadScreen.tsx) streams actual files to `storage_cache/` using real XHR byte progress (`POST /api/v2/datasets/upload`).
3. **10-Stage File Scanner:** [`DatasetScannerScreen.tsx`](file:///d:/surveynaksha/src/components/DatasetScannerScreen.tsx) streams real-time physical file verification events via Server-Sent Events (`GET /api/v2/datasets/{id}/scan/stream`).
4. **Live Channel Telemetry:** [`DataInputsScreen.tsx`](file:///d:/surveynaksha/src/components/DataInputsScreen.tsx) queries PostgreSQL live channel statuses via `GET /api/v2/projects/{projectId}/inputs/live`.
5. **Asynchronous Background Processing Trigger:** [`Header.tsx`](file:///d:/surveynaksha/src/components/Header.tsx) and [`DataInputsScreen.tsx`](file:///d:/surveynaksha/src/components/DataInputsScreen.tsx) dispatch genuine Celery worker tasks via `POST /api/v2/jobs/dispatch`.
6. **Package Binary Downloads:** [`OutputScreen.tsx`](file:///d:/surveynaksha/src/components/OutputScreen.tsx) triggers HTTP downloads of compiled TBK, GIB, Vertical Property, and 3D Survey archives.
7. **System Log Stream:** [`LogPanel.tsx`](file:///d:/surveynaksha/src/components/LogPanel.tsx) receives live operational log events via WebSocket (`/ws/logs`).
8. **Database Health Telemetry:** [`ArchitectureModal.tsx`](file:///d:/surveynaksha/src/components/ArchitectureModal.tsx) reports live PostgreSQL 17 + PostGIS 3.3.7 connectivity (`GET /api/v2/database/health`).

---

### B. CURRENT UI THAT IS MOCKED
1. **3D Building Superstructure:** Rendered using `THREE.BoxGeometry(11, 15, 15)` in [`Real3DViewer.tsx`](file:///d:/surveynaksha/src/components/Real3DViewer.tsx). It is a static translucent cube, not a reconstructed mesh.
2. **64-Unit Property Strata:** Generated by an in-memory loop in [`Property3DLayerScreen.tsx`](file:///d:/surveynaksha/src/components/Property3DLayerScreen.tsx) with hardcoded owners (`Rajesh M. Patil`, `Sunita R. Kulkarni`).
3. **Apartment 3D Geometry:** Rendered as 64 identical colored cuboids in [`Property3DViewer.tsx`](file:///d:/surveynaksha/src/components/Property3DViewer.tsx).
4. **DAG Pipeline Graph:** [`JobGraphScreen.tsx`](file:///d:/surveynaksha/src/components/JobGraphScreen.tsx) simulates pipeline execution using a 280ms `setInterval()`.
5. **2D Cadastral Map:** [`Viewport2D3D.tsx`](file:///d:/surveynaksha/src/components/Viewport2D3D.tsx) renders a static SVG graphic with hardcoded parcel boundaries.
6. **Right-Column Processing Metrics:** Point counts, buildings, floors, and unit counts in [`ProcessingScreen.tsx`](file:///d:/surveynaksha/src/components/ProcessingScreen.tsx) are hardcoded constants.

---

### C. CURRENT UI THAT IS PARTIAL
1. **Processing Screen:** Stepper and layout work smoothly, and real background jobs are dispatched, but the 3D model and right-hand metrics do not reflect actual worker output.
2. **Record Matching Screen:** Features an advanced side-by-side deed comparison interface and an API call to `/api/v2/records/matching/summary`, but falls back to 16 hardcoded units if the endpoint is not proxied.
3. **Validation Gatekeeper:** Queries `GET /api/v2/validation/final`, but relies on a `?simulate_failure=true` query parameter and synthetic timers to demonstrate conflict resolution.
4. **Canonical Model Screen:** Successfully fetches and parses canonical JSON trees from `http://localhost:8000/api/v2/canonical/project/PROJ-PUNE-001`, but falls back to a static Pune model when offline.

---

### D. CURRENT UI THAT IS MISSING
1. **Survey Team / Surveyor Authentication & Profile.**
2. **Assigned Cadastral Parcel Selection / Field Task Inbox.**
3. **Real MapLibre Vector Tile Map Viewer.**
4. **GLTF / GLB / LAS Point Cloud Loader for Reconstructed Assets.**
5. **Printable / Downloadable Cadastral Survey Report (PDF/HTML).**
6. **NIC Bhu-Naksha API Integration & Dispatch Workflow.**
7. **Authoritative 3D ULPIN Acknowledgement & Notification.**
8. **Maharashtra City Survey Property Card (Milkat Patra) Generator & Viewer.**
9. **Global Toast / Notification System.**

---

### E. COMPONENTS WE CAN REUSE
1. [`src/components/CategoryUploadScreen.tsx`](file:///d:/surveynaksha/src/components/CategoryUploadScreen.tsx) (Real XHR upload engine).
2. [`src/components/DatasetScannerScreen.tsx`](file:///d:/surveynaksha/src/components/DatasetScannerScreen.tsx) (Real SSE verification scanner).
3. [`src/components/Real3DViewer.tsx`](file:///d:/surveynaksha/src/components/Real3DViewer.tsx) (Three.js WebGL scene, lighting, camera, and controls).
4. [`src/components/OutputScreen.tsx`](file:///d:/surveynaksha/src/components/OutputScreen.tsx) (Package export download buttons).
5. [`src/components/LogPanel.tsx`](file:///d:/surveynaksha/src/components/LogPanel.tsx) (Live terminal console).
6. [`src/components/JobMonitor.tsx`](file:///d:/surveynaksha/src/components/JobMonitor.tsx) (Background task monitor).
7. [`src/components/ArchitectureModal.tsx`](file:///d:/surveynaksha/src/components/ArchitectureModal.tsx) (Live DB telemetry).

---

### F. COMPONENTS THAT SHOULD BE REBUILT
1. **`NewProjectScreen.tsx` $\rightarrow$ Rebuild as:** `AssignedParcelScreen.tsx` (Select from assigned survey parcels with village, survey number, and base 2D ULPIN).
2. **`Viewport2D3D.tsx` $\rightarrow$ Rebuild as:** Genuine `MapLibreCadastreViewer.tsx` displaying vector parcel tiles and surveyed boundaries.
3. **`Real3DViewer.tsx` geometry pipeline $\rightarrow$ Rebuild to:** Load actual GLTF / GLB and LAS buffers generated by background processing workers instead of `BoxGeometry`.
4. **`Property3DLayerScreen.tsx` & `Property3DViewer.tsx` $\rightarrow$ Rebuild to:** Ingest dynamic 3D unit records directly from PostgreSQL `property_units_3d` table.
5. **New Component Needed:** `BhuNakshaDispatchScreen.tsx` (Review package, dispatch to Bhu-Naksha, receive official 3D ULPIN).
6. **New Component Needed:** `PropertyCardViewer.tsx` (Interactive view and PDF export of official City Survey Property Card / Milkat Patra).
7. **New Component Needed:** `SurveyReportScreen.tsx` (Certified survey completion report with accuracy metrics and signature blocks).

---

### G. CURRENT ACTUAL USER FLOW
```
[Application Start]
       ↓
[New Project Form] (Enter name "Pune_Residential_001")
       ↓ (POST /api/v2/projects)
[10 Data Inputs Matrix] (Click category row)
       ↓
[Category Upload Screen] (Drop files, physical XHR upload)
       ↓ (POST /datasets/upload)
[Dataset Scanner Screen] (Server-Sent Events verify physical files on disk)
       ↓
[10 Data Inputs Matrix] (Shows score updated; click [DISPATCH PROCESSING PIPELINE])
       ↓ (POST /jobs/dispatch)
[Processing Screen] (Watches procedural BoxGeometry rotate; clicks [INSPECT CADASTRE])
       ↓
[Workspace Screen] (Clicks header links)
       ├─→ [3D Property Screen] (Inspects 64 hardcoded in-memory units)
       ├─→ [Record Match Screen] (Views deed matching table with Unit 304 conflict)
       ├─→ [Validation Screen] (Views 9 certified checks)
       └─→ [Output Screen] (Downloads TBK, GIB, Vertical Property, 3D Survey ZIPs)
       ↓
[TERMINATES — No Bhu-Naksha send, no ULPIN receipt, no Property Card]
```

---

### H. TECHNICAL INFORMATION NEEDED TO DESIGN THE NEW SURVEY TEAM FLOW

To design the new Survey Team workflow with 100% technical fidelity, the downstream AI requires the following specifications:

1. **Assigned Parcel Data Contract:**
   - Database schema: `cadastral_parcels` table in PostgreSQL.
   - Fields: `parcel_id`, `survey_number`, `sub_division`, `village_name`, `taluka`, `district`, `base_2d_ulpin`, `legal_area_sqm`, `boundary_geojson_wgs84`.
2. **Reconstructed 3D Geometry Endpoint:**
   - Endpoint: `GET /api/v2/visualization/reconstructed-mesh/{project_id}`.
   - Payload format: Binary GLB/GLTF containing the actual photogrammetry/LiDAR mesh and classified floor/unit sub-meshes.
3. **Database Strata Hierarchy:**
   - Project $\rightarrow$ Parcel $\rightarrow$ Building $\rightarrow$ Floor $\rightarrow$ Property Unit 3D.
   - Table: `property_units_3d` in PostgreSQL with columns `unit_id`, `floor_id`, `unit_number`, `geometry_wkb_3d`, `footprint_wkb_2d`, `carpet_area_sqm`, `volume_m3`, `base_ulpin`, `ulpin_3d`.
4. **Bhu-Naksha API Integration Contract:**
   - Request specification for dispatching survey packages to the National Informatics Centre (NIC) Bhu-Naksha portal.
   - Inbound webhook or response schema for receiving the certified 14-digit Base ULPIN and vertical 3D sub-identifier.
5. **Property Card Layout Specifications:**
   - Formal Maharashtra Land Revenue Code (MLRC) City Survey Form (Property Card / Akhiv Patrika / 7-12 vertical extract) schema for PDF rendering.
