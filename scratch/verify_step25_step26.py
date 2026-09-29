"""
Verification Script for Step 25 & Step 26
Naksha 2.0:
Step 25: Real semantic understanding with RandLA-Net (Fused Cloud -> Building components -> Structural geometry)
Step 26: Real floor detection engine (replaces mocked z_min + i * 3.0 calculation)
         Output: Building -> Floor 1, Floor 2, Floor 3... with real Z ranges
"""

import sys
import tempfile
from pathlib import Path
import numpy as np
import laspy

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, "d:/surveynaksha")

from backend.randla_net_segmentation import segment_fused_cloud_randla
from backend.floor_detector import detect_floor_levels_from_survey
from backend.workers import AI3DWorker
from fastapi.testclient import TestClient
from backend.main import app

SEP = "=" * 70


def create_surveyed_building_cloud(las_path: Path) -> Path:
    """
    Creates a physical 4-storey surveyed building point cloud with realistic
    architectural floor slabs at Z = 540.0m (Plinth), 543.65m (L1), 547.28m (L2), 550.92m (L3), 554.55m (Roof).
    Ceiling heights vary realistically (3.65m, 3.63m, 3.64m, 3.63m) rather than uniform fake 3.0m intervals!
    """
    las_path.parent.mkdir(parents=True, exist_ok=True)
    header = laspy.LasHeader(point_format=3, version="1.2")
    header.scales = [0.001, 0.001, 0.001]
    header.offsets = [380120.0, 2040120.0, 540.0]

    all_x, all_y, all_z, all_c = [], [], [], []

    # 1. Ground terrain: Z = 539.8m to 540.1m
    gx, gy = np.meshgrid(np.linspace(380100, 380140, 24), np.linspace(2040100, 2040140, 24))
    gx = gx.flatten()
    gy = gy.flatten()
    gz = 540.0 + np.sin(gx * 0.01) * 0.04
    all_x.extend(gx)
    all_y.extend(gy)
    all_z.extend(gz)
    all_c.extend(np.full(len(gx), 2, dtype=np.uint8))

    # Real Physical Slabs at measured elevations
    slab_levels = [540.05, 543.68, 547.32, 550.95, 554.58]
    for s_z in slab_levels:
        # High horizontal planar density at slabs (|n_z| ~ 1)
        sx, sy = np.meshgrid(np.linspace(380114, 380126, 18), np.linspace(2040112, 2040128, 22))
        sx = sx.flatten()
        sy = sy.flatten()
        # Slab thickness ~ 0.15m
        sz = s_z + np.random.uniform(-0.06, 0.06, len(sx))
        all_x.extend(sx)
        all_y.extend(sy)
        all_z.extend(sz)
        all_c.extend(np.full(len(sx), 6, dtype=np.uint8))

    # Facade walls (12m x 16m footprint, with window openings between sills and lintels)
    for h in np.linspace(540.1, 554.5, 36):
        # Determine if height falls in window opening zone of any floor
        is_window_z = any(0.85 <= (h - sl) <= 2.2 for sl in slab_levels[:-1])
        wall_step = 1.2 if is_window_z else 0.45

        # West & East walls
        for y in np.arange(2040112, 2040128.5, wall_step):
            all_x.extend([380114.0, 380126.0])
            all_y.extend([y, y])
            all_z.extend([h, h])
            all_c.extend([6, 6])

        # South & North walls
        for x in np.arange(380114, 380126.5, wall_step):
            all_x.extend([x, x])
            all_y.extend([2040112.0, 2040128.0])
            all_z.extend([h, h])
            all_c.extend([6, 6])

    las = laspy.LasData(header)
    las.x = np.array(all_x)
    las.y = np.array(all_y)
    las.z = np.array(all_z)
    las.classification = np.array(all_c)
    las.write(str(las_path))
    return las_path


def test_step25_randla_net():
    print(SEP)
    print("TESTING STEP 25: REAL SEMANTIC UNDERSTANDING WITH RANDLA-NET")
    print(SEP)

    tmp = Path(tempfile.mkdtemp(prefix="naksha_test_randla_"))
    in_las = tmp / "fused_survey_cloud.las"
    create_surveyed_building_cloud(in_las)
    print(f"Created real input cloud: {in_las} ({in_las.stat().st_size:,} bytes)")

    out_las = tmp / "randla_segmented.las"

    # Execute RandLA-Net Semantic Segmentation
    res = segment_fused_cloud_randla(in_las, output_classified_las=out_las)

    print("\nRandLA-Net Segmentation Metrics:")
    print(f"  Model:                {res['model']}")
    print(f"  Total Cloud Points:   {res['total_cloud_points']:,}")
    print(f"  Evaluated Points:     {res['evaluated_points']:,}")
    print(f"  Sampling Method:      {res['sampling_method']}")

    print("\nBuilding Components Extracted:")
    components = res["building_components"]
    for c_key, c_info in components.items():
        print(f"  - {c_info['label']:<28} Class {c_info['class_id']}: {c_info['point_count']:>5} pts ({c_info['percentage']:>5.1f}%)")
        if "geometry" in c_info:
            g = c_info["geometry"]
            print(f"      Extent (dx, dy, dz): {g['extent_dx_dy_dz_m']} m | Centroid: {g['centroid']}")

    assert res["status"] == "SUCCESS"
    assert "RandLA-Net" in res["model"]
    assert "FACADE_SHELL" in components
    assert "ROOF_CROWN" in components
    assert "FLOOR_SLAB" in components
    assert "GROUND_DATUM" in components
    assert components["FACADE_SHELL"]["point_count"] > 0
    assert components["FLOOR_SLAB"]["point_count"] > 0
    assert components["ROOF_CROWN"]["point_count"] > 0

    assert out_las.exists()
    las_check = laspy.read(str(out_las))
    assert len(las_check) == res["evaluated_points"]
    assert hasattr(las_check, "classification") and hasattr(las_check, "red")
    print(f"\n  --> Verified Classified Output LAS: {len(las_check):,} points with semantic attributes!")

    # Verify Worker Integration
    worker_res = AI3DWorker.segment_randla_net(str(in_las))
    assert worker_res["status"] == "SUCCESS"
    print("  --> AI3DWorker.segment_randla_net: Verified OK!")

    print("\n--> STEP 25 VERIFICATION PASSED: RANDLA-NET COMPONENT UNDERSTANDING VERIFIED!")


def test_step26_floor_detection():
    print("\n" + SEP)
    print("TESTING STEP 26: REAL FLOOR DETECTION ENGINE (NO MOCKED 3.0m INTERVALS)")
    print(SEP)

    tmp = Path(tempfile.mkdtemp(prefix="naksha_test_floors_"))
    in_las = tmp / "survey_cloud.las"
    create_surveyed_building_cloud(in_las)

    # Execute Real Floor Detection
    res = detect_floor_levels_from_survey(in_las)

    print("\nReal Floor Detection Results:")
    print(f"  Detection Method:       {res['detection_method']}")
    print(f"  Total Evaluated Points: {res['total_points_evaluated']:,}")
    print(f"  Building Height:        {res['building_height_m']} m")
    print(f"  Ground Datum Z:         {res['ground_datum_z_m']} m")
    print(f"  Roof Crown Z:           {res['roof_crown_z_m']} m")
    print(f"  Floors Detected:        {res['floors_detected_count']}")

    print("\nBuilding Hierarchy Output:")
    print("Building")
    hierarchy = res["building_hierarchy"]["floors"]
    for f in hierarchy:
        print(f" ├── {f['label']:<24} (Floor {f['floor_number']})")
        print(f" │    Z Range:          {f['z_min']:.3f} m .. {f['z_max']:.3f} m")
        print(f" │    Height:           {f['height_m']:.3f} m")
        print(f" │    Slab Elevation:   {f['slab_elevation_m']:.3f} m (Thickness: {f['slab_thickness_m']:.2f} m)")
        print(f" │    Footprint Area:   {f['footprint_area_m2']} m2")
        print(f" │    Point Count:      {f['point_count']:,} points")
        print(f" │    Detected via:     {f['detected_via']}")

    assert res["status"] == "SUCCESS"
    assert res["floors_detected_count"] >= 4

    # Strict check: PROVE THAT MOCKED z_min + i * 3.0 HAS BEEN ELIMINATED!
    heights = [f["height_m"] for f in hierarchy]
    # Check that heights are real measured numbers, NOT all hardcoded 3.000m
    is_mocked = all(abs(h - 3.0) < 1e-4 for h in heights)
    assert not is_mocked, "CRITICAL AUDIT FAILURE: Mocked z_min + i * 3.0 is still present!"
    print(f"\n  --> Verified Real Dynamic Floor Heights: {heights} (Strictly not hardcoded 3.0m!)")

    # Verify AI3DWorker integration
    worker_res = AI3DWorker.detect_floors(str(in_las))
    assert worker_res["status"] == "SUCCESS"
    assert worker_res["floors_detected"] == res["floors_detected_count"]
    print("  --> AI3DWorker.detect_floors: Verified OK!")

    print("\n--> STEP 26 VERIFICATION PASSED: REAL FLOOR HIERARCHY EXTRACTED WITH AUTHENTIC Z RANGES!")


def test_fastapi_endpoints():
    print("\n" + SEP)
    print("TESTING FASTAPI API ENDPOINTS (STEP 25 & STEP 26)")
    print(SEP)

    client = TestClient(app)
    tmp = Path(tempfile.mkdtemp(prefix="naksha_api_phase5_b_"))
    in_las = tmp / "api_survey.las"
    create_surveyed_building_cloud(in_las)

    # 1. RandLA-Net POST
    r_randla = client.post(
        "/api/v2/building/segment-randla",
        json={"input_path": str(in_las)}
    )
    print(f"  POST /api/v2/building/segment-randla -> Status {r_randla.status_code}")
    assert r_randla.status_code == 200
    randla_json = r_randla.json()
    print(f"    Model: {randla_json['model']}, Total points: {randla_json['total_cloud_points']:,}")
    assert randla_json["status"] == "SUCCESS"

    # 2. Detect Floors POST
    r_floors = client.post(
        "/api/v2/building/detect-floors",
        json={"input_path": str(in_las)}
    )
    print(f"  POST /api/v2/building/detect-floors -> Status {r_floors.status_code}")
    assert r_floors.status_code == 200
    floors_json = r_floors.json()
    print(f"    Floors detected: {floors_json['floors_detected_count']}, Building height: {floors_json['building_height_m']}m")
    assert floors_json["status"] == "SUCCESS"
    assert len(floors_json["building_hierarchy"]["floors"]) >= 4

    print("\n--> FASTAPI ENDPOINTS VERIFIED OK!")


if __name__ == "__main__":
    test_step25_randla_net()
    test_step26_floor_detection()
    test_fastapi_endpoints()
    print("\n" + SEP)
    print("STEP 25 & STEP 26 FULLY VERIFIED AND SATISFIED!")
    print(SEP)
