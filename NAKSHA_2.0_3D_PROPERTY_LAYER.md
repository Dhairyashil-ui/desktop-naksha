# NAKSHA 2.0 — 3D PROPERTY LAYER (STRATA CADASTRAL SUBDIVISION)
**Volumetric Strata Demarcation, 3D Unit Discretization, & Cadastral Reconciliation**  
**Document Status:** FROZEN (Phase 16)  
**Parent Specifications:**  
- [NAKSHA_2.0_CANONICAL_DATA_MODEL.md](file:///d:/surveynaksha/NAKSHA_2.0_CANONICAL_DATA_MODEL.md) (Canonical Architecture)  
- [NAKSHA_2.0_PROCESSING_STAGES.md](file:///d:/surveynaksha/NAKSHA_2.0_PROCESSING_STAGES.md) (7 Processing Stages)  

---

## 1. Executive Summary

Following **Stage 4 (Building Reconstruction)** and **Stage 5 (Property Segmentation)**, the Naksha 2.0 engine creates the **3D Property Layer**. 

Traditional cadastral systems treat multistory buildings as flat 2D polygons on a map, losing the legal geometry of high-rise apartment units, commercial offices, and vertical rights of way. The 3D Property Layer discretizes the LoD-2.2 architectural massing into individual, watertight 3D strata legal units linked to real-world coordinates and government revenue titles (7/12 RoR records).

---

## 2. Floor & Unit Hierarchy

```
BUILDING: Shivaji Heights Wing A (BLDG-A)

Floor 1
├── Unit 101
├── Unit 102
└── Unit 103 ... (8 Units Total)

Floor 2
├── Unit 201
├── Unit 202
└── Unit 203 ... (8 Units Total)

Floor 3
├── Unit 301
├── Unit 302  ◄ [SELECTED UNIT]
└── Unit 303 ... (8 Units Total)

Floor 4
├── Unit 401
└── ...

... up to Floor 8 (64 Total Strata Units)
```

---

## 3. Unit Inspection Specification (Unit 302 Benchmark)

When clicking **Unit 302** (or any unit in the 3D WebGL viewer or left hierarchy tree), the system computes and renders the official property card:

```
UNIT 302

Floor: 3
Area: 84.50 m²
X: 385435.42
Y: 2048168.18
Z: 546.65

2D Parcel: 142/B (MH-PUN-0942)
Record: Matched

STATUS
✓ VERIFIED
```

### 3.1 Mathematical & Coordinate Derivation
- **Horizontal Datum:** WGS 84 / UTM Zone 43N (`EPSG:32643`)
- **Vertical Datum:** EGM2008 Geoid (MSL)
- **Unit Center Geodesic Coordinates:**
  - $\text{Easting } (X) = 385,435.42\text{ m}$
  - $\text{Northing } (Y) = 2,048,168.18\text{ m}$
  - $\text{Elevation } (Z) = 546.65\text{ m}$ ($Z_{\text{ground}} = 542.15\text{ m} + 3 \times 1.50\text{ m}$)
- **Volumetric Dimensions:** $3.88\text{m} \times 1.34\text{m} \times 2.38\text{m}$ ($12.38\text{ m}^3$ net spatial volume)
- **Undivided Land Share (UDS):** $1.5625\%$ ($1/64^{\text{th}}$ share in Parcel 142/B)
- **Legal Record:** Mahabhulekh City Survey Sheet `CTS 142/B-302` linked to ULPIN `MH-PUN-2026-0942-302`
- **Owner of Record:** Sunita R. Kulkarni (Freehold Strata Title)

---

## 4. Real 3D Viewport Capabilities

- **Interactive Raycasting:** Clicking any 3D unit mesh in WebGL highlights the unit with an emissive blue glow and displays a 3D billboard callout.
- **Floor Isolation Mode:** Allows surveyors to isolate Floor 3 (or any floor from F1 to F8) while rendering other floors as ghosted silhouettes (opacity $0.08$).
- **Exploded Floor Slabs:** Lifts each floor slab vertically along the $Z$-axis, enabling unobstructed inspection of all 64 interior strata units.
- **2D Parcel Alignment:** Renders the emerald ground parcel boundary ($1,250.00\text{ m}^2$) beneath the vertical strata stack.

---

## 5. API Endpoints

- `GET /api/v2/property/units` — Returns all 64 units with floor, area, coordinates $(X, Y, Z)$, and verification status.
- `GET /api/v2/property/units/{unit_number}` — Returns detailed attributes for a specific unit (e.g. `UNIT 302`).
