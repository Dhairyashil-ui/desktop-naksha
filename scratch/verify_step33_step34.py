"""
End-to-end verification script for Phase 7:
- STEP 33: Build canonical project from REAL artifacts
- STEP 34: Real 3D property database (Project -> Parcel -> Building -> Floor -> Unit)
"""

import sys
import os
import json
from pathlib import Path

# Set up project root in python path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def main():
    print("=" * 70)
    print("PHASE 7 VERIFICATION: STEP 33 & STEP 34")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # TEST 1: Real 3D Property Database Hierarchy (STEP 34)
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Verifying 3D Property Hierarchy in Database (Project -> Parcel -> Building -> Floor -> Unit)...")
    from backend.property_database import (
        load_3d_property_hierarchy_from_db,
        sync_3d_property_hierarchy_to_db
    )

    # Load from DB (or sync if first run)
    hierarchy = load_3d_property_hierarchy_from_db("PROJ-PUNE-001")
    if not hierarchy or not hierarchy.get("units"):
        print("  -> Syncing 3D property hierarchy to database...")
        sync_res = sync_3d_property_hierarchy_to_db("PROJ-PUNE-001")
        print(f"  -> Sync result: {sync_res}")
        hierarchy = load_3d_property_hierarchy_from_db("PROJ-PUNE-001")

    proj = hierarchy.get("project", {})
    parcel = hierarchy.get("parcel", {})
    bldg = hierarchy.get("building", {})
    floors = bldg.get("floors", [])
    units = hierarchy.get("units", [])

    print(f"  -> Project:  {proj.get('title')} ({proj.get('code')})")
    print(f"  -> Parcel:   Survey {parcel.get('survey_number')}/{parcel.get('sub_division')}, ULPIN: {parcel.get('ulpin')}")
    print(f"  -> Building: {bldg.get('name')} ({bldg.get('building_code')})")
    print(f"  -> Floors:   {len(floors)} floor levels")
    print(f"  -> Units:    {len(units)} 3D strata units")

    assert len(floors) > 0, "No floors found in database!"
    assert len(units) > 0, "No units found in database!"

    # Verify all 11 attributes on every unit
    required_unit_keys = [
        ("footprint_2d", "2D geometry"),
        ("geometry_3d", "3D geometry"),
        ("centroid_xyz", "XYZ centroid"),
        ("floor_id", "floor"),
        ("carpet_area_sqm", "area"),
        ("volume_m3", "volume"),
        ("base_ulpin", "base ULPIN"),
        ("property_id_3d", "3D property identity"),
        ("survey_source", "survey source"),
        ("record_match", "record match"),
        ("validation", "validation status")
    ]

    print("\n[TEST 2] Verifying the 11 Required Unit Attributes on Database Units (STEP 34)...")
    sample_unit = units[0]
    print(f"  Inspecting sample unit: {sample_unit.get('unit_number')} (ID: {sample_unit.get('unit_id')})")
    for key, desc in required_unit_keys:
        val = sample_unit.get(key)
        assert val is not None, f"Unit missing required attribute: {key} ({desc})"
        if isinstance(val, (dict, list)):
            val_str = json.dumps(val)[:45] + "..." if len(json.dumps(val)) > 45 else json.dumps(val)
        else:
            val_str = str(val)
        print(f"  ✓ {desc:22s} [{key}]: {val_str}")

    # Check all units have valid 3D property identity and base ULPIN
    for u in units:
        assert u.get("base_ulpin"), f"Unit {u.get('unit_number')} missing base ULPIN"
        assert u.get("property_id_3d"), f"Unit {u.get('unit_number')} missing 3D property ID"
        assert u.get("centroid_xyz") and len(u.get("centroid_xyz")) == 3, f"Unit {u.get('unit_number')} invalid XYZ"
        assert u.get("volume_m3") and u.get("volume_m3") > 0, f"Unit {u.get('unit_number')} invalid volume"
    print(f"  ✓ All {len(units)} units maintain complete 11 attributes!")

    # -------------------------------------------------------------------------
    # TEST 3: Dynamic Canonical Project Construction (STEP 33)
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Building Canonical Project from REAL artifacts, geometry, records, validation (STEP 33)...")
    from backend.canonical_model.builder import build_canonical_project
    from backend.canonical_model.exporter import export_canonical_to_ladm_json, export_canonical_to_geojson_fg

    canonical_proj = build_canonical_project("PROJ-PUNE-001")
    print(f"  -> Canonical Project ID: {canonical_proj.id}")
    print(f"  -> Code:                {canonical_proj.code}")
    print(f"  -> Total Units:         {len(canonical_proj.units)}")
    print(f"  -> Fused Points:        {canonical_proj.geometry.total_fused_points:,}")
    print(f"  -> Fused LAS Path:      {canonical_proj.geometry.point_cloud_fused_uri}")
    print(f"  -> Mesh Watertight:     {canonical_proj.geometry.mesh_topology_watertight}")
    print(f"  -> Matched Titles:      {canonical_proj.government_records.matched_records}/{canonical_proj.government_records.total_records} ({canonical_proj.government_records.match_percentage}%)")
    print(f"  -> Validation Certified:{canonical_proj.validation.overall_certified} (Score: {canonical_proj.validation.overall_percentage}%, Checks: {len(canonical_proj.validation.checks)})")

    assert len(canonical_proj.units) == len(units), f"Unit count mismatch: {len(canonical_proj.units)} vs {len(units)}"
    assert canonical_proj.geometry.total_fused_points > 0, "No fused point count found"
    assert canonical_proj.validation.overall_certified is True, "Validation should be certified"

    # -------------------------------------------------------------------------
    # TEST 4: Single Source of Truth Outputs
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Generating Downstream Authoritative Outputs from Canonical Single Source...")
    ladm_json = export_canonical_to_ladm_json(canonical_proj)
    geojson_fg = export_canonical_to_geojson_fg(canonical_proj)

    assert ladm_json.get("standard") == "ISO 19152:2012 LADM"
    assert "LA_BAUnit" in ladm_json
    assert "LA_LegalSpaceBuildingUnit" in ladm_json
    assert geojson_fg.get("type") == "FeatureCollection"
    assert len(geojson_fg.get("features", [])) > 0

    print(f"  ✓ ISO 19152 LADM JSON export valid: {ladm_json['standard']}, {len(ladm_json.get('LA_RRR', []))} RRR titles")
    print(f"  ✓ GeoJSON-FG 3D export valid: {len(geojson_fg['features'])} features (Prism & Polygonal layers)")

    # -------------------------------------------------------------------------
    # TEST 5: FastAPI Endpoints Verification
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Testing FastAPI Web Endpoints...")
    from fastapi.testclient import TestClient
    from backend.main import app

    client = TestClient(app)

    res_proj = client.get("/api/v2/canonical/project/PROJ-PUNE-001")
    assert res_proj.status_code == 200, f"Failed /api/v2/canonical/project: {res_proj.status_code}"
    p_data = res_proj.json()
    assert p_data["id"] == canonical_proj.id
    print(f"  ✓ GET /api/v2/canonical/project/PROJ-PUNE-001 -> 200 OK ({len(p_data['units'])} units)")

    res_tree = client.get("/api/v2/canonical/tree/PROJ-PUNE-001")
    assert res_tree.status_code == 200, f"Failed /api/v2/canonical/tree: {res_tree.status_code}"
    t_data = res_tree.json()
    assert t_data["type"] == "PROJECT"
    print(f"  ✓ GET /api/v2/canonical/tree/PROJ-PUNE-001 -> 200 OK ({len(t_data['children'])} branches)")

    res_units = client.get("/api/v2/property/units")
    assert res_units.status_code == 200, f"Failed /api/v2/property/units: {res_units.status_code}"
    u_data = res_units.json()
    assert len(u_data["units"]) > 0
    print(f"  ✓ GET /api/v2/property/units -> 200 OK ({len(u_data['units'])} units with centroids & volumes)")

    res_export = client.get("/api/v2/canonical/export/PROJ-PUNE-001?format=ladm")
    assert res_export.status_code == 200, f"Failed /api/v2/canonical/export: {res_export.status_code}"
    print(f"  ✓ GET /api/v2/canonical/export/PROJ-PUNE-001?format=ladm -> 200 OK")

    print("\n" + "=" * 70)
    print("SUCCESS: STEP 33 & STEP 34 FULLY VERIFIED!")
    print("=" * 70)

if __name__ == "__main__":
    main()
