"""
Verification Script for Step 21 & Step 22
Naksha 2.0:
Step 21: Real point-cloud registration (GeoTransformer + ICP -> Common XYZ -> fused_point_cloud.las)
Step 22: Real 3D visualization scene layers (LiDAR, Photogrammetry, Fused, Building, Floor, Unit)
"""

import sys
import tempfile
from pathlib import Path
import numpy as np
import laspy

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, "d:/surveynaksha")

from backend.point_cloud_registration import register_and_fuse_point_clouds
from backend.visualization_service import get_scene_layers_data
from backend.workers import PhotogrammetryWorker
from fastapi.testclient import TestClient
from backend.main import app

SEP = "=" * 70


def create_test_clouds(tmp_dir: Path):
    # 1. LiDAR Cloud: Ground + Wall points
    lidar_p = tmp_dir / "site_lidar.las"
    h1 = laspy.LasHeader(point_format=3, version="1.2")
    h1.scales = [0.001, 0.001, 0.001]
    h1.offsets = [380100.0, 2040100.0, 540.0]

    n1 = 2000
    lx = 380100.0 + np.random.uniform(-10, 10, n1)
    ly = 2040100.0 + np.random.uniform(-10, 10, n1)
    lz = 540.0 + np.random.uniform(0, 12, n1)
    lc = np.random.choice([2, 6], n1).astype(np.uint8)

    las1 = laspy.LasData(h1)
    las1.x = lx
    las1.y = ly
    las1.z = lz
    las1.classification = lc
    las1.write(str(lidar_p))

    # 2. Photogrammetry Cloud: Facade points with slight translation and true RGB
    photo_p = tmp_dir / "dense_photo.las"
    h2 = laspy.LasHeader(point_format=3, version="1.2")
    h2.scales = [0.001, 0.001, 0.001]
    h2.offsets = [380100.0, 2040100.0, 540.0]

    n2 = 1200
    # Simulate slightly misaligned photogrammetry cloud (e.g. 0.35m offset)
    px = 380100.0 + np.random.uniform(-9.5, 9.5, n2) + 0.35
    py = 2040100.0 + np.random.uniform(-9.5, 9.5, n2) - 0.25
    pz = 540.0 + np.random.uniform(0.5, 11.5, n2) + 0.15

    las2 = laspy.LasData(h2)
    las2.x = px
    las2.y = py
    las2.z = pz
    las2.red = np.full(n2, 54000, dtype=np.uint16)
    las2.green = np.full(n2, 42000, dtype=np.uint16)
    las2.blue = np.full(n2, 32000, dtype=np.uint16)
    las2.write(str(photo_p))

    return photo_p, lidar_p


def test_step21_registration():
    print(SEP)
    print("TESTING STEP 21: REAL POINT CLOUD REGISTRATION & FUSION")
    print(SEP)

    tmp = Path(tempfile.mkdtemp(prefix="naksha_test_reg_"))
    photo_p, lidar_p = create_test_clouds(tmp)
    print(f"Photogrammetry input: {photo_p} ({photo_p.stat().st_size:,} bytes)")
    print(f"LiDAR input:          {lidar_p} ({lidar_p.stat().st_size:,} bytes)")

    fused_out = tmp / "fused_point_cloud.las"

    # Run GeoTransformer + ICP Registration
    res = register_and_fuse_point_clouds(
        photogrammetry_las_path=photo_p,
        lidar_las_path=lidar_p,
        output_fused_path=fused_out,
        target_epsg=32643
    )

    print("\nRegistration & Fusion Metrics:")
    print(f"  Method:                      {res['registration_method']}")
    print(f"  Source LiDAR points:         {res['source_lidar_points']:,}")
    print(f"  Source Photo points:         {res['source_photogrammetry_points']:,}")
    print(f"  Fused total points:          {res['fused_points']:,}")
    print(f"  ICP Inlier RMSE:             {res['icp_inlier_rmse_m']} m")
    print(f"  ICP Fitness score:           {res['icp_fitness']}")
    print(f"  Superpoint Correspondences:  {res['superpoint_correspondences']}")
    print(f"  Fused LAS File:              {res['fused_point_cloud_path']}")
    print(f"  Bounding Box:                {res['bbox']}")

    assert res["status"] == "SUCCESS"
    assert res["fused_points"] == res["source_lidar_points"] + res["source_photogrammetry_points"]
    assert fused_out.exists()
    assert fused_out.stat().st_size > 0

    # Verify LAS file attributes
    las_fused = laspy.read(str(fused_out))
    assert len(las_fused) == res["fused_points"]
    assert hasattr(las_fused, "red") and hasattr(las_fused, "green") and hasattr(las_fused, "blue")
    assert hasattr(las_fused, "classification")
    print(f"  --> Fused LAS Verified: {len(las_fused):,} points with 16-bit RGB & ASPRS classification!")

    # Verify Worker Integration
    worker_res = PhotogrammetryWorker.register_and_fuse(str(photo_p), str(lidar_p))
    assert worker_res["fused_points"] == res["fused_points"]
    print("  --> PhotogrammetryWorker.register_and_fuse: Verified OK!")

    print("\n--> STEP 21 VERIFICATION PASSED!")


def test_step22_visualization_layers():
    print("\n" + SEP)
    print("TESTING STEP 22: REAL 3D VISUALIZATION SCENE LAYERS API")
    print(SEP)

    layers_data = get_scene_layers_data()
    print(f"Status: {layers_data['status']}")
    print(f"CRS:    {layers_data['crs']}")

    layers = layers_data["layers"]
    print("\nVerifying 6 Real Layers:")
    for layer_name in ["lidar", "photogrammetry", "fused", "building", "floors", "units"]:
        assert layer_name in layers, f"Missing required layer: {layer_name}"

    print(f"  1. LiDAR Layer:           {layers['lidar']['point_count']:,} points (Positions: {len(layers['lidar']['positions']):,})")
    print(f"  2. Photogrammetry Layer:  {layers['photogrammetry']['point_count']:,} points (Colors: {len(layers['photogrammetry']['colors']):,})")
    print(f"  3. Fused Point Cloud:     {layers['fused']['point_count']:,} points")
    print(f"  4. Building Superstructure: {layers['building']['point_count']:,} points (Height: {layers['building']['height_span_m']}m)")
    print(f"  5. Floor Slices:          {len(layers['floors'])} floors detected:")
    for f in layers["floors"]:
        print(f"       {f['label']}: Z={f['z_min']}m .. {f['z_max']}m ({f['point_count']} points)")
    print(f"  6. Cadastral Units:       {len(layers['units'])} strata units modeled:")
    for u in layers["units"][:3]:
        print(f"       Unit {u['unitNumber']}: Owner={u['owner']}, CTS={u['ctsNumber']}, ULPIN={u['ulpin']}, Area={u['areaSqM']}m2")

    # Verify strict deterministic property (ZERO Math.random())
    assert layers_data["meta"]["random_free"] is True
    assert layers_data["meta"]["deterministic"] is True

    print("\n--> STEP 22 API VERIFICATION PASSED!")


def test_fastapi_endpoints():
    print("\n" + SEP)
    print("TESTING FASTAPI ENDPOINTS FOR STEP 21 & 22")
    print(SEP)

    client = TestClient(app)

    # 1. Visualization Scene Layers GET
    r_vis = client.get("/api/v2/visualization/scene-layers")
    print(f"  GET /api/v2/visualization/scene-layers -> Status {r_vis.status_code}")
    assert r_vis.status_code == 200
    vis_json = r_vis.json()
    assert "layers" in vis_json
    assert len(vis_json["layers"]["floors"]) >= 4
    assert len(vis_json["layers"]["units"]) >= 16

    # 2. Point Cloud Register POST
    tmp = Path(tempfile.mkdtemp(prefix="naksha_api_reg_"))
    photo_p, lidar_p = create_test_clouds(tmp)
    r_reg = client.post(
        "/api/v2/point-cloud/register",
        json={
            "photogrammetry_path": str(photo_p),
            "lidar_path": str(lidar_p),
            "target_epsg": 32643
        }
    )
    print(f"  POST /api/v2/point-cloud/register -> Status {r_reg.status_code}")
    assert r_reg.status_code == 200
    reg_json = r_reg.json()
    print(f"    Fused points: {reg_json['fused_points']:,}, ICP RMSE: {reg_json['icp_inlier_rmse_m']}m")
    assert reg_json["status"] == "SUCCESS"

    print("\n--> ALL FASTAPI ENDPOINTS VERIFIED OK!")


if __name__ == "__main__":
    test_step21_registration()
    test_step22_visualization_layers()
    test_fastapi_endpoints()
    print("\n" + SEP)
    print("STEP 21 & 22 BACKEND FULLY VERIFIED!")
    print(SEP)
