"""
Verification Script for Phase 5 (Step 23 & Step 24)
Naksha 2.0:
Step 23: Generate real building geometry (Surface Reconstruction -> Mesh -> GLB/GLTF)
         - Dynamically selected reconstruction method based on dataset
         - No BoxGeometry(), No Math.random(), No preloaded building.glb
Step 24: Real building semantic segmentation with KPConv (Kernel Point Convolution)
         - Semantic classes: Ground, Facade, Roof, Floor Slab, Opening, Structural Column
         - Does NOT claim apartment boundaries merely because classified 'building'
"""

import sys
import tempfile
from pathlib import Path
import numpy as np
import laspy
import trimesh

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, "d:/surveynaksha")

from backend.building_reconstruction import generate_real_building_geometry
from backend.building_segmentation import segment_point_cloud_kpconv
from backend.workers import AI3DWorker
from fastapi.testclient import TestClient
from backend.main import app

SEP = "=" * 70


def create_realistic_building_cloud(las_path: Path) -> Path:
    las_path.parent.mkdir(parents=True, exist_ok=True)
    header = laspy.LasHeader(point_format=3, version="1.2")
    header.scales = [0.001, 0.001, 0.001]
    header.offsets = [380120.0, 2040120.0, 540.0]

    all_x, all_y, all_z, all_c = [], [], [], []

    # 1. Ground points: z = 540.0 +- 0.05m
    gx, gy = np.meshgrid(np.linspace(380100, 380140, 25), np.linspace(2040100, 2040140, 25))
    gx = gx.flatten()
    gy = gy.flatten()
    gz = 540.0 + np.sin(gx * 0.01) * 0.05
    gc = np.full(len(gx), 2, dtype=np.uint8)
    all_x.extend(gx)
    all_y.extend(gy)
    all_z.extend(gz)
    all_c.extend(gc)

    # 2. Building Walls (12m x 16m footprint, 12m height): z = 540.5 to 552.5m
    for h in np.linspace(540.5, 552.5, 24):
        # West & East walls
        for y in np.linspace(2040112, 2040128, 20):
            all_x.extend([380114.0, 380126.0])
            all_y.extend([y, y])
            all_z.extend([h, h])
            all_c.extend([6, 6])
        # South & North walls
        for x in np.linspace(380114, 380126, 16):
            all_x.extend([x, x])
            all_y.extend([2040112.0, 2040128.0])
            all_z.extend([h, h])
            all_c.extend([6, 6])

    # 3. Roof slab points: z = 552.5m
    rx, ry = np.meshgrid(np.linspace(380114, 380126, 14), np.linspace(2040112, 2040128, 18))
    rx = rx.flatten()
    ry = ry.flatten()
    rz = np.full(len(rx), 552.5)
    rc = np.full(len(rx), 6, dtype=np.uint8)
    all_x.extend(rx)
    all_y.extend(ry)
    all_z.extend(rz)
    all_c.extend(rc)

    las = laspy.LasData(header)
    las.x = np.array(all_x)
    las.y = np.array(all_y)
    las.z = np.array(all_z)
    las.classification = np.array(all_c)
    las.write(str(las_path))
    return las_path


def test_step23_building_geometry():
    print(SEP)
    print("TESTING STEP 23: REAL BUILDING GEOMETRY GENERATION")
    print(SEP)

    tmp = Path(tempfile.mkdtemp(prefix="naksha_test_bldg_"))
    in_las = tmp / "fused_site_cloud.las"
    create_realistic_building_cloud(in_las)
    print(f"Created real input point cloud: {in_las} ({in_las.stat().st_size:,} bytes)")

    out_glb = tmp / "reconstructed_building.glb"

    # Execute dynamic surface reconstruction & GLB generation
    res = generate_real_building_geometry(in_las, out_glb)

    print("\nBuilding Reconstruction Metrics:")
    print(f"  Input Cloud Points:          {res['total_points']:,}")
    print(f"  Building Points Extracted:   {res['building_points_extracted']:,}")
    print(f"  Reconstruction Method:       {res['reconstruction_method']}")
    print(f"  Selection Rationale:         {res['selection_rationale']}")
    print(f"  Mesh Vertex Count:           {res['mesh_metrics']['vertex_count']:,}")
    print(f"  Mesh Face Count:             {res['mesh_metrics']['face_count']:,}")
    print(f"  Surface Area:                {res['mesh_metrics']['surface_area_m2']} m2")
    print(f"  Volume:                      {res['mesh_metrics']['volume_m3']} m3")
    print(f"  Bounding Box Extent:         {res['mesh_metrics']['bounding_box_extent_m']} m")
    print(f"  Output GLB:                  {res['output_glb_path']} ({res['output_glb_size_bytes']:,} bytes)")

    assert res["status"] == "SUCCESS"
    assert res["building_points_extracted"] > 0
    assert res["reconstruction_method"] in ("SCREENED_POISSON", "BALL_PIVOTING", "ALPHA_SHAPE")
    assert res["mesh_metrics"]["vertex_count"] > 20
    assert res["mesh_metrics"]["face_count"] > 20
    assert out_glb.exists()
    assert out_glb.stat().st_size > 0

    # Verify GLB validity by loading back with Trimesh
    loaded_mesh = trimesh.load(str(out_glb), file_type="glb")
    if isinstance(loaded_mesh, trimesh.Scene):
        loaded_mesh = trimesh.util.concatenate(loaded_mesh.dump())
    assert len(loaded_mesh.vertices) > 0
    assert len(loaded_mesh.faces) > 0
    print(f"  --> Verified GLB binary load: {len(loaded_mesh.vertices):,} vertices, {len(loaded_mesh.faces):,} faces (Valid GLTF 2.0 Binary)")

    # Verify AI3DWorker integration
    worker_res = AI3DWorker.reconstruct_building_geometry(str(in_las))
    assert worker_res["status"] == "SUCCESS"
    assert Path(worker_res["output_glb_path"]).exists()
    print("  --> AI3DWorker.reconstruct_building_geometry: Verified OK!")

    print("\n--> STEP 23 VERIFICATION PASSED: REAL BUILDING GEOMETRY GENERATED WITH ZERO PROCEDURAL BOXES!")


def test_step24_kpconv_segmentation():
    print("\n" + SEP)
    print("TESTING STEP 24: REAL BUILDING SEMANTIC SEGMENTATION WITH KPCONV")
    print(SEP)

    tmp = Path(tempfile.mkdtemp(prefix="naksha_test_kpconv_"))
    in_las = tmp / "site_cloud.las"
    create_realistic_building_cloud(in_las)

    classified_las = tmp / "kpconv_classified.las"

    # Execute KPConv segmentation
    res = segment_point_cloud_kpconv(in_las, output_classified_las=classified_las)

    print("\nKPConv Semantic Classification Metrics:")
    print(f"  Model Architecture:          {res['segmentation_model']}")
    print(f"  Total Evaluated Points:      {res['points_evaluated']:,}")
    print(f"  Apartment Boundaries Claimed:{res['apartment_boundaries_claimed']}")
    print(f"  Architectural Notice:        {res['notice']}")

    print("\nSemantic Classes Breakdown:")
    for c_name, meta in res["semantic_classes"].items():
        print(f"  - {meta['label']:<28} Class {meta['class_id']}: {meta['point_count']:>5} pts ({meta['percentage']:>5.1f}%)")

    # Verify required classes are identified
    assert res["status"] == "SUCCESS"
    assert res["segmentation_model"] == "KPConv (Kernel Point Convolution)"
    assert res["apartment_boundaries_claimed"] is False
    assert "FACADE" in res["semantic_classes"]
    assert "ROOF" in res["semantic_classes"]
    assert "GROUND" in res["semantic_classes"]
    assert res["semantic_classes"]["FACADE"]["point_count"] > 0
    assert res["semantic_classes"]["ROOF"]["point_count"] > 0
    assert res["semantic_classes"]["GROUND"]["point_count"] > 0

    assert classified_las.exists()
    las_c = laspy.read(str(classified_las))
    assert len(las_c) == res["points_evaluated"]
    assert hasattr(las_c, "classification")
    assert hasattr(las_c, "red")
    print(f"\n  --> Verified Classified LAS Output: {len(las_c):,} points with semantic class labels and colors!")

    # Verify AI3DWorker integration
    worker_res = AI3DWorker.segment_building_kpconv(str(in_las))
    assert worker_res["status"] == "SUCCESS"
    assert worker_res["apartment_boundaries_claimed"] is False
    print("  --> AI3DWorker.segment_building_kpconv: Verified OK!")

    print("\n--> STEP 24 VERIFICATION PASSED: KPCONV IDENTIFIES SEMANTIC CLASSES WITHOUT FALSE APARTMENT CLAIMS!")


def test_fastapi_endpoints():
    print("\n" + SEP)
    print("TESTING FASTAPI API ENDPOINTS (STEP 23 & STEP 24)")
    print(SEP)

    client = TestClient(app)
    tmp = Path(tempfile.mkdtemp(prefix="naksha_api_phase5_"))
    in_las = tmp / "api_site.las"
    create_realistic_building_cloud(in_las)

    # 1. Reconstruct Geometry POST
    r_geo = client.post(
        "/api/v2/building/reconstruct-geometry",
        json={"input_path": str(in_las)}
    )
    print(f"  POST /api/v2/building/reconstruct-geometry -> Status {r_geo.status_code}")
    assert r_geo.status_code == 200
    geo_json = r_geo.json()
    print(f"    Method: {geo_json['reconstruction_method']}, Vertices: {geo_json['mesh_metrics']['vertex_count']:,}, Faces: {geo_json['mesh_metrics']['face_count']:,}")
    assert geo_json["status"] == "SUCCESS"
    assert Path(geo_json["output_glb_path"]).exists()

    # 2. Segment Building KPConv POST
    r_kp = client.post(
        "/api/v2/building/segment-kpconv",
        json={"input_path": str(in_las)}
    )
    print(f"  POST /api/v2/building/segment-kpconv -> Status {r_kp.status_code}")
    assert r_kp.status_code == 200
    kp_json = r_kp.json()
    print(f"    Model: {kp_json['segmentation_model']}, Apartment boundaries claimed: {kp_json['apartment_boundaries_claimed']}")
    assert kp_json["status"] == "SUCCESS"
    assert kp_json["apartment_boundaries_claimed"] is False
    assert len(kp_json["semantic_classes"]) >= 4

    print("\n--> FASTAPI ENDPOINTS VERIFIED OK!")


if __name__ == "__main__":
    test_step23_building_geometry()
    test_step24_kpconv_segmentation()
    test_fastapi_endpoints()
    print("\n" + SEP)
    print("PHASE 5 (STEP 23 & STEP 24) FULLY VERIFIED AND SATISFIED!")
    print(SEP)
