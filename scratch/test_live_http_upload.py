import requests
import io
import os
import hashlib
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"

def test_live_upload():
    print("Testing live HTTP multipart upload on port 8000...")

    # 1. Get projects
    r = requests.get(f"{BASE_URL}/api/v2/projects")
    assert r.status_code == 200, f"Failed to list projects: {r.text}"
    projects = r.json().get("projects", [])
    assert len(projects) > 0, "No projects returned"
    project_id = projects[0]["project_id"]
    print(f"Target Project: {project_id} ('{projects[0]['title']}')")

    # 2. Create actual test sample file on disk
    test_file_path = Path("scratch/sample_actual_drone_ortho.jpg")
    # Valid JPEG image bytes
    jpeg_bytes = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        + b"\xff\xdb\x00C\x00" + os.urandom(64)
        + b"\xff\xc0\x00\x11\x08\x00\x10\x00\x10\x03\x01\x22\x00\x02\x11\x01\x03\x11\x01"
        + b"\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00?\x00"
        + os.urandom(128)
        + b"\xff\xd9"
    )
    with open(test_file_path, "wb") as f:
        f.write(jpeg_bytes)

    expected_sha256 = hashlib.sha256(jpeg_bytes).hexdigest()
    print(f"Created actual sample test file: {test_file_path} ({len(jpeg_bytes)} bytes, SHA256: {expected_sha256[:12]}...)")

    # 3. Perform multipart POST request to /api/v2/datasets/upload
    with open(test_file_path, "rb") as fp:
        files = {
            "files": ("drone_flight_pune_001.jpg", fp, "image/jpeg")
        }
        data = {
            "project_id": project_id,
            "category_id": "1",  # Category 1: Photogrammetry
            "dataset_name": "Drone Survey 2026 Batch A"
        }
        resp = requests.post(f"{BASE_URL}/api/v2/datasets/upload", data=data, files=files)

    print("HTTP Status:", resp.status_code)
    assert resp.status_code == 200, f"Upload error: {resp.text}"
    body = resp.json()

    print("Upload Response:")
    print(f"  file_id: {body.get('file_id')}")
    print(f"  dataset_id: {body.get('dataset_id')}")
    print(f"  filename: {body.get('filename')}")
    print(f"  size: {body.get('size')} bytes")
    print(f"  SHA256: {body.get('SHA256')}")
    print(f"  category: {body.get('category')}")
    print(f"  storage location: {body.get('storage location')}")
    print(f"  upload status: {body.get('upload status')}")

    assert body.get("file_id") is not None
    assert body.get("dataset_id") is not None
    assert body.get("filename") == "drone_flight_pune_001.jpg"
    assert body.get("size") == len(jpeg_bytes)
    assert body.get("SHA256") == expected_sha256
    assert body.get("category") == "CAT_01_PHOTOGRAMMETRY"
    assert body.get("upload status") == "UPLOADED"

    # 4. Verify physical persistence on local storage
    saved_path = Path(body.get("storage location"))
    assert saved_path.exists(), f"Physically saved file missing: {saved_path}"
    with open(saved_path, "rb") as saved_fp:
        saved_bytes = saved_fp.read()
    assert saved_bytes == jpeg_bytes, "Saved file content mismatch!"
    print(f"Confirmed physical persistence at: {saved_path}")

    # 5. Verify database registration in dataset_files
    files_resp = requests.get(f"{BASE_URL}/api/v2/datasets/{body['dataset_id']}/files")
    assert files_resp.status_code == 200
    df_data = files_resp.json()
    files_list = df_data.get("files", [])
    assert len(files_list) >= 1
    matched = [f for f in files_list if f["sha256"] == expected_sha256]
    assert len(matched) >= 1
    print(f"Confirmed database dataset_files record via API: {matched[0]}")

    print("\n>>> LIVE HTTP MULTIPART TEST COMPLETED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_live_upload()
