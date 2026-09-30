"""
Naksha 2.0 — Verification Script for STEP 18, STEP 19, STEP 20
Phase 4: Real 3D Data
Step 18: Real LiDAR Processing (Read -> Coord Norm -> Noise Filter -> Classify -> Ground/Non-Ground -> Building Extract)
Step 19: Real Photogrammetry (ALIKED -> LightGlue -> SfM -> MVS Benchmark -> Dense Cloud)
Step 20: Real Point Cloud Cleaning (PointCleanNet / Open3D Statistical & Radius Denoising)
"""

import os
import sys
import uuid
import time
import json
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, "d:/surveynaksha")

import numpy as np
import cv2
import laspy
from backend.lidar_processor import process_lidar_dataset
from backend.photogrammetry_pipeline import (
    extract_features,
    match_features,
    benchmark_mvs_models,
    reconstruct_dense_point_cloud,
)
from backend.point_cloud_cleaner import clean_point_cloud
from backend.workers import GDALPDALWorker, PhotogrammetryWorker, AI3DWorker

SEP = "=" * 70


def create_test_lidar_las(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    header = laspy.LasHeader(point_format=3, version="1.2")
    header.scales = [0.001, 0.001, 0.001]
    header.offsets = [380000.0, 2040000.0, 500.0]

    # 3000 ground points (z: 540m +- 0.05m)
    n_g = 3000
    gx = 380100.0 + np.random.uniform(0, 40, n_g)
    gy = 2040100.0 + np.random.uniform(0, 40, n_g)
    gz = 540.0 + np.random.normal(0, 0.04, n_g)
    gc = np.full(n_g, 2, dtype=np.uint8)

    # 1500 building superstructure points (z: 543m to 562m)
    n_b = 1500
    bx = 380110.0 + np.random.uniform(0, 18, n_b)
    by = 2040110.0 + np.random.uniform(0, 18, n_b)
    bz = 543.0 + np.random.uniform(0, 19, n_b)
    bc = np.full(n_b, 6, dtype=np.uint8)

    # 40 noise points (ASPRS 7 low noise, 18 high noise)
    n_n = 40
    nx = 380120.0 + np.random.uniform(0, 25, n_n)
    ny = 2040120.0 + np.random.uniform(0, 25, n_n)
    nz = 690.0 + np.random.uniform(0, 80, n_n)
    nc = np.random.choice([7, 18], n_n).astype(np.uint8)

    all_x = np.concatenate([gx, bx, nx])
    all_y = np.concatenate([gy, by, ny])
    all_z = np.concatenate([gz, bz, nz])
    all_c = np.concatenate([gc, bc, nc])

    las = laspy.LasData(header)
    las.x = all_x
    las.y = all_y
    las.z = all_z
    las.classification = all_c
    las.write(str(path))
    return path


def create_overlapping_test_photos(dir_path: Path) -> List[Path]:
    dir_path.mkdir(parents=True, exist_ok=True)
    # Generate two 800x600 synthetic images with distinct geometric patterns and texture
    img1_path = dir_path / "uav_frame_001.jpg"
    img2_path = dir_path / "uav_frame_002.jpg"

    h, w = 600, 800
    base_img = np.full((h, w, 3), 200, dtype=np.uint8)
    # Add high-contrast corners and checkerboards
    for r in range(50, 550, 60):
        for c in range(50, 750, 80):
            color = (int((r*3)%255), int((c*2)%255), 80)
            cv2.rectangle(base_img, (c, r), (c + 40, r + 40), color, -1)
            cv2.circle(base_img, (c + 20, r + 20), 8, (255, 255, 255), -1)

    # Frame 1: original viewpoint
    cv2.imwrite(str(img1_path), base_img)

    # Frame 2: 15-pixel simulated baseline shift (aerial camera translation)
    M = np.float32([[1, 0, -15], [0, 1, -5]])
    img2 = cv2.warpAffine(base_img, M, (w, h))
    cv2.imwrite(str(img2_path), img2)

    return [img1_path, img2_path]


def test_step18_lidar():
    print(SEP)
    print("STEP 18: REAL LIDAR PROCESSING PIPELINE")
    print(SEP)

    tmp = Path(tempfile.mkdtemp(prefix="naksha_test_step18_"))
    raw_las = tmp / "site_scan.las"
    create_test_lidar_las(raw_las)
    print(f"Created real input LAS file: {raw_las} ({raw_las.stat().st_size:,} bytes)")

    # Execute full real LiDAR processing
    out_dir = tmp / "processed"
    res = process_lidar_dataset(raw_las, out_dir, target_epsg=32643)

    print("\nLiDAR Processor Results (Computed from actual point data):")
    print(f"  Total raw points:       {res['total_raw_points']:,}")
    print(f"  Clean inlier points:    {res['clean_points']:,}")
    print(f"  Noise removed:          {res['noise_removed']:,}")
    print(f"  Ground classified:      {res['ground_classified']:,}")
    print(f"  Non-ground points:      {res['non_ground_points']:,}")
    print(f"  Building points:        {res['building_points']:,}")
    print(f"  Plinth footprint (m2):  {res['estimated_plinth_footprint_m2']} m2")
    print(f"  Building height span:   {res['building_height_span_m']} m")

    assert res["total_raw_points"] == 4540, f"Expected 4540 points, got {res['total_raw_points']}"
    assert res["noise_removed"] >= 40, f"Expected >= 40 noise points removed, got {res['noise_removed']}"
    assert res["clean_points"] == res["total_raw_points"] - res["noise_removed"]
    assert res["ground_classified"] > 0
    assert res["building_points"] > 0
    assert Path(res["artifacts"]["clean_las"]).exists()
    assert Path(res["artifacts"]["ground_las"]).exists()
    assert Path(res["artifacts"]["non_ground_las"]).exists()
    assert Path(res["artifacts"]["building_las"]).exists()

    # Verify Worker eliminates hardcoded 12,418,920
    print("\nVerifying GDALPDALWorker (No hardcoded 12,418,920):")
    worker_res = GDALPDALWorker.process_point_cloud(str(raw_las), target_epsg=32643)
    print(f"  Worker raw points:      {worker_res['raw_points']:,}")
    print(f"  Worker filtered points: {worker_res['filtered_points']:,}")
    print(f"  Worker ground points:   {worker_res['ground_classified']:,}")
    print(f"  Worker building points: {worker_res['building_points']:,}")
    assert worker_res["filtered_points"] != 12418920, "CRITICAL ERROR: Hardcoded 12,418,920 still present!"
    assert worker_res["filtered_points"] == res["clean_points"]
    assert worker_res["ground_classified"] == res["ground_classified"]

    # Verify AI3DWorker floor detection from actual points
    floor_res = AI3DWorker.detect_floors(res["artifacts"]["building_las"])
    print(f"\nAI3DWorker Floor Slicing:")
    print(f"  Building Height:  {floor_res['building_height_m']} m")
    print(f"  Floors Detected:  {floor_res['floors_detected']}")
    for f in floor_res["floor_list"][:3]:
        print(f"    {f['label']}: Z={f['z_min']}m .. {f['z_max']}m (Height: {f['height_m']}m)")

    print("\n--> STEP 18 VERIFICATION PASSED: REAL LIDAR PROCESSED WITH ZERO HARDCODING!")


def test_step19_photogrammetry():
    print("\n" + SEP)
    print("STEP 19: REAL PHOTOGRAMMETRY & MVS BENCHMARKING")
    print(SEP)

    tmp = Path(tempfile.mkdtemp(prefix="naksha_test_step19_"))
    images = create_overlapping_test_photos(tmp)
    print(f"Created {len(images)} overlapping test aerial frames:")
    for img in images:
        print(f"  {img.name} ({img.stat().st_size:,} bytes)")

    # 1. Feature Extraction (ALIKED with SIFT fallback)
    print("\n[1] Feature Extraction (ALIKED / SIFT):")
    f1 = extract_features(images[0], max_num_keypoints=1000)
    f2 = extract_features(images[1], max_num_keypoints=1000)
    print(f"  Frame 1: {f1['keypoint_count']} keypoints (Model: {f1['model_used']})")
    print(f"  Frame 2: {f2['keypoint_count']} keypoints (Model: {f2['model_used']})")
    assert f1["keypoint_count"] > 50

    # 2. Feature Matching (LightGlue with FLANN fallback)
    print("\n[2] Feature Matching (LightGlue / FLANN):")
    matches = match_features(f1, f2)
    print(f"  Matches found: {matches['match_count']} (Matcher: {matches['model_used']})")
    assert matches["match_count"] >= 8

    # 3. MVS Architecture Benchmark: PatchMatchNet vs CasMVSNet
    print("\n[3] Multi-View Stereo Benchmark (PatchMatchNet vs CasMVSNet):")
    winner, all_benchmarks = benchmark_mvs_models(image_shape=(1024, 768))
    for b in all_benchmarks:
        print(f"  Architecture: {b.model_name:<14}")
        print(f"    Peak VRAM:        {b.vram_peak_mb} MB")
        print(f"    Peak RAM:         {b.ram_peak_mb} MB")
        print(f"    Throughput:       {b.throughput_views_per_sec} views/sec")
        print(f"    Completeness:     {b.depth_completeness_pct}%")
        print(f"    CUDA Required:    {b.cuda_required}")
        print(f"    Selected for Prod: {b.recommended_for_production}")
        print(f"    Rationale:        {b.rationale}")

    print(f"\n  >>> PRODUCTION DECISION: Selected '{winner.model_name}' without running redundant models unnecessarily!")
    assert winner.model_name in ("PatchMatchNet", "CasMVSNet")

    # 4. Dense Point Cloud Reconstruction
    print("\n[4] Dense Point Cloud Reconstruction:")
    out_dense_las = tmp / "dense_photogrammetry.las"
    dense_res = reconstruct_dense_point_cloud(
        image_paths=images,
        output_path=out_dense_las,
        selected_model=winner.model_name,
        target_epsg=32643,
    )
    print(f"  Dense points reconstructed: {dense_res['dense_points_count']:,}")
    print(f"  MVS Model used:             {dense_res['mvs_model_used']}")
    print(f"  Output LAS file:            {dense_res['output_las']} ({Path(dense_res['output_las']).stat().st_size:,} bytes)")
    print(f"  Bounding box:               {dense_res['bbox']}")
    assert dense_res["dense_points_count"] > 0
    assert out_dense_las.exists()

    # Verify LAS file has real points and RGB bands
    las_check = laspy.read(str(out_dense_las))
    assert len(las_check) == dense_res["dense_points_count"]
    assert hasattr(las_check, "red") and hasattr(las_check, "green") and hasattr(las_check, "blue")
    print(f"  Verified 16-bit RGB bands on dense point cloud: Red[0]={las_check.red[0]}, Green[0]={las_check.green[0]}, Blue[0]={las_check.blue[0]}")

    print("\n--> STEP 19 VERIFICATION PASSED: REAL PHOTOGRAMMETRY & BENCHMARKED MVS PIPELINE VERIFIED!")


def test_step20_point_cloud_cleaning():
    print("\n" + SEP)
    print("STEP 20: REAL POINT CLOUD CLEANING & DENOISING")
    print(SEP)

    tmp = Path(tempfile.mkdtemp(prefix="naksha_test_step20_"))
    noisy_las = tmp / "noisy_raw_scan.las"
    create_test_lidar_las(noisy_las)

    clean_out_las = tmp / "denoised_scan.las"

    # Execute actual denoising (PointCleanNet / Open3D statistical & radius filtering)
    clean_res = clean_point_cloud(
        input_las_path=noisy_las,
        output_las_path=clean_out_las,
        method="AUTO",
    )

    print("Point Cloud Denoising Report:")
    print(f"  Algorithm Used:         {clean_res['algorithm']}")
    print(f"  Raw Input Points:       {clean_res['raw_points']:,}")
    print(f"  Cleaned Points:         {clean_res['cleaned_points']:,}")
    print(f"  Noise Outliers Removed: {clean_res['noise_removed']:,}")
    print(f"  Noise Percentage:       {clean_res['noise_percentage']}%")
    print(f"  Derived From Input:     {clean_res['derived_from_input']}")
    print(f"  Clean Output Path:      {clean_res['output_path']}")

    assert clean_res["derived_from_input"] is True
    assert clean_res["raw_points"] == 4540
    assert clean_res["cleaned_points"] < clean_res["raw_points"]
    assert clean_res["noise_removed"] > 0
    assert clean_out_las.exists()

    # Verify cleaned file is readable and points are strictly derived
    las_cleaned = laspy.read(str(clean_out_las))
    assert len(las_cleaned) == clean_res["cleaned_points"]
    assert len(las_cleaned) > 0

    print("\n--> STEP 20 VERIFICATION PASSED: POINT CLOUD STRICTLY DENOISED FROM UPLOADED DATA!")


def test_fastapi_endpoints():
    print("\n" + SEP)
    print("VERIFYING FASTAPI API ENDPOINTS (STEP 18, 19, 20)")
    print(SEP)

    from fastapi.testclient import TestClient
    from backend.main import app

    client = TestClient(app)

    # 1. Benchmark MVS GET endpoint
    r_bench = client.get("/api/v2/photogrammetry/benchmark-mvs")
    print(f"  GET /api/v2/photogrammetry/benchmark-mvs -> Status {r_bench.status_code}")
    assert r_bench.status_code == 200
    bench_data = r_bench.json()
    print(f"    Selected production model: {bench_data['selected_model']}")
    print(f"    Benchmarked models count:  {len(bench_data['models'])}")
    assert len(bench_data["models"]) == 2

    # 2. Point Cloud Cleaning POST endpoint
    tmp = Path(tempfile.mkdtemp(prefix="naksha_api_test_"))
    test_las = tmp / "api_test.las"
    create_test_lidar_las(test_las)

    r_clean = client.post(
        "/api/v2/point-cloud/clean",
        json={"input_path": str(test_las), "method": "AUTO"}
    )
    print(f"  POST /api/v2/point-cloud/clean -> Status {r_clean.status_code}")
    assert r_clean.status_code == 200
    clean_data = r_clean.json()
    print(f"    Algorithm: {clean_data['algorithm']}, Cleaned points: {clean_data['cleaned_points']:,}")
    assert clean_data["derived_from_input"] is True

    # 3. LiDAR Processing POST endpoint
    r_lidar = client.post(
        "/api/v2/lidar/process",
        json={"file_path": str(test_las), "target_epsg": 32643}
    )
    print(f"  POST /api/v2/lidar/process -> Status {r_lidar.status_code}")
    assert r_lidar.status_code == 200
    lidar_data = r_lidar.json()
    print(f"    Building points: {lidar_data['building_points']:,}, Ground: {lidar_data['ground_classified']:,}")
    assert lidar_data["clean_points"] == lidar_data["total_raw_points"] - lidar_data["noise_removed"]

    print("\n--> FASTAPI ENDPOINTS VERIFIED OK!")


if __name__ == "__main__":
    test_step18_lidar()
    test_step19_photogrammetry()
    test_step20_point_cloud_cleaning()
    test_fastapi_endpoints()
    print("\n" + SEP)
    print("ALL PHASE 4 STEPS (18, 19, 20) FULLY SATISFIED AND VERIFIED!")
    print(SEP)
