# NAKSHA 2.0 — THE 7 VISIBLE PROCESSING STAGES
**Multi-Sensor Cadastral Reconstruction, Spatial Fusion, & Legal Verification Pipeline**  
**Document Status:** FROZEN (Phase 14)  
**Parent Specifications:**  
- [NAKSHA_2.0_PROCESSING_SCREEN.md](file:///d:/surveynaksha/NAKSHA_2.0_PROCESSING_SCREEN.md) (Screen Layout)  
- [NAKSHA_2.0_JOB_GRAPH_ENGINE.md](file:///d:/surveynaksha/NAKSHA_2.0_JOB_GRAPH_ENGINE.md) (Job Graph DAG)  
- [NAKSHA_2.0_READINESS_ENGINE.md](file:///d:/surveynaksha/NAKSHA_2.0_READINESS_ENGINE.md) (Readiness Gating)  

---

## 1. Executive Summary

In Naksha 2.0, the processing engine is not an invisible black box. Every processing stage is visibly communicated in the real-time 3D viewport, allowing surveyors, government registrars, and engineers to observe the deterministic transformation from raw drone images and laser scans into legal, title-matched 3D property units.

---

## 2. The 7 Processing Stages

### STAGE 1: PHOTOGRAMMETRY
> **Pipeline:** `Images → Reconstruction → Point Cloud`  
> **3D Representation:**
- Drone camera trajectory flight path floating above the ground datum.
- Multi-ray projection lines converging from camera stations to ground surface.
- Sparse bundle adjustment tie-points densifying into an RGB-textured point cloud.
- **Key Metric:** `1,420 Frames • 38.4M Points • GSD 2.8cm`

### STAGE 2: LiDAR
> **Pipeline:** `Scan → Clean → Register`  
> **3D Representation:**
- Laser scanner origin with active radial sweep visualization.
- Statistical Outlier Removal (SOR) filtering out airborne dust and noise points (rendered in red, then culled).
- Classified returns separated into Ground (brown), Low Vegetation (green), and Building Facades (electric cyan).
- **Key Metric:** `52.1M Raw Points • 142k Outliers Filtered • ASPRS Standard`

### STAGE 3: FUSION
> **Pipeline:** `LiDAR + Photogrammetry (Two datasets become one)`  
> **3D Representation:**
- Dual-source point clouds displayed simultaneously (Photogrammetry RGB + LiDAR Intensity/Height).
- Rigid Iterative Closest Point (ICP) alignment grid converging the two clouds.
- Visual snap-to-fit transition yielding a single unified master dense point cloud ($89.2\text{M}$ points).
- **Key Metric:** `Residual RMSE: 1.4 cm • Co-Registration Confidence: 99.4%`

### STAGE 4: BUILDING
> **Pipeline:** `Point Cloud → 3D Model`  
> **3D Representation:**
- Dense point cloud acts as the architectural boundary envelope.
- Planar surface extraction grows watertight LoD-2 volumetric massing solids from the cloud.
- Frosted translucent facade walls with crisp black perimeter edge contours.
- **Key Metric:** `1 Master Building • LoD-2.2 Geometry • Watertight Mesh`

### STAGE 5: PROPERTY
> **Pipeline:** `Building → Floors → Units`  
> **3D Representation:**
- Horizontal floor slabs slice through the building at 8 vertical levels ($Z$-slice clustering).
- Each floor is subdivided into 8 individual volumetric strata units ($8 \times 8 = 64$ units).
- Each unit is assigned a distinct cadastral pastel ownership color with black boundary wireframes.
- **Key Metric:** `8 Floors • 64 Strata Volumetric Units`

### STAGE 6: RECORD MATCHING
> **Pipeline:** `3D Unit ↔ Government Record`  
> **3D Representation:**
- 3D units display floating connection callouts linking spatial volumes to 7/12 RoR land records.
- Interactive unit audit: selecting any unit reveals its legal owner, survey parcel number, carpet area, and ULPIN code.
- Dynamic link lines confirm 100% attribute match between 3D geometry and revenue database.
- **Key Metric:** `120/120 RoR Records Matched • 64 Strata Titles Issued`

### STAGE 7: VALIDATION
> **Pipeline:**
> - `✓ Boundary`  
> - `✓ Coordinates`  
> - `✓ Topology`  
> - `✓ Record`  
> **3D Representation:**
- Glowing emerald legal cadastral boundary bounding the ground parcel.
- Geodetic coordinate axes verifying target projection (EPSG:32643).
- Spatial topology audit scan verifying zero sliver polygons, zero unit volume overlaps.
- Four green verification seals certifying compliance with ISO 19152 LADM standards.
- **Key Metric:** `Audit Score: 100% • ISO 19152 Compliant • Ready for Signoff`
