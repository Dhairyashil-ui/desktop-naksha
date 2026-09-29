# NAKSHA 2.0 — FINAL VALIDATION ENGINE
**Deterministic Quality Assurance & Pre-Output Integrity Gatekeeper**  
**Document Status:** FROZEN (Phase 18)  
**Parent Specifications:**  
- [NAKSHA_2.0_RECORD_MATCHING.md](file:///d:/surveynaksha/NAKSHA_2.0_RECORD_MATCHING.md) (Government Record Reconciliation)  
- [NAKSHA_2.0_3D_PROPERTY_LAYER.md](file:///d:/surveynaksha/NAKSHA_2.0_3D_PROPERTY_LAYER.md) (3D Property Units & Strata)  
- [NAKSHA_2.0_CANONICAL_DATA_MODEL.md](file:///d:/surveynaksha/NAKSHA_2.0_CANONICAL_DATA_MODEL.md) (Unified Data Model)  
- [schema.sql](file:///d:/surveynaksha/schema.sql) (PostgreSQL/PostGIS DDL)  

---

## 1. Executive Summary & Core Mandate

The Validation Engine serves as the authoritative, non-bypassable quality gatekeeper of Naksha 2.0. Before any outputs, official cadastral maps, 3D Land Administration Domain Model (ISO 19152 LADM) packages, or statutory revenue certificates are generated, the entire canonical dataset must pass **FINAL VALIDATION**.

> **The Core Mandate:**  
> *"Don't allow invalid data to silently enter the final package."*  
> If even a single spatial or cadastral check fails, package generation is locked.

```
FINAL VALIDATION

Geometry          ✓
Coordinates       ✓
CRS               ✓
Parcel Match      ✓
Floor Mapping     ✓
Unit Boundaries   ✓
Record Match      ✓
Topology          ✓

                 100%

If something fails:

FAILED

Unit 304
Boundary overlap detected

[ VIEW ISSUE ]
```

---

## 2. The 8 Strict Validation Gates

Every dataset undergoes rigorous geometric, topological, and legal audits across 8 independent verification gates:

| # | Gate Name | Subsystem Checked | Verification Criteria | Status on Pass | Status on Fail |
|---|:---|:---|:---|:---:|:---:|
| 1 | **Geometry** | 3D Solid Meshes | Watertight, 2-manifold surfaces, zero self-intersections, valid normal orientations ($N_z > 0$ for roofs) | `✓` | `✗` |
| 2 | **Coordinates** | GNSS / Control | Datum alignment, residuals $\le 0.02\text{ m}$, ellipsoid height consistency | `✓` | `✗` |
| 3 | **CRS** | Spatial Reference | EPSG:32643 (WGS 84 / UTM zone 43N) validation with official PROJ JSON parameter string | `✓` | `✗` |
| 4 | **Parcel Match** | 2D/3D Footprint | Building footprint $\le$ 2D Cadastral boundary with zero setback encroachment | `✓` | `✗` |
| 5 | **Floor Mapping** | Vertical Strata | Continuous vertical sequence without storey gaps, inter-floor slab thickness verified | `✓` | `✗` |
| 6 | **Unit Boundaries**| Unit Partitions | Disjoint strata space (ISO 19152 §5.2); no shared volume overlap across units | `✓` | `✗` |
| 7 | **Record Match** | Revenue Deeds | Unit carpet areas match Sub-Registrar / CTS deeds within statutory tolerance ($\pm 1.0\%$) | `✓` | `✗` |
| 8 | **Topology** | 3D Space Partition | Planar partition closure, shared boundary wall co-planarity, zero unassigned voids | `✓` | `✗` |

---

## 3. Failure Anatomy: Unit 304 Boundary Overlap

When a topological or geometric error occurs, Naksha 2.0 halts package generation, surfaces the exact error in high-signal monospace typography, and isolates the offending unit.

### 3.1 Failure Presentation
```
FAILED

Unit 304
Boundary overlap detected

[ VIEW ISSUE ]
```

### 3.2 Cadastral Issue Details (Unit 304)
- **Affected Feature:** `Unit 304` (Floor 3, residential apartment unit)
- **Conflicting Feature:** `Unit 303` (Adjacent western residential apartment unit)
- **Issue Type:** Boundary Overlap / Strata Space Collision
- **Severity:** `CRITICAL` (Package Generation Blocked)
- **Violation:** ISO 19152 §5.2 Disjoint Strata Space Principle
- **Geometric Measurement:**
  - Demising wall penetration depth: $14\text{ cm}$ ($0.14\text{ m}$)
  - Volumetric collision: $0.42\text{ m}^3$
  - Encroachment coordinate range: $X \in [385438.10, 385438.24], Y \in [2048160.00, 2048168.00], Z \in [545.10, 547.85]$

### 3.3 Auto-Remediation Workflow
1. User clicks **`[ VIEW ISSUE ]`**.
2. Naksha 2.0 displays the 3D issue inspection modal with the demising wall overlap diagnostic.
3. User triggers **`[ AUTO-RESOLVE OVERLAP ]`**.
4. The topological solver executes a **Centerline Vertex Snap**:
   - Computes the mutual cadastral centerline of the partition wall ($d / 2 = 7\text{ cm}$).
   - Snaps the 12 offending boundary vertices of Unit 304 and Unit 303 to the shared planar bisector.
   - Clears the volume overlap ($0.00\text{ m}^3$).
5. Final Validation automatically re-runs, restoring **`100%`** clean status and unlocking package generation.

---

## 4. Software Architecture & Implementation

### 4.1 Backend Engine (`backend/validation_engine.py`)
- **`ValidationGate` Model:** Represents each of the 8 verification gates with status (`passed` / `failed`), metric string, and detailed diagnostics.
- **`CadastralIssue` Model:** Captures issue ID, unit ID, floor, title, error description, severity, affected volume, and remediation action.
- **`run_final_validation(simulate_failure: bool)`:** Evaluates the 8 gates. When failure is simulated, Unit Boundaries and Topology fail, registering the Unit 304 overlap issue and setting `can_generate_package = False`.
- **`resolve_cadastral_issue(issue_id: str)`:** Programmatically applies the vertex snap fix, resolving the issue and returning the system to 100% readiness.

### 4.2 REST Endpoints (`backend/main.py`)
- `GET /api/v2/validation/final?simulate_failure={true|false}`: Returns full validation audit report.
- `POST /api/v2/validation/resolve-issue/{issue_id}`: Resolves the specified issue and returns the updated validation state.

### 4.3 Frontend Interface (`src/components/ValidationScreen.tsx`)
- Pure `#FFFFFF` Swiss minimalist canvas.
- Authoritative **`FINAL VALIDATION`** checklist with monospace alignment and green `✓` markers.
- Prominent **`100%`** indicator when all 8 gates pass.
- Urgent, uncluttered **`FAILED / Unit 304 / Boundary overlap detected / [ VIEW ISSUE ]`** card when an issue is detected.
- Interactive issue inspection modal with root cause analysis and instant auto-resolve action.
- Pre-output lock enforcing the zero-silent-error mandate.
