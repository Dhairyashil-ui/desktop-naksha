"""
Integration test for PHASE 2 — REAL SCANNING: STEP 8 — Replace the fake scanner.
Verifies the complete 10-stage physical verification pipeline on actual files stored on disk.
"""

import sys
import io
import json
import requests
from backend.database import engine
from sqlalchemy import text

BASE_URL = "http://127.0.0.1:8000"

def run_step8_verification():
    print("=================================================================")
    print("STEP 8 VERIFICATION: REAL 10-STAGE DATASET SCANNER PIPELINE")
    print("=================================================================")

    # 1. Health check
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("[OK] Server is ONLINE")

    # 2. Create a test project
    p_res = requests.post(f"{BASE_URL}/api/v2/projects", json={
        "title": "Real Scan Survey Zone 43N",
        "description": "Step 8 End-to-End Real Scanner Test",
        "location": "Pune Ring Road, Zone 43N",
        "survey_date": "2026-09-30",
        "status": "ACTIVE"
    })
    assert p_res.status_code == 200, f"Failed to create project: {p_res.text}"
    project_id = p_res.json()["project_id"]
    print(f"[OK] Created test project: {project_id}")

    # 3. Create real test files for photogrammetry:
    # - 3 valid JPEG images with SOI marker
    # - 1 camera calibration CSV
    # - 1 trajectory CSV
    soi_jpeg_header = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00" + (b"\x00" * 64) + b"\xff\xc0\x00\x11\x08\x04\x00\x04\x00\x03\x01\x11\x00\x02\x11\x01\x03\x11\x01" + b"\xff\xd9"
    camera_csv_content = b"camera_id,focal_length_mm,sensor_width_mm,sensor_height_mm,cx,cy\nFC6310R,8.8,13.2,8.8,6.6,4.4\n"
    traj_csv_content = b"point_id,easting,northing,elevation,timestamp\nP1,385420.5,2048930.2,560.1,1790692200\nP2,385450.8,2048980.5,560.4,1790692205\nP3,385490.2,2049020.1,560.3,1790692210\n"

    files_payload = [
        ("files", ("DJI_0001.JPG", io.BytesIO(soi_jpeg_header), "image/jpeg")),
        ("files", ("DJI_0002.JPG", io.BytesIO(soi_jpeg_header), "image/jpeg")),
        ("files", ("DJI_0003.JPG", io.BytesIO(soi_jpeg_header), "image/jpeg")),
        ("files", ("camera_calibration.csv", io.BytesIO(camera_csv_content), "text/csv")),
        ("files", ("trajectory_flight_log.csv", io.BytesIO(traj_csv_content), "text/csv")),
    ]

    upload_res = requests.post(
        f"{BASE_URL}/api/v2/datasets/upload",
        data={
            "project_id": project_id,
            "category_id": "CAT_01_PHOTOGRAMMETRY",
            "dataset_name": "Pune Highway Drone Survey Batch",
        },
        files=files_payload,
    )
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    ds_data = upload_res.json()
    dataset_id = ds_data["dataset_id"]
    print(f"[OK] Uploaded 5 physical files into dataset: {dataset_id}")

    # 4. Trigger Real 10-Stage Scanner Pipeline (POST)
    print("\n[+] Triggering real 10-stage scanner on physical files...")
    scan_res = requests.post(f"{BASE_URL}/api/v2/datasets/{dataset_id}/scan")
    assert scan_res.status_code == 200, f"Scanner failed: {scan_res.text}"
    scan_result = scan_res.json()

    # Validate 10 stages
    steps = scan_result.get("steps", [])
    assert len(steps) == 10, f"Expected exactly 10 pipeline steps, got {len(steps)}"
    expected_stages = [
        "UPLOADED_FILES",
        "FILE_SIGNATURE",
        "FORMAT_PARSER",
        "METADATA_EXTRACTION",
        "COORDINATE_CRS_DETECTION",
        "GEOMETRY_CHECKS",
        "DATASET_REQUIREMENTS",
        "QUALITY_CHECKS",
        "COMPLETENESS_CALCULATION",
        "FINAL_DATASET_STATUS"
    ]
    for idx, (step, expected_stage) in enumerate(zip(steps, expected_stages), 1):
        assert step["step_index"] == idx, f"Step index mismatch: {step['step_index']} != {idx}"
        assert step["stage"] == expected_stage, f"Stage mismatch: {step['stage']} != {expected_stage}"
        print(f"  Stage {idx:02d}: [{step['status'].upper()}] {step['name']:<25} | {step['detail']}")

    print(f"\n[OK] All 10 stages executed on actual files on disk.")
    print(f"    - Completeness Score : {scan_result['completeness']}%")
    print(f"    - Quality Score      : {scan_result['quality']}%")
    print(f"    - Ready For Pipeline : {scan_result['ready_for_processing']}")
    print(f"    - Detected CRS       : {scan_result.get('crs_detected')}")
    print(f"    - EPSG               : {scan_result.get('epsg')}")
    print(f"    - Status Verdict     : {scan_result['status']}")

    # 5. Test SSE Streaming endpoint
    print("\n[+] Testing SSE real-time stream endpoint (/scan/stream)...")
    stream_res = requests.get(f"{BASE_URL}/api/v2/datasets/{dataset_id}/scan/stream", stream=True)
    assert stream_res.status_code == 200, f"SSE stream failed: {stream_res.status_code}"

    streamed_steps = []
    stream_completed = False
    for line in stream_res.iter_lines():
        if line:
            decoded = line.decode("utf-8")
            if decoded.startswith("data: "):
                payload = json.loads(decoded[6:])
                if payload["type"] == "step":
                    streamed_steps.append(payload["data"])
                elif payload["type"] == "complete":
                    stream_completed = True

    assert len(streamed_steps) == 10, f"Expected 10 streamed steps, got {len(streamed_steps)}"
    assert stream_completed, "Expected stream complete event"
    print(f"[OK] SSE stream successfully delivered all 10 real-time stage events.")

    # 6. Verify Database Persistence in PostgreSQL
    print("\n[+] Verifying PostgreSQL persistence (input_datasets & validation_results)...")
    with engine.connect() as conn:
        ds_row = conn.execute(text("""
            SELECT completeness, quality, validation_status, status, readiness_score, epsg_detected
            FROM input_datasets
            WHERE id = :id;
        """), {"id": dataset_id}).fetchone()

        assert ds_row is not None, "Dataset row not found in input_datasets"
        assert ds_row[0] is not None and float(ds_row[0]) > 0, "Completeness not saved"
        assert ds_row[1] is not None and float(ds_row[1]) > 0, "Quality not saved"
        assert ds_row[2] in ("PASSED", "PARTIAL"), f"Unexpected validation_status: {ds_row[2]}"
        print(f"[OK] input_datasets updated: C={ds_row[0]}%, Q={ds_row[1]}%, status={ds_row[3]}, val_status={ds_row[2]}")

        val_row = conn.execute(text("""
            SELECT verdict, readiness_score, required_passed, required_checks, recommended_checks,
                   quality_metrics
            FROM validation_results
            WHERE dataset_id = :id
            ORDER BY evaluated_at DESC
            LIMIT 1;
        """), {"id": dataset_id}).fetchone()

        assert val_row is not None, "Row not found in validation_results"
        print(f"[OK] validation_results updated: verdict={val_row[0]}, readiness={val_row[1]}, passed={val_row[2]}")

    # 7. Test project-wide scanner endpoint
    print("\n[+] Testing project-wide scanning (/projects/{project_id}/scan)...")
    proj_scan_res = requests.post(f"{BASE_URL}/api/v2/projects/{project_id}/scan")
    assert proj_scan_res.status_code == 200, f"Project scan failed: {proj_scan_res.text}"
    proj_scan_data = proj_scan_res.json()
    assert proj_scan_data["scanned_count"] >= 1
    print(f"[OK] Project scan completed across {proj_scan_data['scanned_count']} dataset(s).")

    print("\n=================================================================")
    print("PHASE 2 / STEP 8: ALL SCANNER VERIFICATION CHECKS PASSED!")
    print("=================================================================")

if __name__ == "__main__":
    run_step8_verification()
