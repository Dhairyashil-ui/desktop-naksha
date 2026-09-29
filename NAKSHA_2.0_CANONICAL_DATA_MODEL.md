# NAKSHA 2.0 — CANONICAL GEOSPATIAL DATA MODEL
**The Heart of Naksha 2.0: Unified Internal Spatial, Architectural, & Legal Representation**  
**Document Status:** FROZEN (Phase 15)  
**Parent Specifications:**  
- [NAKSHA_2.0_DATA_SPECIFICATION.md](file:///d:/surveynaksha/NAKSHA_2.0_DATA_SPECIFICATION.md) (Ingestion Subsystem)  
- [NAKSHA_2.0_JOB_GRAPH_ENGINE.md](file:///d:/surveynaksha/NAKSHA_2.0_JOB_GRAPH_ENGINE.md) (Processing DAG)  
- [NAKSHA_2.0_PROCESSING_STAGES.md](file:///d:/surveynaksha/NAKSHA_2.0_PROCESSING_STAGES.md) (7 Processing Stages)  
- [schema.sql](file:///d:/surveynaksha/schema.sql) (PostgreSQL/PostGIS DDL)  

---

## 1. Executive Summary

In traditional GIS and cadastre systems, data remains fragmented across disconnected silos: raw drone images live in file shares, point clouds live in standalone desktop viewers, vector polygons sit in GIS shapefiles, CAD drawings sit in proprietary DWG files, and land registry records exist in legacy government databases.

**Naksha 2.0 fundamentally rejects fragmentation.**  
Every raw image, laser point, vector polygon, vertical floor slab, and legal deed eventually converges into **one unified internal representation**: the **Canonical Geospatial Data Model**.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         NAKSHA 2.0 CONVERGENCE PARADIGM                        │
│                                                                                │
│   Photogrammetry ──┐                                                           │
│   LiDAR Scans    ──┼──► Processing Pipeline (JOB 001) ──►  CANONICAL DATA      │
│   GNSS GCPs      ──┤                                        MODEL              │
│   GIS Parcels    ──┼──► Spatial Fusion & Demarcation        (One Unified       │
│   7/12 Records   ──┘                                         Representation)   │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Conceptual Tree Hierarchy

The canonical data model reflects the natural legal and architectural topology of real-world land property:

```
PROJECT
│
├── Parcel
│
├── Building
│     │
│     ├── Floor 0
│     ├── Floor 1
│     ├── Floor 2
│     └── Floor 3 ...
│
├── Units
│     ├── Unit 001
│     ├── Unit 002
│     ├── Unit 003
│     └── ...
│
├── Geometry
│
├── Coordinates
│
├── Survey Data
│
├── Government Records
│
└── Validation
```

---

## 3. Entity Breakdown

### 3.1 Project (`CanonicalProject`)
The root container representing a unified demarcation assignment.
- **Project ID:** `project_pune_res_001`
- **Code:** `Pune_Residential_001`
- **Title:** Pune Residential 001
- **Organization:** Department of Land Records, Government of Maharashtra
- **Accuracy Tier:** `TIER_1_CADASTRAL_LEGAL` (Horizontal $\le 0.02\text{m}$, Vertical $\le 0.03\text{m}$)

### 3.2 Parcel (`Parcel`)
The 2D/3D terrestrial land lot defined in the cadastral survey.
- **Survey Number:** `142 / B`
- **ULPIN:** `MH-PUN-2026-0942` (14-digit standard)
- **Legal Area (7/12 RoR):** $1,250.00\text{ m}^2$
- **GIS Computed Area:** $1,249.85\text{ m}^2$
- **Discrepancy ($\Delta$):** $0.012\%$ (Within statutory tolerance $< 0.1\%$)
- **Boundary Polygon:** 5 georeferenced boundary vertices

### 3.3 Building (`Building`)
The physical structure occupying the parcel, modeled at LoD-2.2 architectural massing.
- **Building Code:** `BLDG-A` (`Shivaji Heights Wing A`)
- **Structure Type:** `RCC_RESIDENTIAL`
- **Vertical Extents:** 8 Floors Above Ground, 1 Basement Level
- **Ground Datum Elevation ($Z$):** $542.15\text{ m}$ MSL
- **Total Architectural Height:** $12.00\text{ m}$
- **Footprint Area:** $320.00\text{ m}^2$
- **Gross Built-Up Area:** $2,560.00\text{ m}^2$

### 3.4 Floors (`Floor[]`)
Horizontal volumetric tiers subdividing the building structure.
- **Tiers:** 8 distinct floors (`Floor 0` / Ground through `Floor 7`)
- **Floor Height:** $1.50\text{ m}$ per tier
- **Structural Slab Thickness:** $0.18\text{ m}$ reinforced concrete
- **Strata Units per Floor:** 8 legal property units

### 3.5 Units (`CadastralUnit[]`)
The atomic legal 3D spatial units owned by private citizens or institutions.
- **Total Count:** 64 Units ($8\text{ floors} \times 8\text{ units/floor}$)
- **Numbering:** Unit 101 .. Unit 808
- **Net Usable Carpet Area:** $84.50\text{ m}^2$ per standard unit
- **Gross Built-Up Area:** $105.62\text{ m}^2$
- **Undivided Land Share (UDS):** $1.5625\%$ per unit ($100\% / 64$)
- **3D Spatial Solid:** Polyhedral surface / 3D bounding box $[X_{\min}, Y_{\min}, Z_{\min}, X_{\max}, Y_{\max}, Z_{\max}]$
- **Title Link:** Linked directly to registered 7/12 RoR deed

### 3.6 Geometry (`GeometryStore`)
Multi-modal geometric representations maintaining full spatial fidelity.
- **3D Architectural Mesh:** Watertight LoD-2.2 GLB binary model
- **2D GIS Cadastre Layers:** GeoJSON parcel boundaries, building footprints, and unit plans
- **Point Clouds:**
  - Raw Photogrammetry: $38.4\text{M}$ RGB points
  - Raw LiDAR: $52.1\text{M}$ laser returns
  - Master Fused Cloud: $89.2\text{M}$ co-registered points (COPC format)
  - Downsampled Envelope: $12.4\text{M}$ points

### 3.7 Coordinates (`Coordinates`)
Geodetic framework guaranteeing sub-centimeter legal accuracy.
- **Target CRS:** `EPSG:32643` (`WGS 84 / UTM zone 43N`)
- **Geodetic Datum:** WGS 84 Ellipsoid
- **Vertical Datum:** EGM2008 Geoid (Mean Sea Level)
- **Combined Grid Scale Factor:** $0.9996024$
- **Control Network:** 18 dual-frequency GNSS Ground Control Points
- **Network Accuracy:** Horizontal RMSE $0.011\text{m}$, Vertical RMSE $0.019\text{m}$

### 3.8 Survey Data (`SurveyData`)
Metadata audit trail of all physical sensor captures.
- **Photogrammetry:** 1,420 high-resolution aerial frames, GSD $2.8\text{cm}$, overlap 82%/71%
- **LiDAR:** Riegl miniVUX-3UAV laser scanner, 142k statistical outlier returns filtered
- **GNSS:** RTK / Static dual-frequency rover observations
- **DEM:** $0.50\text{m}$ hydro-enforced digital elevation grid

### 3.9 Government Records (`GovernmentRecords`)
The statutory legal registry verified against Maharashtra Land Revenue Code 1966 and MahaRERA.
- **Total Titles:** 64 individual titles
- **Matched Titles:** 64 / 64 ($100\%$ reconciliation)
- **Records Manifest:**
  - 7/12 RoR Extracts (Village Form VII & XII)
  - City Survey CTS Property Cards (`CTS 142/B-101` .. `402` .. `808`)
  - Sub-Registrar Registered Deeds
  - Encumbrance Status: Verified Clear

### 3.10 Validation (`ValidationReport`)
Four-pillar legal demarcation certification:
1. `✓ Boundary`: Parcel boundary verified within $\pm 0.008\text{m}$ (tolerance $\pm 0.02\text{m}$)
2. `✓ Coordinates`: EPSG:32643 projection & geodetic transform confirmed
3. `✓ Topology`: 0 sliver polygons, 0 overlapping unit volumes, 100% watertight manifold mesh
4. `✓ Record`: 100% 7/12 RoR revenue title correspondence

---

## 4. International Standards Compliance

The Canonical Data Model maps 1-to-1 to international spatial land administration standards:

| Naksha 2.0 Entity | ISO 19152 LADM Class | OGC CityGML 3.0 Element | GeoJSON-FG FeatureType |
| :--- | :--- | :--- | :--- |
| **Parcel** | `LA_BAUnit` / `LA_SpatialUnit` | `CadastralParcel` | `CadastralParcel` |
| **Building** | `LA_LegalSpaceBuildingUnit` | `Building` (LoD 2.2) | `BuildingLoD2` |
| **Floor** | `LA_Level` | `Storey` | `BuildingStorey` |
| **Unit** | `LA_SpatialUnit` (3D Volume) | `BuildingUnit` | `StrataUnit3D` |
| **Government Record** | `LA_RRR` (Rights & Restrictions) | `ExternalReference` | `PropertyTitle` |
| **Landowner** | `LA_Party` | `Address` / `Party` | `OwnerParty` |
| **Coordinates** | `LA_SpatialSource` | `srsName` | `coordRefSys` |

---

## 5. API Endpoints

The canonical model is exposed via high-performance REST endpoints in `backend/main.py`:

- `GET /api/v2/canonical/project/{project_id}`  
  Returns the complete unified JSON document.
- `GET /api/v2/canonical/tree/{project_id}`  
  Returns the recursive tree hierarchy node structure for UI explorers.
- `GET /api/v2/canonical/export/{project_id}?format=ladm`  
  Exports the canonical model compliant with the ISO 19152:2012 LADM standard.
- `GET /api/v2/canonical/export/{project_id}?format=geojson`  
  Exports the 2D/3D spatial boundaries compliant with OGC GeoJSON-FG.
