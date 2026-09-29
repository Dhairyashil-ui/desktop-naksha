"""
Verification Test Suite for Step 27 & Step 28 (Phase 6: Apartment Space & 3D Property Geometry)

Step 27: Build actual apartment/unit geometry:
         Building -> Floor -> Apartment/Unit -> 3D volume
         Each apartment: unit_id, floor_id, geometry_3d, footprint_2d, min_z, max_z, area, volume, centroid_xyz
         Source: survey data + floor plans + building geometry + property records.
         NOT hardcoded boxes!

Step 28: Create the 3D property space:
         Selecting Apartment A shows:
         - 2D footprint
         - 3D volume
         - floor
         - XYZ
         - associated parcel
         - associated government record
"""

import sys
import json
import tempfile
from pathlib import Path
import numpy as np

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, ".")

from scratch.verify_step25_step26 import create_surveyed_building_cloud
from backend.apartment_geometry import apartment_engine, ApartmentGeometryEngine
from backend.workers import AI3DWorker
from fastapi.testclient import TestClient
from backend.main import app

SEP = "=" * 72


def test_step27_apartment_geometry():
    print(SEP)
    print("TESTING STEP 27: BUILD ACTUAL APARTMENT/UNIT GEOMETRY (WATERTIGHT 3D B-REP)")
    print(SEP)

    tmp = Path(tempfile.mkdtemp(prefix="naksha_step27_test_"))
    in_las = tmp / "fused_survey_cloud.las"
    create_surveyed_building_cloud(in_las)
    print(f"Created real survey point cloud: {in_las} ({in_las.stat().st_size:,} bytes)")

    # Execute Apartment Geometry Engine
    manifest = apartment_engine.build_apartments_from_survey(
        survey_cloud_path=in_las,
        output_dir=tmp / "apartments"
    )

    print("\nApartment Strata Hierarchy:")
    print(f"  Building:       {manifest['building_name']} ({manifest['building_id']})")
    print(f"  Floors Count:   {manifest['total_floors']}")
    print(f"  Total Units:    {manifest['total_units']}")
    print(f"  Carpet Area:    {manifest['total_carpet_area_sqm']:,.2f} m2")
    print(f"  Total Volume:   {manifest['total_volume_m3']:,.2f} m3")

    assert manifest["status"] == "SUCCESS"
    assert manifest["total_floors"] >= 4
    assert manifest["total_units"] >= 16

    print("\nHierarchical Inspection (Building -> Floor -> Unit -> 3D Volume):")
    for fl in manifest["floors"]:
        print(f" ├── Floor {fl['floor_number']} ({fl['floor_label']}): Slab Z = {fl['slab_elevation_m']:.3f}m .. {fl['ceiling_elevation_m']:.3f}m (Height: {fl['clear_height_m']:.3f}m)")
        for u in fl["units"]:
            print(f" │    ├── {u['unit_alias']:<6} ({u['unit_id']}) | Type: {u['unit_type']}")
            print(f" │    │     Footprint 2D Area:  {u['area']} m2 (Perimeter: {u['footprint_2d']['perimeter_m']} m)")
            print(f" │    │     3D Volume:          {u['volume']} m3 (Watertight: {u['geometry_3d']['is_watertight']})")
            print(f" │    │     Centroid XYZ:       {u['centroid_xyz']}")
            print(f" │    │     Z Range:            {u['min_z']:.3f} m .. {u['max_z']:.3f} m")

            # Strict verification of required fields
            assert "unit_id" in u and u["unit_id"].startswith("UNIT_")
            assert "floor_id" in u and u["floor_id"].startswith("FLOOR_")
            assert "geometry_3d" in u
            assert "footprint_2d" in u
            assert "min_z" in u and "max_z" in u
            assert "area" in u and u["area"] > 0
            assert "volume" in u and u["volume"] > 0
            assert "centroid_xyz" in u and len(u["centroid_xyz"]) == 3

            # Geometry 3D structure
            g3d = u["geometry_3d"]
            assert g3d["is_watertight"] is True, f"Unit {u['unit_id']} 3D mesh must be watertight solid!"
            assert g3d["vertex_count"] >= 10, f"Unit {u['unit_id']} must have polygonal B-Rep vertices!"
            assert g3d["face_count"] >= 16
            assert Path(g3d["mesh_glb_path"]).exists(), "Physical per-unit 3D GLB file must be exported!"

            # Footprint 2D structure (Strictly not hardcoded 4-point boxes)
            poly = u["footprint_2d"]["polygon"]
            assert len(poly) >= 5, f"Unit {u['unit_id']} must be a real architectural polygon, not a simple 4-corner box!"

    # Verify Worker Integration
    worker_res = AI3DWorker.segment_units(survey_cloud_path=str(in_las))
    assert worker_res["status"] == "COMPLETED"
    assert worker_res["units_generated"] == manifest["total_units"]
    print("\n  --> AI3DWorker.segment_units: Verified OK!")

    print("\n--> STEP 27 VERIFICATION PASSED: AUTHENTIC 3D APARTMENT GEOMETRY SUCCESSFULLY BUILT!")


def test_step28_property_space_selection():
    print("\n" + SEP)
    print("TESTING STEP 28: CREATE 3D PROPERTY SPACE (SELECT APARTMENT A / UNIT 302)")
    print(SEP)

    client = TestClient(app)
    tmp = Path(tempfile.mkdtemp(prefix="naksha_step28_test_"))
    in_las = tmp / "survey_cloud.las"
    create_surveyed_building_cloud(in_las)

    # 1. Build via API
    r_build = client.post(
        "/api/v2/building/apartments/build",
        json={"survey_cloud_path": str(in_las)}
    )
    assert r_build.status_code == 200
    manifest = r_build.json()
    print(f"  POST /api/v2/building/apartments/build -> Status {r_build.status_code} ({manifest['total_units']} units built)")

    # 2. Query All Apartments
    r_all = client.get("/api/v2/building/apartments")
    assert r_all.status_code == 200
    assert r_all.json()["total_units"] == manifest["total_units"]
    print(f"  GET  /api/v2/building/apartments -> Status 200 (Total units: {r_all.json()['total_units']})")

    # 3. Step 28 Key Requirement: Select "Apartment A" (e.g. FLAT_A or UNIT_101)
    print("\nExecuting Selection: 'Apartment A' (FLAT A):")
    r_flat_a = client.get("/api/v2/building/apartments/FLAT_A")
    assert r_flat_a.status_code == 200
    apt_a = r_flat_a.json()["apartment"]

    print(f"  Selected Unit:         {apt_a['unit_name']} ({apt_a['unit_id']})")
    print(f"  Unit Type:             {apt_a['unit_type']}")
    print(f"  Floor:                 Floor {apt_a['floor_number']} ({apt_a['floor_label']})")
    print(f"  2D Footprint:")
    print(f"    - Polygon Vertices:  {apt_a['footprint_2d']['polygon']}")
    print(f"    - Area:              {apt_a['area']} m2")
    print(f"    - Perimeter:         {apt_a['footprint_2d']['perimeter_m']} m")
    print(f"    - SVG Path:          {apt_a['footprint_2d']['svg_path']}")
    print(f"  3D Volume:")
    print(f"    - Solid Volume:      {apt_a['volume']} m3")
    print(f"    - Clear Height:      {apt_a['clear_height_m']} m")
    print(f"    - Watertight B-Rep:  {apt_a['geometry_3d']['is_watertight']}")
    print(f"    - GLB File:          {apt_a['geometry_3d']['mesh_glb_path']}")
    print(f"  XYZ Coordinates:")
    print(f"    - Centroid:          {apt_a['centroid_xyz']}")
    print(f"    - Z Range:           {apt_a['min_z']} m .. {apt_a['max_z']} m")
    print(f"  Associated Parcel:")
    print(f"    - Parcel ID:         {apt_a['associated_parcel']['parcel_id']}")
    print(f"    - ULPIN:             {apt_a['associated_parcel']['ulpin']}")
    print(f"    - Land Share %:      {apt_a['associated_parcel']['undivided_land_share_pct']}%")
    print(f"  Associated Govt Record:")
    print(f"    - Record Type:       {apt_a['associated_government_record']['record_type']}")
    print(f"    - Document No:       {apt_a['associated_government_record']['document_number']}")
    print(f"    - Owner Name:        {apt_a['associated_government_record']['owner_name']}")
    print(f"    - CTS Number:        {apt_a['associated_government_record']['cts_number']}")
    print(f"    - Reg. Area:         {apt_a['associated_government_record']['registered_carpet_area_sqm']} m2")
    print(f"    - Status:            {apt_a['associated_government_record']['match_status']}")

    assert apt_a["unit_alias"] == "FLAT_A" or "FLAT_A" in apt_a["unit_id"] or apt_a["unit_alias"] == "Flat A"
    assert "footprint_2d" in apt_a and apt_a["footprint_2d"]["area_sqm"] > 0
    assert "geometry_3d" in apt_a and apt_a["geometry_3d"]["volume_m3"] > 0
    assert "centroid_xyz" in apt_a and len(apt_a["centroid_xyz"]) == 3
    assert "associated_parcel" in apt_a and apt_a["associated_parcel"]["ulpin"]
    assert "associated_government_record" in apt_a and apt_a["associated_government_record"]["owner_name"]

    # 4. Selection Check: Unit 302 (Benchmark Property Unit)
    print("\nExecuting Selection: 'Unit 302':")
    r_302 = client.get("/api/v2/building/apartments/302")
    assert r_302.status_code == 200
    u302 = r_302.json()["apartment"]
    print(f"  Selected Unit:         {u302['unit_name']} ({u302['unit_id']})")
    print(f"  Floor:                 Floor {u302['floor_number']}")
    print(f"  Owner:                 {u302['associated_government_record']['owner_name']}")
    print(f"  Centroid:              {u302['centroid_xyz']}")
    assert u302["unit_number"] == "302"
    assert u302["floor_number"] == 2 or u302["floor_number"] == 3

    print("\n--> STEP 28 VERIFICATION PASSED: 3D PROPERTY SPACE INTERACTIVE SELECTION CONFIRMED!")


if __name__ == "__main__":
    test_step27_apartment_geometry()
    test_step28_property_space_selection()
    print("\n" + SEP)
    print("STEP 27 & STEP 28 FULLY SATISFIED AND VERIFIED!")
    print(SEP)
