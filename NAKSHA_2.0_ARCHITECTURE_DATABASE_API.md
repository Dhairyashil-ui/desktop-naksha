# NAKSHA 2.0 — DATABASE & ENTERPRISE ARCHITECTURE SPECIFICATION
**Physical PostGIS Database, Asynchronous Worker Pipeline, and Full System Topology**  
**Document Status:** FROZEN (Phase 21)  
**Parent Specifications:**  
- [schema.sql](file:///d:/surveynaksha/schema.sql) (PostgreSQL/PostGIS DDL)  
- [NAKSHA_2.0_CANONICAL_DATA_MODEL.md](file:///d:/surveynaksha/NAKSHA_2.0_CANONICAL_DATA_MODEL.md) (Unified Data Model)  
- [NAKSHA_2.0_DELIVERABLE_PACKAGES.md](file:///d:/surveynaksha/NAKSHA_2.0_DELIVERABLE_PACKAGES.md) (The 4 Package Builders)  
- [NAKSHA_2.0_VALIDATION_ENGINE.md](file:///d:/surveynaksha/NAKSHA_2.0_VALIDATION_ENGINE.md) (Pre-Output Gatekeeper)  

---

## 1. System Topology & Architecture Diagram

In Phase 21, the complete enterprise topology connects the native Tauri Desktop client down to the live PostgreSQL + PostGIS database, task broker, object storage, and specialized worker subsystems:

```
                 Tauri Desktop
                       │
                 React + TS
                       │
                  REST / WebSocket
                       │
                 FastAPI Backend
                       │
        ┌──────────────┼──────────────┐
        │              │              │
    PostgreSQL       Redis        Object Storage
     + PostGIS                     MinIO/S3
  (Supabase 17.6) (Celery Pool)   (Geo-Cache)
        │              │              │
        └──────────────┼──────────────┘
                       │
                Processing Workers
                       │
       ┌───────────────┼──────────────┐
       │               │              │
   GDAL/PDAL       Photogrammetry    3D/AI
 (Reproject/DEM)     (SFM/Mesh)   (Strata LADM)
       │               │              │
       └───────────────┼──────────────┘
                       │
                Canonical Model
                 (EPSG:32643)
                       │
               Package Generator
         (TBK, GIB, Vertical, 3D)
```

---

## 2. Live Database Infrastructure (PostgreSQL 17.6 + PostGIS 3.3.7)

### 2.1 Connection Credentials & Dual-Stack Resolution
- **Direct URI Template:** `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
- **IPv4 Connection Pooler Template:** `postgresql://${DB_POOLER_USER}:${DB_PASSWORD}@${DB_POOLER_HOST}:${DB_PORT}/${DB_NAME}`
- **Engine:** PostgreSQL 17.6 on aarch64-unknown-linux-gnu
- **Spatial Extension:** PostGIS 3.3.7 (with `uuid-ossp`, `pgcrypto`, `btree_gist`)
- **Connection Management:** Handled dynamically via environment variables in `.env` and [`backend/database.py`](file:///d:/surveynaksha/backend/database.py) with automatic IPv6 direct / IPv4 pooler failover.

### 2.2 Active Database Schema (18 Relational & PostGIS Tables)
Applied directly via [`backend/migrate.py`](file:///d:/surveynaksha/backend/migrate.py) from [`schema.sql`](file:///d:/surveynaksha/schema.sql):

| Table Name | Description | Key Spatial / Geometry Types |
| :--- | :--- | :--- |
| `organizations` | Government departments, survey directorates | Tenant UUID |
| `users` | Cadastral surveyors, GIS analysts, QA/QC officers | Role Enums, Cert Hashes |
| `projects` | Survey projects (e.g., Pune Haveli `MH-PUN-2026-VIL04`) | `GEOMETRY(Polygon, 4326)` AOI |
| `surveys` | Field campaign sessions and instrument manifests | Lead Surveyor, Weather Logs |
| `input_datasets` | The 10 Ingestion channels with dual readiness scores | `GEOMETRY(PolygonZ, 4326)` Extent |
| `dataset_files` | Ingested optical frames, LAS files, DXF sheets | S3 Bucket/Key, SHA-256 |
| `ground_control_points` | High-precision DGPS/RTK benchmarks and GCPs | `GEOMETRY(PointZ, 4326)`, DOP |
| `parcels` | Statutory 2D cadastral land parcels (Gat/CTS) | `GEOMETRY(MultiPolygonZ, 4326)` |
| `buildings` | 3D building plinths, height, and IFC GUID | `GEOMETRY(MultiPolygonZ, 4326)` Footprint |
| `floors` | Vertical storeys (Floors 0 to 7) with elevation bounds | Storey index, $Z_{\min} \dots Z_{\max}$ |
| `units` | 3D property units with net usable carpet areas | `GEOMETRY(PolyhedralSurfaceZ, 4326)` |
| `property_titles` | Sub-Registrar registered deed linkage and RoR shares | ULPIN, Deed No, Owner Hash |
| `validation_results` | Results of the 8 final validation gates | JSONB Checks, Readiness Score |
| `processing_jobs` | Celery DAG pipeline execution instances | Status, Worker ID, Logs |
| `job_input_bindings` | Relational bindings between jobs and raw datasets | Compound Primary Key |
| `processed_artifacts` | Generated orthomosaics, point clouds, meshes | Spatial bounds, MinIO/S3 URL |
| `project_snapshots` | Version-controlled project commits and state trees | Merkle state tree hash |
| `parcel_mutations` | Legal land partition and amalgamation deeds | Parent/Derived parcel UUIDs |

---

## 3. Worker & Subsystem Architecture

### 3.1 Object Storage Subsystem (`backend/storage.py`)
- Interfaces with MinIO / S3 across three dedicated buckets:
  - `naksha-raw`: Raw optical frames, point clouds, GNSS logs.
  - `naksha-processed`: COG GeoTIFFs, 3D tiles, classified surfaces.
  - `naksha-packages`: Certified package archives (`.tbk`, `.gib`, `.zip`).
- Includes automatic zero-configuration local cache fallback (`storage_cache/`).

### 3.2 Task Queue & Asynchronous Broker (`backend/queue.py`)
- Redis / Celery broker managing task priority queues and dispatching execution to 4 workers.
- Supports concurrent job monitoring and real-time WebSocket telemetry.

### 3.3 Specialized Worker Pipeline (`backend/workers/`)
1. **GDAL / PDAL Worker**: Performs coordinate transformations into `EPSG:32643`, noise filtering, ground classification, and bare earth DEM/DSM interpolation.
2. **Photogrammetry Worker**: Executes SIFT feature extraction, sparse bundle adjustment, dense multi-view stereo matching, and orthomosaic rasterization.
3. **3D / AI Worker**: Executes deep learning point cloud segmentation, vertical floor detection ($3.0\text{m}$ interval), and watertight unit boundary solid construction.

---

## 4. API Endpoints (`backend/main.py`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v2/database/health` | Live PostgreSQL 17 + PostGIS 3.3 connection status, latency, and active table count |
| `GET` | `/api/v2/database/projects` | Queries live cadastral projects from PostgreSQL |
| `GET` | `/api/v2/database/parcels` | Queries parcels with `ST_AsGeoJSON` and real-time computed GIS areas |
| `GET` | `/api/v2/database/buildings` | Queries 3D building plinths and vertical floor levels |
| `GET` | `/api/v2/database/units` | Queries 3D strata units, carpet areas, and registered deed owners |
| `GET` | `/api/v2/architecture/status` | Authoritative status across all 11 enterprise architectural layers |
| `GET` | `/api/v2/packages/download-all` | Streams `NAKSHA_ALL_DELIVERABLES.zip` package bundle |
