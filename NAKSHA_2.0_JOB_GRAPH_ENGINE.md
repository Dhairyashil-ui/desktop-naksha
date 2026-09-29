# NAKSHA 2.0 — DIRECTED ACYCLIC GRAPH (DAG) PROCESSING ENGINE
**Job Graph Architecture, Dependency Resolution, & Distributed Compute Orchestration**  
**Document Status:** FROZEN (Phase 12)  
**Parent Specifications:**  
- [NAKSHA_2.0_DATA_SPECIFICATION.md](file:///d:/surveynaksha/NAKSHA_2.0_DATA_SPECIFICATION.md) (10 Input Categories)  
- [NAKSHA_2.0_DATABASE_DESIGN.md](file:///d:/surveynaksha/NAKSHA_2.0_DATABASE_DESIGN.md) (Database & Storage)  
- [NAKSHA_2.0_READINESS_ENGINE.md](file:///d:/surveynaksha/NAKSHA_2.0_READINESS_ENGINE.md) (Readiness Gating)  

---

## 1. Architectural Philosophy: The Job Graph vs. Monolithic Scripts

Traditional geospatial software runs monolithic, linear processing scripts. In real-world survey production, this model fails:
- A failure in floor detection restarts a 6-hour photogrammetry bundle adjustment.
- LiDAR and Photogrammetry run sequentially instead of utilizing multi-GPU concurrency.
- Intermediate artifacts are not inspectable or checkpointed.

**Naksha 2.0 treats every processing job as a Directed Acyclic Graph (DAG)** of deterministic, atomic micro-tasks. Nodes only execute once their upstream dependencies succeed. Failed nodes can be isolated, debugged, and resumed from cached checkpoints.

---

## 2. Canonical DAG Hierarchy: `JOB 001`

```
JOB 001: Integrated 3D Cadastre & Land Demarcation
│
├── [01] Validate Inputs
│
├── [02] Photogrammetry (Branch A - Parallel)
│   ├── 02.1 Feature extraction (SIFT/ORB)
│   ├── 02.2 Feature matching (FLANN/Geometric verification)
│   ├── 02.3 Camera reconstruction (Incremental SfM)
│   ├── 02.4 Dense reconstruction (MVS depth maps)
│   └── 02.5 Point cloud generation (.copc.laz)
│
├── [03] LiDAR (Branch B - Parallel)
│   ├── 03.1 Read (Chunked LAS/LAZ stream)
│   ├── 03.2 Coordinate transform (Target EPSG reproject)
│   ├── 03.3 Noise filtering (SOR / Statistical outlier filter)
│   ├── 03.4 Classification (Progressive TIN densification)
│   └── 03.5 Point cloud generation (Normalized heights)
│
├── [04] GNSS (Branch C - Parallel)
│   └── 04.1 Coordinate processing (PPK base + GCP network adjustment)
│
├── [05] GIS (Branch D - Parallel)
│   └── 05.1 Parcel processing (Topology slivers & OGC linework check)
│
├── [06] DEM (Branch E - Parallel)
│   └── 06.1 Elevation processing (Hydro-enforcement & contour generation)
│
├── [07] Point Cloud Fusion (Barrier 1: Merges 02.5 + 03.5 + 04.1)
│
├── [08] Building Reconstruction (LoD-2 massing from Fused Cloud + 06.1)
│
├── [09] AI Segmentation (PointNet++ roof, facade, vegetation segmentation)
│
├── [10] Floor Detection (Z-slice density clustering & story height)
│
├── [11] Unit Detection (3D strata subdivision into individual parcels)
│
├── [12] Property Boundary Creation (3D topological faces + 05.1 vectors)
│
├── [13] Government Record Matching (Automated join with 7/12 RoR & mutations)
│
├── [14] Validation (Area reconciliation, topology checks, tolerance audit)
│
└── [15] Canonical Model (Publishing LADM ISO 19152 package to DB + S3 COG/COPC/3D Tiles)
```

---

## 3. Node Dependency Matrix

| Node ID | Node Name | Immediate Dependencies | Execution Type | Output Deliverable |
|:---|:---|:---|:---|:---|
| `validate_inputs` | Validate Inputs | *None* | Fast synchronous | Validated Manifest |
| `photo_extract` | Feature Extraction | `validate_inputs` | GPU / Concurrency | Keypoints (`.bin`) |
| `photo_match` | Feature Matching | `photo_extract` | GPU Matrix | Matches graph |
| `photo_camera` | Camera Reconstruction | `photo_match` | CPU Multi-core | Camera extrinsics/intrinsics |
| `photo_dense` | Dense Reconstruction | `photo_camera` | GPU CUDA | Depth maps |
| `photo_cloud` | Photo Point Cloud | `photo_dense` | CPU/Disk | `photo_dense.copc.laz` |
| `lidar_read` | LiDAR Read | `validate_inputs` | Streaming I/O | Raw Point Stream |
| `lidar_transform` | Coordinate Transform | `lidar_read` | PROJ / Vectorized | Transformed Points |
| `lidar_filter` | Noise Filtering | `lidar_transform` | Octree SOR | Denoised Cloud |
| `lidar_classify` | Classification | `lidar_filter` | Ground / Veg Filter | Classified Points |
| `lidar_cloud` | LiDAR Point Cloud | `lidar_classify` | Octree indexing | `lidar_norm.copc.laz` |
| `gnss_process` | GNSS Processing | `validate_inputs` | Geodetic Engine | GCP Adjustments (`.json`) |
| `gis_process` | GIS Parcel Processing | `validate_inputs` | GEOS / Shapely | Clean Parcel Geometries |
| `dem_process` | DEM Processing | `validate_inputs` | GDAL Raster | DTM/DSM Surface (`.cog.tif`) |
| `cloud_fusion` | Point Cloud Fusion | `photo_cloud`, `lidar_cloud`, `gnss_process` | ICP / Rigid ICP | `fused_master.copc.laz` |
| `bldg_recon` | Building Reconstruction | `cloud_fusion`, `dem_process` | CGAL 3D Mesh | LoD-2 Shells (`.glb`) |
| `ai_segment` | AI Segmentation | `bldg_recon` | PyTorch TensorRT | Semantic Point Labels |
| `floor_detect` | Floor Detection | `ai_segment` | Z-Histogram Cluster | Floor Slices (`.json`) |
| `unit_detect` | Unit Detection | `floor_detect` | 3D Strata Partition | 3D Unit Solids |
| `boundary_create`| Property Boundary Creation | `unit_detect`, `gis_process` | Topological Boundary | LADM 3D Legal Surfaces |
| `record_match` | Gov Record Matching | `boundary_create` | SQL Attribute Match | 7/12 RoR Joined Records |
| `validation` | Deep Validation | `record_match` | Rule Audit Engine | Validation Certificate |
| `canonical_model`| Canonical Model Publish | `validation` | S3 Publish / PostGIS | Master Cadastral Package |

---

## 4. Execution State Machine

Each node transitions through formal states:
- `PENDING`: Awaiting upstream dependencies.
- `RUNNING`: Dispatched to worker pool, streaming progress percentage & logs.
- `SUCCESS`: Artifact generated and verified via SHA-256 hash.
- `FAILED`: Isolated error; dependent nodes halt, sibling branches continue.
- `SKIPPED`: Bypassed due to upstream failure or cached output reuse.

---

## 5. Failure Recovery & Checkpointing

Every node writes its output to a deterministic object storage key:
`s3://naksha-storage/projects/{project_id}/jobs/{job_id}/nodes/{node_id}/output.json`

If `floor_detect` fails, the operator fixes parameters and re-runs from `floor_detect` without re-running `photo_*` or `lidar_*`.
