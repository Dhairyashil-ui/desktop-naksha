import os
import sys
import io
import json
import hashlib
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, ".")

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import engine
from sqlalchemy import text

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("STEP 5: REAL FILE UPLOAD ENDPOINT VALIDATION SUITE")
    print("==================================================")

    # 1. Fetch an existing project ID from database
    with engine.connect() as conn:
        proj = conn.execute(text("SELECT id, title FROM projects ORDER BY created_at DESC LIMIT 1;")).fetchone()
        assert proj is not None, "No project found in database!"
        project_id = str(proj[0])
        print(f"Testing with Project ID: {project_id} ('{proj[1]}')")

    # 2. Test 1: Upload a real valid LAS point cloud file (LiDAR / Point Cloud - Category 2)
    # LAS header requires 'LASF' magic bytes
    nonce = os.urandom(16)
    las_content = b"LASF\x01\x04" + nonce + (b"\x00" * 354)  # minimal valid LAS 1.4 header bytes
    las_sha256 = hashlib.sha256(las_content).hexdigest()

    print("\n--- Test 1: Upload real LiDAR LAS file (Category '2') ---")
    files = {
        "files": ("drone_scan_01.las", io.BytesIO(las_content), "application/octet-stream")
    }
    data = {
        "project_id": project_id,
        "category_id": "2",  # numeric category 2
        "dataset_name": "Test LiDAR Survey Batch 1"
    }

    res = client.post("/api/v2/datasets/upload", data=data, files=files)
    print(f"Status Code: {res.status_code}")
    assert res.status_code == 200, f"Upload failed: {res.text}"
    body = res.json()
    print("Response keys:", list(body.keys()))

    # Verify all required return fields
    assert "file_id" in body, "Missing file_id"
    assert "dataset_id" in body, "Missing dataset_id"
    assert "filename" in body, "Missing filename"
    assert "size" in body, "Missing size"
    assert "SHA256" in body, "Missing SHA256"
    assert "category" in body, "Missing category"
    assert "storage location" in body, "Missing storage location"
    assert "upload status" in body, "Missing upload status"

    assert body["filename"] == "drone_scan_01.las"
    assert body["size"] == len(las_content)
    assert body["SHA256"] == las_sha256
    assert body["category"] == "CAT_02_LIDAR_POINT_CLOUD"
    assert body["upload status"] == "UPLOADED"
    print(f" [PASS] Returned file_id: {body['file_id']}")
    print(f" [PASS] Category normalized: {body['category']}")
    print(f" [PASS] SHA256 matches: {body['SHA256']}")
    print(f" [PASS] Storage location: {body['storage location']}")

    # Verify physical file persistence on disk
    storage_path = Path(body["storage location"])
    assert storage_path.exists(), f"Physical file does NOT exist at: {storage_path}"
    assert storage_path.stat().st_size == len(las_content)
    with open(storage_path, "rb") as f:
        disk_bytes = f.read()
    assert disk_bytes == las_content, "Disk bytes do not match uploaded bytes!"
    print(f" [PASS] Physical file exists on disk with exact bytes ({len(disk_bytes)} bytes)")

    # Verify database persistence in PostgreSQL
    dataset_id = body["dataset_id"]
    file_id = body["file_id"]
    with engine.connect() as conn:
        ds_row = conn.execute(text("SELECT id, name, category, total_size_bytes FROM input_datasets WHERE id = :id"), {"id": dataset_id}).fetchone()
        assert ds_row is not None, "input_datasets row missing in DB"
        assert ds_row[2] == "CAT_02_LIDAR_POINT_CLOUD"
        print(f" [PASS] Database input_datasets record confirmed: ID={ds_row[0]}, Category={ds_row[2]}")

        f_row = conn.execute(text("SELECT id, file_name, size_bytes, sha256 FROM dataset_files WHERE id = :id"), {"id": file_id}).fetchone()
        assert f_row is not None, "dataset_files row missing in DB"
        assert f_row[1] == "drone_scan_01.las"
        assert f_row[2] == len(las_content)
        assert f_row[3].strip() == las_sha256
        print(f" [PASS] Database dataset_files record confirmed: ID={f_row[0]}, SHA256={f_row[3].strip()}")

    # 3. Test 2: Duplicate Detection
    print("\n--- Test 2: Upload duplicate file (same SHA256) ---")
    files_dup = {
        "files": ("drone_scan_01_copy.las", io.BytesIO(las_content), "application/octet-stream")
    }
    data_dup = {
        "project_id": project_id,
        "category_id": "2",
        "dataset_name": "Test LiDAR Batch Duplicate"
    }
    res_dup = client.post("/api/v2/datasets/upload", data=data_dup, files=files_dup)
    assert res_dup.status_code == 200, f"Duplicate upload failed: {res_dup.text}"
    body_dup = res_dup.json()
    assert body_dup["upload status"] == "DUPLICATE", f"Expected DUPLICATE but got {body_dup['upload status']}"
    print(f" [PASS] Duplicate detected: upload status = {body_dup['upload status']}")

    # 4. Test 3: Filename sanitization against directory traversal
    print("\n--- Test 3: Filename Sanitization ---")
    jpeg_content = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + (b"\x00" * 64) + b"\xff\xd9"
    files_trav = {
        "files": ("../../unsafe/dir/survey_ortho<>:\"|?*.jpg", io.BytesIO(jpeg_content), "image/jpeg")
    }
    data_trav = {
        "project_id": project_id,
        "category_id": "Photogrammetry",  # friendly name category 1
        "dataset_name": "Sanitization Test"
    }
    res_trav = client.post("/api/v2/datasets/upload", data=data_trav, files=files_trav)
    assert res_trav.status_code == 200, f"Sanitization upload failed: {res_trav.text}"
    body_trav = res_trav.json()
    sanitized = body_trav["filename"]
    assert ".." not in sanitized, f"Traversal dots not removed: {sanitized}"
    assert "/" not in sanitized and "\\" not in sanitized, f"Path separators not removed: {sanitized}"
    assert "<" not in sanitized and ">" not in sanitized and ":" not in sanitized, f"Illegal chars not removed: {sanitized}"
    assert sanitized.endswith(".jpg")
    print(f" [PASS] Sanitized filename: '{sanitized}'")

    # 5. Test 4: Extension validation rejection
    print("\n--- Test 4: Extension Validation (Disallowed extension) ---")
    files_bad_ext = {
        "files": ("malicious.exe", io.BytesIO(b"MZ\x90\x00" + b"\x00"*50), "application/x-dosexec")
    }
    data_bad_ext = {
        "project_id": project_id,
        "category_id": "1",
    }
    res_bad_ext = client.post("/api/v2/datasets/upload", data=data_bad_ext, files=files_bad_ext)
    assert res_bad_ext.status_code == 400, f"Expected 400 rejection but got {res_bad_ext.status_code}"
    print(f" [PASS] Disallowed extension properly rejected: {res_bad_ext.json()['detail']}")

    # 6. Test 5: Magic bytes signature validation rejection
    print("\n--- Test 5: Content Signature Validation (Fake LAS without LASF header) ---")
    files_bad_sig = {
        "files": ("fake_cloud.las", io.BytesIO(b"THIS_IS_NOT_A_LAS_FILE_JUST_TEXT"), "application/octet-stream")
    }
    data_bad_sig = {
        "project_id": project_id,
        "category_id": "2",
    }
    res_bad_sig = client.post("/api/v2/datasets/upload", data=data_bad_sig, files=files_bad_sig)
    assert res_bad_sig.status_code == 400, f"Expected 400 rejection for fake signature but got {res_bad_sig.status_code}"
    print(f" [PASS] Invalid magic bytes signature properly rejected: {res_bad_sig.json()['detail']}")

    # 7. Test 6: Multi-file Upload across categories (e.g. Category 3 GIS/CAD)
    print("\n--- Test 6: Multi-file Upload (Category 3: GIS / CAD) ---")
    test_run_id = os.urandom(4).hex()
    geojson_content = json.dumps({
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"parcel_id": f"PUN-{test_run_id}"},
            "geometry": {"type": "Polygon", "coordinates": [[[73.85, 18.52], [73.86, 18.52], [73.86, 18.53], [73.85, 18.53], [73.85, 18.52]]]}
        }]
    }).encode("utf-8")

    csv_content = f"point_id,easting,northing,elevation,code\nGCP_{test_run_id},385123.45,2048912.12,560.25,BENCHMARK\n".encode("utf-8")

    multi_files = [
        ("files", ("parcels.geojson", io.BytesIO(geojson_content), "application/geo+json")),
        ("files", ("cadastre_coords.csv", io.BytesIO(csv_content), "text/csv")),
    ]
    data_multi = {
        "project_id": project_id,
        "category_id": "3",  # GIS / CAD
        "dataset_name": "Multi File GIS Batch"
    }
    res_multi = client.post("/api/v2/datasets/upload", data=data_multi, files=multi_files)
    assert res_multi.status_code == 200, f"Multi-file upload failed: {res_multi.text}"
    body_multi = res_multi.json()
    assert body_multi["files_saved"] == 2
    assert len(body_multi["files"]) >= 2
    for f in body_multi["files"]:
        assert Path(f["storage_location"]).exists()
        print(f"  - Stored: {f['filename']} ({f['size']} bytes, SHA256: {f['SHA256'][:12]}...) -> {f['upload_status']}")
    print(f" [PASS] Multi-file batch persisted successfully!")

    print("\n==================================================")
    print("ALL STEP 5 REQUIREMENTS VERIFIED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
