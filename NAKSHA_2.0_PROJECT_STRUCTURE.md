# NAKSHA 2.0 — PROJECT STRUCTURE & VIRTUALIZATION SPECIFICATION
**Canonical Storage Layout, Execution Workspaces, and the "10 Input Types" Abstraction Layer**  
**Document Status:** FROZEN (Phase 3)  
**Parent Specifications:**  
- [NAKSHA_2.0_DATA_SPECIFICATION.md](file:///d:/surveynaksha/NAKSHA_2.0_DATA_SPECIFICATION.md) (Data Categories & Ingestion)  
- [NAKSHA_2.0_REQUIREMENT_ENGINE.md](file:///d:/surveynaksha/NAKSHA_2.0_REQUIREMENT_ENGINE.md) (Validation & Quality Profiles)  
- [NAKSHA_2.0_DATABASE_DESIGN.md](file:///d:/surveynaksha/NAKSHA_2.0_DATABASE_DESIGN.md) (PostgreSQL + PostGIS & MinIO/S3 Design)  

---

## 1. Executive Concept: Physical Rigor vs. Virtual Simplicity

### 1.1 The Golden Rule of Naksha 2.0 UX
A professional geospatial platform requires an exceptionally strict, deterministic filesystem and object storage tree for pipelines, intermediate caches, and error logs.

However, **a land surveyor, GIS analyst, or municipal officer should never be burdened with navigating raw folder paths, scratch directories, or lock files.**

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        NAKSHA 2.0 TWO-TIER PROJECT PARADIGM                           │
│                                                                                        │
│   USER FACING (UI / API Layer):                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              10 CLEAN INPUT TYPES                              │   │
│   │   [01 Photogrammetry]   [02 LiDAR]      [03 GIS/CAD]    [04 GNSS]   [05 DEM]   │   │
│   │   [06 BIM]              [07 Property]   [08 Imagery]    [09 Meta]   [10 Docs]  │   │
│   │                                                                                │   │
│   │   • Drag & Drop onto Category Cards                                            │   │
│   │   • Readiness Badges (Ready | Warnings | Blocked)                              │   │
│   │   • Quality Scores & Actionable Remediation Cards                              │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
│                                           │                                            │
│                       AUTOMATIC DISPATCHER & INGESTION ROUTER                          │
│                                           │                                            │
│   PHYSICAL BACKEND (Filesystem / MinIO / S3):                                          │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │   Project/                                                                     │   │
│   │   ├── .naksha/                 (Engine State, Locks, Manifest Cache)           │   │
│   │   ├── Project_Metadata/        (AOI, Specs, Master Definitions)                │   │
│   │   ├── 01_Photogrammetry/       (Raw frames, Telemetry, Shutter logs)           │   │
│   │   ├── 02_LiDAR/                (LAS/LAZ point records, Trajectory SBET)        │   │
│   │   ├── 03_GIS_CAD/              (Shapefiles quad-sets, DWG XREFs, GPKG)         │   │
│   │   ├── 04_GNSS/                 (RINEX obs/nav, GCP coordinate tables)          │   │
│   │   ├── 05_DEM/                  (Surface float GeoTIFFs, Breaklines)            │   │
│   │   ├── 06_BIM/                  (IFC structural models, Schedules)              │   │
│   │   ├── 07_Property_Data/        (7/12 RoR ledgers, 3D strata units, Deeds)      │   │
│   │   ├── 08_Imagery/              (Orthomosaics, COGs, World files)               │   │
│   │   ├── 09_Metadata/             (Equipment calibration, Surveyor sign-off)      │   │
│   │   ├── 10_Documents/            (Legal notices, Field recovery sketches)        │   │
│   │   ├── Processing/              (Isolated scratch, worker queues, temp buffers) │   │
│   │   ├── Outputs/                 (COG, COPC, 3D Tiles, MVTs, Land reports)       │   │
│   │   └── Logs/                    (Pipeline execution traces, Worker stdout)      │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Physical Project Layout

Whenever a project is initialized (either on local NVMe disk, network cluster storage, or synchronized MinIO/S3 object storage), the following directory tree is created:

```
{PROJECT_ROOT}/
│
├── .naksha/                               # Internal Engine Control Subsystem
│   ├── project.json                       # Local Project State & Config Mirror
│   ├── state.lock                         # Distributed concurrency lock file
│   └── index.cache                        # Local cache of file hashes & validation results
│
├── Project_Metadata/                      # Project-Level Definitions & Contract
│   ├── naksha_manifest.json               # Master schema manifest (ID, CRS, Accuracy Tier)
│   ├── aoi_boundary.geojson               # Project Area of Interest polygon (WGS84)
│   └── survey_spec.xml                    # Quality tolerances and contractual thresholds
│
├── 01_Photogrammetry/                     # Category 01: Optical Ingestion Channel
│   └── {dataset_id}/
│       ├── raw/                           # DSC_0001.JPG, DSC_0002.JPG ...
│       ├── telemetry/                     # flight_plan.json, camera.csv, rtk.pos
│       └── .dataset.json                  # Dataset manifest & checksums
│
├── 02_LiDAR/                              # Category 02: Point Cloud Ingestion Channel
│   └── {dataset_id}/
│       ├── raw/                           # scan_block_01.laz, substation.e57
│       ├── trajectory/                    # sbet.out, base_station.nav
│       └── .dataset.json
│
├── 03_GIS_CAD/                            # Category 03: Vector & CAD Ingestion Channel
│   └── {dataset_id}/
│       ├── shapefiles/                    # parcels.shp, .shx, .dbf, .prj, .cpg
│       ├── cad/                           # layout.dwg, xrefs/, plot_style.ctb
│       ├── geopackage/                    # cadastral_boundaries.gpkg
│       └── .dataset.json
│
├── 04_GNSS/                               # Category 04: Geodetic Observation Channel
│   └── {dataset_id}/
│       ├── rinex/                         # BASE2590.24o, BASE2590.24n
│       ├── control_points/                # gcps_measured.csv, checkpoints.csv
│       ├── field_photos/                  # GCP01_monument.jpg, GCP02_monument.jpg
│       └── .dataset.json
│
├── 05_DEM/                                # Category 05: Elevation & Surface Channel
│   └── {dataset_id}/
│       ├── rasters/                       # dtm_bare_earth.tif, dsm_surface.tif
│       ├── breaklines/                    # stream_lines.shp, ridge_lines.shp
│       └── .dataset.json
│
├── 06_BIM/                                # Category 06: Architectural Model Channel
│   └── {dataset_id}/
│       ├── models/                        # building_structural.ifc, site.rvt
│       ├── coordination/                  # georeference_matrix.json, issues.bcfzip
│       └── .dataset.json
│
├── 07_Property_Data/                      # Category 07: Land Cadastre & Deeds Channel
│   └── {dataset_id}/
│       ├── ledgers/                       # 7_12_extracts.xlsx, ror_records.csv
│       ├── vertical_units/                # multi_storey_units.csv
│       ├── cadastre/                      # subdivision_sheet.dwg, floor_plans.dxf
│       ├── deeds/                         # sale_deed_plot_45.pdf, mutation_102.pdf
│       └── .dataset.json
│
├── 08_Imagery/                            # Category 08: Orthomosaics & Basemaps
│   └── {dataset_id}/
│       ├── orthomosaics/                  # high_res_ortho.tif, .tfw, .prj
│       ├── tile_index/                    # sheet_grid_index.geojson
│       └── .dataset.json
│
├── 09_Metadata/                           # Category 09: Calibration & Legal Credentials
│   └── {dataset_id}/
│       ├── equipment_calibrations/        # uav_camera_cal.xml, gnss_antenna.atx
│       ├── surveyor_credentials/          # license_certificate.pdf, digital_key.sig
│       └── .dataset.json
│
├── 10_Documents/                          # Category 10: Legal Annexures & Sketches
│   └── {dataset_id}/
│       ├── legal_notices/                 # gazette_notification.pdf
│       ├── field_sketches/                # boundary_dispute_sketch.png
│       └── .dataset.json
│
├── Processing/                            # Ephemeral Pipeline Workspace (Non-User Facing)
│   ├── scratch/                           # In-flight memory-mapped buffers
│   ├── intermediate/                      # Sparse point clouds, uncompressed tiles
│   └── jobs/
│       └── {job_id}/                      # Isolated execution sandbox per worker
│           ├── task_spec.json             # Exact job parameters and inputs
│           ├── worker.pid                 # OS process tracking
│           └── run.log                    # Live job execution stdout/stderr
│
├── Outputs/                               # Deliverable Artifacts (Tiled & Published)
│   ├── cog/                               # Cloud Optimized GeoTIFF rasters
│   ├── copc/                              # Cloud Optimized Point Clouds (LAZ 1.4)
│   ├── 3d_tiles/                          # OGC 3D Tiles v1.1 tree (b3dm / pnts)
│   ├── vector_tiles/                      # Mapbox Vector Tiles (MVT) for MapLibre
│   ├── cadastral_reports/                 # Land valuation and area reconciliation PDFs
│   └── export_packages/                   # Bundled deliverables for client handoff
│
└── Logs/                                  # Audit & Historical Tracing
    ├── ingestion.log                      # Bundle resolution and file intake log
    ├── validation.log                     # Requirement Engine validation traces
    ├── pipeline.log                       # General processing queue events
    └── errors.log                         # Critical exceptions and stack traces
```

---

## 3. Object Storage (MinIO / S3) Synchronization Mapping

Every file in the physical structure maps directly to an object in the storage fabric defined in [NAKSHA_2.0_DATABASE_DESIGN.md](file:///d:/surveynaksha/NAKSHA_2.0_DATABASE_DESIGN.md):

| Local Folder | Target S3 Bucket | Target S3 Object Key Pattern |
|---|---|---|
| `Project_Metadata/` | `naksha-raw-payloads` | `projects/{prj_id}/metadata/{file_name}` |
| `01_Photogrammetry/` | `naksha-raw-payloads` | `projects/{prj_id}/datasets/{ds_id}/raw/{role}/{sha256}.{ext}` |
| `02_LiDAR/` | `naksha-raw-payloads` | `projects/{prj_id}/datasets/{ds_id}/raw/{role}/{sha256}.{ext}` |
| `03_GIS_CAD/` | `naksha-raw-payloads` | `projects/{prj_id}/datasets/{ds_id}/raw/{role}/{sha256}.{ext}` |
| `04_GNSS/` | `naksha-raw-payloads` | `projects/{prj_id}/datasets/{ds_id}/raw/{role}/{sha256}.{ext}` |
| `05_DEM/` | `naksha-raw-payloads` | `projects/{prj_id}/datasets/{ds_id}/raw/{role}/{sha256}.{ext}` |
| `06_BIM/` | `naksha-raw-payloads` | `projects/{prj_id}/datasets/{ds_id}/raw/{role}/{sha256}.{ext}` |
| `07_Property_Data/` | `naksha-legal-documents`| `projects/{prj_id}/legal/{parcel_id}/{sha256}.{ext}` |
| `08_Imagery/` | `naksha-raw-payloads` | `projects/{prj_id}/datasets/{ds_id}/raw/{role}/{sha256}.{ext}` |
| `09_Metadata/` | `naksha-raw-payloads` | `projects/{prj_id}/datasets/{ds_id}/raw/{role}/{sha256}.{ext}` |
| `10_Documents/` | `naksha-legal-documents`| `projects/{prj_id}/documents/{sha256}.{ext}` |
| `Outputs/cog/` | `naksha-streaming-tiles`| `projects/{prj_id}/tiles/cog/{artifact_id}.tif` |
| `Outputs/copc/` | `naksha-streaming-tiles`| `projects/{prj_id}/tiles/copc/{artifact_id}.copc.laz` |
| `Outputs/3d_tiles/` | `naksha-streaming-tiles`| `projects/{prj_id}/tiles/3d/{tile_hash}.b3dm` |

---

## 4. The Virtualization Layer: The "10 Input Types" Model

### 4.1 What the User Sees
The user never interacts with paths like `01_Photogrammetry/{dataset_id}/telemetry/camera.csv` or `Processing/jobs/`.  
Instead, the UI presents **10 Visual Input Channel Cards**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PROJECT: MH-PUN-2026-VIL04 (Taluka: Haveli, Dist: Pune)           Accuracy: TIER 1     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [01] PHOTOGRAMMETRY              [02] LIDAR / POINT CLOUD        [03] GIS / CAD       │
│  Status: READY (Score: 94)        Status: EMPTY                   Status: READY (100)  │
│  Payload: 1,420 Frames            Payload: Drag LAS/LAZ here      Payload: 4 Files     │
│  • Overlap: 82% / 71%             (Click to browse)               • Parcels (.shp)     │
│  • GSD: 2.8 cm                    —                               • Village Map (.dwg) │
│                                                                                        │
│  [04] GNSS / SURVEY               [05] DEM / ELEVATION            [06] ARCHITECTURAL   │
│  Status: READY (Score: 98)        Status: READY WITH WARNINGS     Status: EMPTY        │
│  Payload: 18 Points               Payload: 1 DTM Raster           Payload: Drag IFC    │
│  • 12 GCPs, 6 Checkpoints         • Discrepancy: Void 1.2%        (Click to browse)    │
│  • RMS Error: 0.012 m             • GSD: 5.0 cm                   —                    │
│                                                                                        │
│  [07] PROPERTY / ROF              [08] ORTHOPHOTO IMAGERY         [09] PROJECT META    │
│  Status: READY (Score: 92)        Status: EMPTY                   Status: VALID        │
│  Payload: 120 Land Records        Payload: Drag COG/GeoTIFF       Payload: Manifest    │
│  • 7/12 Records: 120/120          (Click to browse)               • CRS: EPSG 32643    │
│  • Area Delta: 0.4%               —                               • Scale Factor: 1.0  │
│                                                                                        │
│  [10] SUPPORTING DOCS                                                                  │
│  Status: READY (Score: 100)                                                            │
│  Payload: 14 PDF Deeds & Recovery Sketches                                             │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 The Virtual Projection API
The front-end queries a lightweight virtual projection endpoint:
`GET /api/v2/projects/{project_id}/virtual-inputs`

Response Schema:
```json
{
  "projectId": "8f4a169b-e8f0-466d-9657-3f9f83656ab1",
  "projectCode": "MH-PUN-2026-VIL04",
  "title": "Haveli Taluka Village Boundary & 3D Cadastre",
  "targetCrs": "EPSG:32643",
  "accuracyTier": "TIER_1_CADASTRAL_LEGAL",
  "channels": [
    {
      "channelNumber": 1,
      "category": "CAT_01_PHOTOGRAMMETRY",
      "displayName": "Photogrammetry",
      "status": "READY",
      "readinessScore": 94.0,
      "datasetCount": 1,
      "primaryMetric": "1,420 Frames (GSD 2.8cm)",
      "badge": "Pass",
      "datasets": [
        {
          "id": "ds_photo_01",
          "name": "North Flight Block",
          "fileCount": 1422,
          "totalSize": "14.2 GB",
          "summary": "1,420 JPGs + camera.csv + flight_plan.json"
        }
      ]
    },
    {
      "channelNumber": 2,
      "category": "CAT_02_LIDAR_POINT_CLOUD",
      "displayName": "LiDAR / Point Cloud",
      "status": "EMPTY",
      "readinessScore": 0.0,
      "datasetCount": 0,
      "primaryMetric": "No data uploaded",
      "badge": "Optional"
    }
    // ... Channels 3 through 10
  ]
}
```

---

## 5. Ingestion Dispatcher: Automated Folder Routing

When the user drops any file or folder onto the application:
1. **Single Category Dropzone:** If the user drops files directly onto a specific Category Card (e.g. Card 03 GIS/CAD), the dispatcher automatically creates the dataset folder under `03_GIS_CAD/{dataset_id}/` and routes companion files (`.shp`, `.dbf`, `.shx`, `.prj`) to their standardized subdirectories.
2. **Master Project Dropzone:** If the user drops an unorganized folder containing mixed files (photos, total station CSV, legal PDFs):
   - The **Deterministic Category Correlator** (from Phase 0) classifies each file bundle.
   - It automatically provisions the canonical folder structure (`01_Photogrammetry/`, `04_GNSS/`, `10_Documents/`).
   - The user immediately sees the files organized into their respective Category Cards without having to understand the directory structure.

---

## 6. Implementation Readiness & Phase Gate

This specification is **FROZEN** as the foundational schema for:
- Phase 3 Engine Implementation: [project_engine.py](file:///d:/surveynaksha/project_engine.py) (Scaffolding, Routing & Virtual View)
- Phase 4: [NAKSHA_2.0_DESKTOP_SHELL.md](file:///d:/surveynaksha/NAKSHA_2.0_DESKTOP_SHELL.md) (Tauri, React, Tailwind, MapLibre, Three.js, FastAPI & Celery Shell)
- Phase 5: Processing Pipeline Orchestrator & Field QA Engine

