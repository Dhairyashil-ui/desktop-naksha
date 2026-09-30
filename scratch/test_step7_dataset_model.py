import os
import sys
import io
import json
import uuid
from pathlib import Path

sys.path.insert(0, ".")

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import engine
from sqlalchemy import text

client = TestClient(app)

def run_step7_tests():
    print("==================================================")
    print("STEP 7: REAL DATASET MODEL & GROUPING VALIDATION")
    print("==================================================")

    # 1. Fetch or create a test project
    proj_res = client.post("/api/v2/projects", json={
        "name": "Step7_Photogrammetry_Grouping_Project",
        "location": "Pune Haveli",
        "survey_date": "2026-09-30"
    })
    assert proj_res.status_code == 200, f"Project creation failed: {proj_res.text}"
    project_id = proj_res.json()["project_id"]
    print(f"[PASS] Project created for test: {project_id}")

    # 2. Test Photogrammetry Grouping:
    # Example from prompt:
    # Photogrammetry
    #  ├── IMG001.JPG
    #  ├── IMG002.JPG
    #  ├── IMG003.JPG
    #  ├── camera.csv
    #  └── trajectory.csv
    print("\n--- Testing Grouping: Uploading images to Photogrammetry ---")
    jpeg_header = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    img1 = jpeg_header + os.urandom(64) + b"\xff\xd9"
    img2 = jpeg_header + os.urandom(64) + b"\xff\xd9"
    img3 = jpeg_header + os.urandom(64) + b"\xff\xd9"

    files_batch1 = [
        ("files", ("IMG001.JPG", io.BytesIO(img1), "image/jpeg")),
        ("files", ("IMG002.JPG", io.BytesIO(img2), "image/jpeg")),
        ("files", ("IMG003.JPG", io.BytesIO(img3), "image/jpeg")),
    ]
    data1 = {
        "project_id": project_id,
        "category_id": "1",  # Photogrammetry
        "dataset_name": "UAV Aerial Photogrammetry Bundle"
    }

    res1 = client.post("/api/v2/datasets/upload", data=data1, files=files_batch1)
    assert res1.status_code == 200, f"Batch 1 upload failed: {res1.text}"
    body1 = res1.json()

    dataset_id = body1["dataset_id"]
    print(f"[PASS] Created Dataset ID: {dataset_id}")
    print(f"       Status: {body1.get('status')}")
    print(f"       Completeness: {body1.get('completeness')}%")
    print(f"       Quality: {body1.get('quality')}%")
    print(f"       Files in dataset: {body1.get('file_count')}")

    assert body1["file_count"] == 3
    assert len(body1["files"]) == 3
    assert body1["category"] == "CAT_01_PHOTOGRAMMETRY"

    # 3. Upload companion files: camera.csv and trajectory.csv to the SAME category
    print("\n--- Testing Grouping: Uploading camera.csv and trajectory.csv to same category ---")
    camera_csv = b"sensor_width_mm,sensor_height_mm,focal_length_mm,pixel_pitch_um\n35.9,24.0,28.0,4.4\n"
    trajectory_csv = b"timestamp,easting,northing,elevation_m,roll_deg,pitch_deg,yaw_deg\n1775030001,385100.12,2048900.54,420.5,0.12,-0.45,88.2\n"

    files_batch2 = [
        ("files", ("camera.csv", io.BytesIO(camera_csv), "text/csv")),
        ("files", ("trajectory.csv", io.BytesIO(trajectory_csv), "text/csv")),
    ]
    data2 = {
        "project_id": project_id,
        "category_id": "1",  # Same category
    }

    res2 = client.post("/api/v2/datasets/upload", data=data2, files=files_batch2)
    assert res2.status_code == 200, f"Batch 2 upload failed: {res2.text}"
    body2 = res2.json()

    # The dataset ID MUST be the same (grouped under the same dataset)!
    assert body2["dataset_id"] == dataset_id, f"Expected same dataset_id {dataset_id}, but got {body2['dataset_id']}"
    print(f"[PASS] Grouping confirmed! Both batches grouped into same dataset_id: {dataset_id}")

    # Now the dataset has all 5 files:
    # IMG001.JPG, IMG002.JPG, IMG003.JPG, camera.csv, trajectory.csv
    print(f"       Updated file_count: {body2.get('file_count')}")
    assert body2["file_count"] == 5, f"Expected 5 files in dataset, got {body2.get('file_count')}"
    print(f"       Updated completeness: {body2.get('completeness')}%")
    print(f"       Updated quality: {body2.get('quality')}%")
    print(f"       Validation status: {body2.get('validation_status')}")

    # Completeness increased because camera.csv and trajectory.csv are now present
    assert body2["completeness"] >= body1["completeness"]

    # 4. Verify GET /api/v2/datasets/{dataset_id}
    print("\n--- Testing GET /api/v2/datasets/{dataset_id} ---")
    res_get = client.get(f"/api/v2/datasets/{dataset_id}")
    assert res_get.status_code == 200, f"GET dataset failed: {res_get.text}"
    ds = res_get.json()

    # Verify all required properties:
    # - dataset_id
    # - project_id
    # - category
    # - status
    # - completeness
    # - quality
    # - metadata
    # - validation_status
    print("Checking dataset properties:")
    for prop in ["dataset_id", "project_id", "category", "status", "completeness", "quality", "metadata", "validation_status"]:
        assert prop in ds, f"Missing required property: {prop}"
        print(f"  - {prop}: {ds[prop]}")

    assert ds["dataset_id"] == dataset_id
    assert ds["project_id"] == project_id
    assert ds["category"] == "CAT_01_PHOTOGRAMMETRY"
    assert isinstance(ds["completeness"], (int, float))
    assert isinstance(ds["quality"], (int, float))
    assert isinstance(ds["metadata"], dict)
    assert len(ds["files"]) == 5

    # Check semantic file roles in the dataset
    roles = {f["filename"]: f.get("file_role") for f in ds["files"]}
    print("\nSemantic File Roles in Dataset:")
    for fn, role in sorted(roles.items()):
        print(f"  - {fn}: {role}")

    assert roles["camera.csv"] == "CAMERA_CALIBRATION", f"Expected CAMERA_CALIBRATION, got {roles['camera.csv']}"
    assert roles["trajectory.csv"] == "TRAJECTORY_DATA", f"Expected TRAJECTORY_DATA, got {roles['trajectory.csv']}"
    assert "AERIAL_IMAGE" in roles["IMG001.JPG"]

    # 5. Verify GET /api/v2/projects/{project_id}/datasets
    print("\n--- Testing GET /api/v2/projects/{project_id}/datasets ---")
    res_list = client.get(f"/api/v2/projects/{project_id}/datasets")
    assert res_list.status_code == 200
    list_body = res_list.json()
    assert list_body["count"] >= 1
    found_ds = next((d for d in list_body["datasets"] if d["dataset_id"] == dataset_id), None)
    assert found_ds is not None, "Created dataset not found in project datasets list"
    assert found_ds["file_count"] == 5
    assert len(found_ds["files"]) == 5
    print(f"[PASS] Project has {list_body['count']} dataset(s). Target dataset verified with 5 files.")

    # 6. Verify Database Relationships in PostgreSQL
    print("\n--- Testing Direct PostgreSQL Relationships ---")
    with engine.connect() as conn:
        # Check Project -> Dataset
        p_row = conn.execute(text("SELECT id, title FROM projects WHERE id = :id"), {"id": project_id}).fetchone()
        assert p_row is not None
        print(f"[PASS] Project in DB: {p_row[0]} ('{p_row[1]}')")

        # Check Dataset
        d_row = conn.execute(text("""
            SELECT id, project_id, category, status, completeness, quality, validation_status, file_count
            FROM input_datasets WHERE id = :id
        """), {"id": dataset_id}).fetchone()
        assert d_row is not None
        assert str(d_row[1]) == project_id
        assert d_row[2] == "CAT_01_PHOTOGRAMMETRY"
        print(f"[PASS] Dataset in DB: {d_row[0]} (completeness={d_row[4]}, quality={d_row[5]}, status={d_row[3]}, val_status={d_row[6]}, file_count={d_row[7]})")

        # Check Dataset Files
        f_rows = conn.execute(text("""
            SELECT id, file_name, file_role, size_bytes, sha256
            FROM dataset_files WHERE dataset_id = :id
            ORDER BY file_name
        """), {"id": dataset_id}).fetchall()
        assert len(f_rows) == 5, f"Expected 5 files in dataset_files, got {len(f_rows)}"
        print(f"[PASS] Dataset Files in DB: {len(f_rows)} files confirmed:")
        for fr in f_rows:
            print(f"       * {fr[1]} (Role: {fr[2]}, Size: {fr[3]} B, SHA256: {fr[4][:12]}...)")

    print("\n==================================================")
    print("ALL STEP 7 REQUIREMENTS VERIFIED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_step7_tests()
