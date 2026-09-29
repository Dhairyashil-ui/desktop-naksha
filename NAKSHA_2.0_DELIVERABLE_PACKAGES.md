# NAKSHA 2.0 — DELIVERABLE PACKAGE BUILDERS ENGINE
**Statutory Export Subsystem: The 4 Canonical Cadastral & Survey Deliverable Packages**  
**Document Status:** FROZEN (Phase 19)  
**Parent Specifications:**  
- [NAKSHA_2.0_VALIDATION_ENGINE.md](file:///d:/surveynaksha/NAKSHA_2.0_VALIDATION_ENGINE.md) (Pre-Output Gatekeeper)  
- [NAKSHA_2.0_RECORD_MATCHING.md](file:///d:/surveynaksha/NAKSHA_2.0_RECORD_MATCHING.md) (Government Record Reconciliation)  
- [NAKSHA_2.0_3D_PROPERTY_LAYER.md](file:///d:/surveynaksha/NAKSHA_2.0_3D_PROPERTY_LAYER.md) (3D Property Units & Strata)  
- [NAKSHA_2.0_CANONICAL_DATA_MODEL.md](file:///d:/surveynaksha/NAKSHA_2.0_CANONICAL_DATA_MODEL.md) (Unified Data Model)  
- [schema.sql](file:///d:/surveynaksha/schema.sql) (PostgreSQL/PostGIS DDL)  

---

## 1. Executive Summary & Architecture

Following 100% successful execution of the **FINAL VALIDATION** engine (Phase 18), the Naksha 2.0 output engine synthesizes the verified Canonical Geospatial Data Model into **4 statutory package builders**.

```
                CANONICAL GEOSPATIAL DATA MODEL
                              │
               FINAL VALIDATION PASSED (100%)
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  1. TBK PKG  │       │  2. GIB PKG  │       │  3. VERTICAL │       │ 4. 3D SURVEY │
│  (Photogram) │       │   (2D GIS)   │       │ PROPERTY ZIP │       │     ZIP      │
└──────────────┘       └──────────────┘       └──────────────┘       └──────────────┘
```

Each package targets a specific jurisdictional stakeholder and statutory body:
1. **TBK Package** &rarr; Directorate of Land Records & Photogrammetry Division.
2. **GIB Package** &rarr; Municipal Corporation, Town Planning & Cadastral GIS Registries.
3. **Vertical Property ZIP** &rarr; Inspector General of Registration (IGR), MahaRERA, and 3D Strata Registry (ISO 19152 LADM).
4. **3D Survey ZIP** &rarr; Survey of India, Infrastructure Authorities, and openBIM/Engineering Teams.

---

## 2. The 4 Package Specifications

---

### Package 1: TBK Package (`.tbk` / `TBK Archive`)
*Statutory photogrammetric archive providing raw and orthorectified optical reality data.*

#### Core Constituents
1. **Orthophoto**: Cloud-Optimized GeoTIFF (`orthophoto/haveli_orthomosaic_5cm_cog.tif`, $5\text{cm}$ GSD, EPSG:32643).
2. **Raw / processed imagery**: 1,420 radiometrically balanced, calibrated optical frames (`imagery/processed_frames/`).
3. **Sensor information**: Interior orientation parameters (`sensor/sony_ilce_7rm4_calibration.xml`, focal length $35\text{mm}$, principal offset, Brown-Conrady coefficients).
4. **Orientation**: Exterior orientation matrix (`orientation/exterior_orientation_opk.csv`, $X, Y, Z, \omega, \phi, \kappa$ with covariance).
5. **Image metadata**: Flight logs and shutter telemetry (`metadata/flight_shutter_manifest.json`, millisecond RTK synchronization marks).
6. **Georeferencing**: Projection and control reports (`georef/orthophoto.tfw`, `georef/spatial_reference.prj`, GCP transformation residuals).

- **Total Volume:** $2.42\text{ GB}$  
- **Entry Points:** $1,426\text{ files}$  
- **Format:** Native `.tbk` / Compressed Tarball  

---

### Package 2: GIB Package (`.gib` / `GIB GeoPackage`)
*Authoritative 2D Geographic Information Base and Cadastral Boundary Network.*

#### Core Constituents
1. **2D GIS**: Unified OGC GeoPackage (`gis/cadastral_base.gpkg`, relational schemas, spatial R-Tree index).
2. **Parcels**: Statutory cadastral boundaries (`parcels/gat_cts_parcels.shp`, Gat & CTS numbers, land tenure, RoR acreage).
3. **Buildings**: Building plinth boundaries (`buildings/building_footprints_2d.shp`, heights, storeys, structural offsets).
4. **Roads**: Road networks (`roads/road_networks_row.shp`, carriageways, statutory right-of-way, access setbacks).
5. **CAD/GIS layers**: Stratified CAD vector sheet (`cad/cadastral_plinth_layers.dxf`, surveyor symbology and annotations).
6. **Topology**: Planar partition topology report (`topology/topological_closure_graph.json`, zero slivers, zero overlaps, $100\%$ closure).
7. **Survey control points**: Geodetic reference network (`control/control_points_benchmark.geojson`, primary DGPS benchmarks).

- **Total Volume:** $184.6\text{ MB}$  
- **Entry Points:** $48\text{ files}$  
- **Format:** Native `.gib` / OGC GeoPackage + Shapefile bundle  

---

### Package 3: Vertical Property ZIP (`.zip` / `Vertical Property Package`)
*ISO 19152 Land Administration Domain Model (LADM) 3D Strata and Multi-Level Property Register.*

#### Core Constituents
1. **Building**: Building master specifications (`building/building_master_profile.json`, plinth datum, foundation level, municipal approvals).
2. **Floor information**: Vertical floor strata register (`floors/vertical_floor_strata.json`, 8 storeys, elevation boundaries, slab thicknesses).
3. **Unit/flat information**: Legal property units register (`units/64_units_cadastral_register.json`, 64 units, carpet areas, deed linkage, ULPIN).
4. **Vertical property mapping**: 3D legal rights mapping (`property/vertical_strata_rights_ladm.json`, undivided parcel share, 3D title parcels).
5. **Floor plans**: Multi-storey architectural vector CAD plans (`floor_plans/vector_plans_floor_0_to_7.dxf` & certified stamped PDF bundle).
6. **3D building geometry**: Volumetric solid geometry (`geometry/building_lod2_strata_units.cityjson`, LoD-2.2 watertight solids, openBIM `IfcSpace`).

- **Total Volume:** $412.8\text{ MB}$  
- **Entry Points:** $192\text{ files}$  
- **Format:** Standard `.zip` Archive  

---

### Package 4: 3D Survey ZIP (`.zip` / `3D Survey Package`)
*High-density physical survey reality capture and 3D spatial foundation archive.*

#### Core Constituents
1. **3D point cloud**: High-density fused point cloud (`point_cloud/fused_cadastral_point_cloud.laz`, $12.4\text{M}$ points, ASPRS LAS 1.4).
2. **3D mesh / textured model**: Photorealistic 3D textured mesh (`mesh/building_photorealistic_mesh.glb` & Wavefront OBJ/MTL, 4K PBR atlas).
3. **LiDAR**: Classified laser scanning point cloud (`lidar/classified_ground_building_strata.laz`, Class 2 Ground, Class 6 Building).
4. **DEM / DTM / DSM**: Digital elevation surface grids (`elevation/dem_bare_earth_02m.tif`, `elevation/dsm_surface_02m.tif`, $0.2\text{m}$ resolution).
5. **Survey/control points**: Millimeter GNSS RTK observations (`control/gnss_rtk_baseline_vectors.csv`, base and rover vectors, PDOP values).
6. **3D spatial reference**: Compound coordinate reference system (`crs/epsg_32643_utm43n_egm2008.prj`, horizontal datum + EGM2008 geoid).

- **Total Volume:** $4.86\text{ GB}$  
- **Entry Points:** $16\text{ files}$  
- **Format:** Standard `.zip` Archive  

---

## 3. Package Generation & REST APIs

### Endpoints (`backend/main.py`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v2/packages` | Returns metadata, sizes, checksums, and constituents for all 4 packages |
| `GET` | `/api/v2/packages/{package_id}` | Returns single package details and complete internal file manifest |
| `POST` | `/api/v2/packages/generate-all` | Synthesizes and signs all 4 deliverable packages |
| `GET` | `/api/v2/packages/download/{package_id}` | Streams certified `.zip` archive with manifest and cadastral certificate |

---

## 4. Frontend Interface (`src/components/PackageOutputsScreen.tsx`)

- **Aesthetic:** Swiss minimalist pure `#FFFFFF` background with high-signal typography.
- **2x2 Package Cards Grid:** Each card showcases the package format, volume, file count, and constituent checklist with verification checks.
- **Constituent Checklist:** Displays every single constituent required by the system specification with clean green checkmarks.
- **Manifest Inspector Modal:** Provides deep-dive inspection into the internal archive hierarchy, individual file sizes, and SHA-256 integrity hashes.
- **Interactive Actions:** Direct download of individual packages, or master `[ GENERATE ALL 4 PACKAGES ]` with progress feedback.
