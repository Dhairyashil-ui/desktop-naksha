# NAKSHA 2.0 — RECORD MATCHING ENGINE
**Deterministic Reconciliation Between 3D Spatial Units and Government Land Revenue Records**  
**Document Status:** FROZEN (Phase 17)  
**Parent Specifications:**  
- [NAKSHA_2.0_3D_PROPERTY_LAYER.md](file:///d:/surveynaksha/NAKSHA_2.0_3D_PROPERTY_LAYER.md) (3D Property Strata)  
- [NAKSHA_2.0_CANONICAL_DATA_MODEL.md](file:///d:/surveynaksha/NAKSHA_2.0_CANONICAL_DATA_MODEL.md) (Unified Representation)  
- [schema.sql](file:///d:/surveynaksha/schema.sql) (PostgreSQL/PostGIS DDL)  

---

## 1. Executive Summary & Conceptual Flow

In Phase 17, Naksha 2.0 connects physical, sensor-derived 3D property units directly to statutory government land records (Maharashtra Land Revenue Code 1966, 7/12 RoR Extracts, City Survey CTS Cards, and MahaRERA registered deeds).

```
3D UNIT
   │
   ├── Geometry (LoD-2.2 Watertight Solid Volume)
   ├── X/Y/Z    (EPSG:32643 UTM 43N Geodesic Coordinates)
   ├── Floor    (Vertical Storey Level)
   └── Area     (Net Usable Carpet Area in m²)
          │
          ▼
   GOVERNMENT RECORD
   (Deed No, CTS No, ULPIN, Owner, Registered Floor, Registered Area)
          │
          ▼
        MATCH

If mismatch:
⚠ RECORD MISMATCH

If successful:
✓ RECORD MATCHED
```

---

## 2. Tolerance Thresholds & Verification Rules

Every 3D unit passes through 5 deterministic audit gates:

| Attribute | Audit Rule | Statutory Tolerance | Failure Verdict |
| :--- | :--- | :--- | :--- |
| **Floor Level** | $Floor_{\text{3D}} == Floor_{\text{Deed}}$ | Exact Match ($0$) | `⚠ RECORD MISMATCH` (Storey Index Error) |
| **Carpet Area** | $\frac{\|Area_{\text{3D}} - Area_{\text{Deed}}\|}{Area_{\text{Deed}}} \times 100\%$ | $\le \pm 1.00\%$ | `⚠ RECORD MISMATCH` (Encroachment Flagged) |
| **2D Parcel** | Centroid inside Parcel Boundary | $100\%$ Spatial Containment | `⚠ RECORD MISMATCH` (Boundary Encroachment) |
| **Coordinates** | Projected $X, Y, Z$ within AOI | $\sigma \le 0.02\text{m}$ (Tier 1 Cadastral) | `⚠ RECORD MISMATCH` (Datum Misalignment) |
| **Revenue Deed** | Valid CTS Number & ULPIN | Validated in Mahabhulekh | `⚠ RECORD MISMATCH` (Unrecorded Unit) |

---

## 3. Benchmark Audit Cases

### 3.1 Successful Match Case: Unit 302
- **3D Spatial Properties:**
  - Geometry: LoD-2.2 Solid Mesh ($84.50\text{ m}^2$)
  - Coordinates: $X: 385,435.42, Y: 2,048,168.18, Z: 546.65$
  - Floor: Floor 3
  - Area: $84.50\text{ m}^2$
- **Government Record (Deed `MH-PUN-HAV-2026-0302`):**
  - CTS No: `CTS 142/B-302` (ULPIN: `MH-PUN-2026-0942-302`)
  - Owner: Sunita R. Kulkarni
  - Registered Floor: Floor 3
  - Registered Area: $84.50\text{ m}^2$
- **Audit Outcome:** Area Delta $0.00\text{ m}^2$ ($0.0\%$).
- **Verdict:** **`✓ RECORD MATCHED`**

### 3.2 Area Encroachment Discrepancy Case: Unit 504
- **3D Spatial Properties:**
  - 3D Surveyed Area: $98.20\text{ m}^2$ (Physical balcony/terrace extension surveyed)
  - Floor: Floor 5
- **Government Record:**
  - Registered Deed Area: $84.50\text{ m}^2$
- **Audit Outcome:** Area Delta $+13.70\text{ m}^2$ ($+16.2\% \gg \pm 1.0\%$).
- **Verdict:** **`⚠ RECORD MISMATCH`** (Unsanctioned structural extension flagged for cadastral regularization).

### 3.3 Floor Level Index Discrepancy Case: Unit 702
- **3D Spatial Properties:**
  - Physical Elevation: Floor 7 ($Z = 552.65\text{ m}$)
- **Government Record:**
  - Legacy Deed Index: Floor 6 (Clerical indexing error at Sub-Registrar Office)
- **Audit Outcome:** Floor Level Conflict.
- **Verdict:** **`⚠ RECORD MISMATCH`** (Title rectification required).

---

## 4. API Endpoints

- `GET /api/v2/records/matching/summary`  
  Returns total units ($64$), matched count ($62$), mismatch count ($2$), and $96.9\%$ match confidence.
- `GET /api/v2/records/matching/unit/{unit_number}`  
  Returns detailed 3D Unit $\leftrightarrow$ Government Record comparison card for any unit.
