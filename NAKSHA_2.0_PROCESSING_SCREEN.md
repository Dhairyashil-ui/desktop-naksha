# NAKSHA 2.0 — PROCESSING SCREEN SPECIFICATION
**Real-Time 3D Building Construction, Volumetric Cadastre, & Pipeline Telemetry**  
**Document Status:** FROZEN (Phase 13)  
**Parent Specifications:**  
- [NAKSHA_2.0_JOB_GRAPH_ENGINE.md](file:///d:/surveynaksha/NAKSHA_2.0_JOB_GRAPH_ENGINE.md) (Job Graph DAG)  
- [NAKSHA_2.0_READINESS_ENGINE.md](file:///d:/surveynaksha/NAKSHA_2.0_READINESS_ENGINE.md) (Readiness Gating)  
- [NAKSHA_2.0_DATA_SPECIFICATION.md](file:///d:/surveynaksha/NAKSHA_2.0_DATA_SPECIFICATION.md) (10 Input Categories)  

---

## 1. Visual & Spatial Philosophy

The **Processing Screen** is the visual centerpiece of Naksha 2.0. Rather than showing a generic spinning loader or dry log terminal, the screen communicates the physical transformation of raw sensor data into legal 3D cadastral property units.

### Core Visual Principles
1. **Pure White Background (`#FFFFFF`)**: Gallery-grade Swiss minimalism. No dark UI distractions.
2. **Very Little Text**: Maximum spatial signal. Numbers and direct nouns only.
3. **Three-Column Spatial Architecture**:
   - **Left**: Linear task checklist with clear state symbols (`✓`, `●`, `○`).
   - **Center**: Dominant Three.js 3D viewport rendering the building being constructed in real-time.
   - **Right**: High-contrast, authoritative status metrics.

---

## 2. The 5 Real-Time 3D Construction Stages

```
RAW DATA  →  POINT CLOUD  →  BUILDING  →  FLOORS  →  PROPERTY UNITS
```

### Stage 1: `RAW DATA`
- **Sensors Rendered**: Airborne drone camera trajectory pyramid frustums, LiDAR scan swathes, ground control point (GCP) geodetic pillars on the ground datum.
- **Physical Meaning**: Unprocessed sensor observations before spatial co-registration.

### Stage 2: `POINT CLOUD`
- **Visuals**: Dense, multi-spectral point cloud ($12.4\text{M}$ points) forming the terrain surface and dense building point envelope.
- **Shader**: Elevation-ramped coloring (cool teal to warm ochre) with dynamic point density attenuation.

### Stage 3: `BUILDING`
- **Visuals**: Solid LoD-2 volumetric massing shell extracted from the dense cloud.
- **Materials**: Translucent frosted architectural acrylic facade with crisp black perimeter edge contours.

### Stage 4: `FLOORS`
- **Visuals**: Horizontal floor slabs slice into the building structure across 8 discrete vertical levels ($Z$-slice clustering).
- **Physical Meaning**: Vertical cadastre discretization separating ground land rights from multi-story horizontal strata.

### Stage 5: `PROPERTY UNITS`
- **Visuals**: 64 distinct 3D volumetric parcels (8 floors $\times$ 8 units/floor).
- **Cadastral Elements**: Each unit is color-coded by ownership parcel, bounded by topological 3D faces, and tagged with unique ULPIN identifiers.

---

## 3. Screen Layout Specification

### Left Column: `PROCESSING`
```
PROCESSING

✓ Data Validation
✓ Coordinate Alignment
✓ Photogrammetry
✓ LiDAR Processing
● Point Cloud Fusion
○ Building Reconstruction
○ Property Segmentation
○ Record Matching
○ Validation
○ Package Generation
```

### Center Column: `REAL 3D VIEWER`
- Interactive WebGL canvas (orbit rotate, pan, zoom, auto-rotate).
- Stage navigation breadcrumb allowing manual inspection or automated construction playback.

### Right Column: `STATUS`
```
STATUS

Point Cloud
12.4M points

Buildings
1

Floors
8

Units
64

Progress
67%
```
