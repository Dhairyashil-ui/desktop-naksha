"""
Naksha 2.0 — Verification Script for STEP 16 and STEP 17
Step 16: Real Processing Job System (Job -> Node: status, started_at, finished_at, inputs, outputs, error)
Step 17: Real Artifact System (artifact_id, project_id, job_id, type, path, size, SHA256, CRS, created_at)
"""

import os
import sys
import uuid
import time
import json
import hashlib
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, "d:/surveynaksha")

import numpy as np
import laspy
from sqlalchemy import text as sql_text
from backend.database import engine
from backend.artifact_system import (
    register_artifact,
    get_artifact,
    list_job_artifacts,
    compute_file_sha256,
)
from backend.job_engine import (
    dispatch_job_async,
    run_real_spatial_pipeline,
    get_job_full_status,
)
from backend.pipeline_processors import (
    clean_las,
    register_las,
    fuse_point_cloud,
    segment_building_points,
    reconstruct_mesh,
    export_glb,
)

SEP = "=" * 70

def create_synthetic_raw_las(output_path: Path) -> Path:
    """Creates a real LAS file with building, terrain, and noise points."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    header = laspy.LasHeader(point_format=3, version="1.2")
    header.scales = [0.001, 0.001, 0.001]
    header.offsets = [380000.0, 2040000.0, 500.0]

    # Generate 4000 ground points (z around 540m)
    n_ground = 2500
    gx = 380100.0 + np.random.uniform(0, 50, n_ground)
    gy = 2040100.0 + np.random.uniform(0, 50, n_ground)
    gz = 540.0 + np.random.normal(0, 0.05, n_ground)
    g_cls = np.full(n_ground, 2, dtype=np.uint8)  # class 2 = Ground

    # Generate 1500 building facade and roof points (z around 545m to 565m)
    n_bldg = 1500
    bx = 380115.0 + np.random.uniform(0, 20, n_bldg)
    by = 2040115.0 + np.random.uniform(0, 20, n_bldg)
    bz = 542.0 + np.random.uniform(0, 20, n_bldg)
    b_cls = np.full(n_bldg, 6, dtype=np.uint8)  # class 6 = Building

    # Generate 50 noise points (ASPRS class 7=low noise, 18=high noise)
    n_noise = 50
    nx = 380120.0 + np.random.uniform(0, 30, n_noise)
    ny = 2040120.0 + np.random.uniform(0, 30, n_noise)
    nz = 680.0 + np.random.uniform(0, 100, n_noise)  # extreme elevation outlier
    n_cls = np.random.choice([7, 18], n_noise).astype(np.uint8)

    all_x = np.concatenate([gx, bx, nx])
    all_y = np.concatenate([gy, by, ny])
    all_z = np.concatenate([gz, bz, nz])
    all_cls = np.concatenate([g_cls, b_cls, n_cls])

    las = laspy.LasData(header)
    las.x = all_x
    las.y = all_y
    las.z = all_z
    las.classification = all_cls
    las.write(str(output_path))
    return output_path


def main():
    print(SEP)
    print("STEP 16 & STEP 17: REAL PROCESSING JOB & ARTIFACT SYSTEM")
    print(SEP)

    tmp = Path(tempfile.mkdtemp(prefix="naksha_job_test_"))
    raw_las_path = tmp / "raw_terrestrial_scan.las"
    create_synthetic_raw_las(raw_las_path)
    print(f"Created real Raw LAS input file: {raw_las_path} ({raw_las_path.stat().st_size:,} bytes)")

    # 1. Setup a test project in DB
    proj_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    with engine.connect() as conn:
        org_row = conn.execute(sql_text("SELECT id FROM organizations LIMIT 1")).fetchone()
        if org_row:
            org_id = str(org_row[0])
        else:
            conn.execute(sql_text("INSERT INTO organizations (id, name, slug) VALUES (:id, 'Test Org', 'test-org')"), {"id": org_id})
        conn.execute(sql_text("""
            INSERT INTO projects (id, organization_id, code, title, accuracy_tier, target_crs_epsg, status)
            VALUES (:id, :org_id, :code, 'Step 16-17 Test Project', 'TIER_1_CADASTRAL_LEGAL'::accuracy_tier_enum, 32643, 'ACTIVE')
        """), {"id": proj_id, "org_id": org_id, "code": f"PROJ-{uuid.uuid4().hex[:6]}"})
        conn.commit()

    print(f"Initialized database test project: {proj_id}")

    # 2. Test Step 16: Dispatch real processing job asynchronously
    job_id = str(uuid.uuid4())
    print(f"\n[STEP 16] Dispatching real spatial job asynchronously: {job_id}...")
    dispatched_id = dispatch_job_async(
        project_id=proj_id,
        raw_las_path=raw_las_path,
        target_epsg=32643,
        job_id=job_id,
    )
    assert dispatched_id == job_id, "Dispatched job_id should match"

    # Poll status asynchronously
    max_wait = 30  # seconds
    t0 = time.time()
    final_job_status = None

    while (time.time() - t0) < max_wait:
        st = get_job_full_status(job_id)
        if st and st.get("status") in ("COMPLETED", "FAILED"):
            final_job_status = st
            break
        print(f"  ...job status: {st.get('status') if st else 'PENDING'}, elapsed: {time.time() - t0:.1f}s")
        time.sleep(0.5)

    assert final_job_status is not None, "Job did not complete within timeout"
    print(f"\n[STEP 16] Asynchronous Worker Finished!")
    print(f"  Job ID: {final_job_status['job_id']}")
    print(f"  Pipeline Type: {final_job_status['pipeline_type']}")
    print(f"  Status: {final_job_status['status']}")
    print(f"  Progress: {final_job_status['progress']}%")
    print(f"  Dispatched At: {final_job_status['dispatched_at']}")
    print(f"  Completed At: {final_job_status['completed_at']}")
    print(f"  Error: {final_job_status['error']}")

    assert final_job_status["status"] == "COMPLETED", f"Job failed: {final_job_status.get('error')}"
    assert final_job_status["progress"] == 100.0

    # Verify Job Nodes structure
    print(f"\n[STEP 16] Verifying Job Nodes (Count: {len(final_job_status['nodes'])}):")
    expected_nodes = [
        "node_clean_las",
        "node_registered_las",
        "node_fused_cloud",
        "node_building_cloud",
        "node_mesh",
        "node_glb",
    ]

    node_ids_found = [n["id"] for n in final_job_status["nodes"]]
    assert node_ids_found == expected_nodes, f"Expected {expected_nodes}, got {node_ids_found}"

    for n in final_job_status["nodes"]:
        print(f"\n  ├── Node: {n['name']} (ID: {n['id']})")
        print(f"  │     Category:         {n['category']}")
        print(f"  │     Status:           {n['status']}")
        print(f"  │     Started At:       {n['started_at']}")
        print(f"  │     Finished At:      {n['finished_at']}")
        print(f"  │     Input Artifacts:  {n['input_artifacts']}")
        print(f"  │     Output Artifacts: {n['output_artifacts']}")
        print(f"  │     Error:            {n['error']}")
        print(f"  │     Metrics:          {n['metrics']}")

        assert n["status"] == "SUCCESS", f"Node {n['id']} should be SUCCESS"
        assert n["started_at"] is not None, f"Node {n['id']} missing started_at"
        assert n["finished_at"] is not None, f"Node {n['id']} missing finished_at"
        assert len(n["input_artifacts"]) > 0, f"Node {n['id']} missing input_artifacts"
        assert len(n["output_artifacts"]) > 0, f"Node {n['id']} missing output_artifacts"
        assert n["error"] is None, f"Node {n['id']} has error: {n['error']}"

    # 3. Test Step 17: Real Artifact System
    print("\n" + SEP)
    print("[STEP 17] VERIFYING REAL ARTIFACT SYSTEM")
    print(SEP)

    artifacts = final_job_status.get("artifacts", [])
    print(f"Total Artifacts Produced in Job: {len(artifacts)}")
    assert len(artifacts) == 7, f"Expected 7 artifacts (1 raw + 6 pipeline stages), got {len(artifacts)}"

    expected_sequence = [
        "RAW_LAS",
        "CLEAN_LAS",
        "REGISTERED_LAS",
        "FUSED_POINT_CLOUD",
        "BUILDING_POINT_CLOUD",
        "MESH_3D",
        "GLB_3D",
    ]

    for idx, art in enumerate(artifacts):
        print(f"\n  [Artifact #{idx + 1}] Type: {art['type']}")
        print(f"    artifact_id : {art['artifact_id']}")
        print(f"    project_id  : {art['project_id']}")
        print(f"    job_id      : {art['job_id']}")
        print(f"    path        : {art['path']}")
        print(f"    size        : {art['size']:,} bytes")
        print(f"    SHA256      : {art['sha256']}")
        print(f"    CRS         : {art['crs']}")
        print(f"    created_at  : {art['created_at']}")

        # Verify type sequence
        assert art["type"] == expected_sequence[idx], f"Artifact #{idx} type mismatch"

        # Verify physical file existence and integrity
        fpath = Path(art["path"])
        assert fpath.exists(), f"Artifact file does not exist on disk: {fpath}"
        actual_size = fpath.stat().st_size
        assert actual_size == art["size"], f"Size mismatch for {art['type']}: DB {art['size']} vs disk {actual_size}"
        assert actual_size > 0, f"Artifact {art['type']} is 0 bytes"

        # Verify cryptographic SHA-256
        actual_sha256 = compute_file_sha256(fpath)
        assert actual_sha256 == art["sha256"], f"SHA256 checksum mismatch for {art['type']}"

        # Verify CRS is populated
        assert art["crs"] == "EPSG:32643", f"CRS mismatch: {art['crs']}"

    # 4. Verify Individual Artifact Lookup by ID via API/helper
    print("\n[STEP 17] Verifying single artifact lookup (get_artifact)...")
    first_art = artifacts[0]
    fetched_art = get_artifact(first_art["artifact_id"])
    assert fetched_art is not None, "Failed to get_artifact by ID"
    assert fetched_art.sha256 == first_art["sha256"]
    print(f"  Verified get_artifact({first_art['artifact_id'][:8]}...): SHA-256 match ✓")

    # 5. Verify FastAPI Endpoints via TestClient
    print("\n[STEP 16 & 17] Verifying FastAPI HTTP Endpoints...")
    from fastapi.testclient import TestClient
    from backend.main import app

    client = TestClient(app)

    # GET /jobs/{job_id}
    resp_job = client.get(f"/api/v2/jobs/{job_id}")
    assert resp_job.status_code == 200, f"GET /jobs failed: {resp_job.text}"
    job_payload = resp_job.json()
    assert job_payload["status"] == "COMPLETED"
    assert len(job_payload["nodes"]) == 6
    print(f"  GET /api/v2/jobs/{job_id[:8]}... -> 200 OK ✓")

    # GET /jobs/{job_id}/artifacts
    resp_arts = client.get(f"/api/v2/jobs/{job_id}/artifacts")
    assert resp_arts.status_code == 200
    assert len(resp_arts.json()) == 7
    print(f"  GET /api/v2/jobs/{job_id[:8]}.../artifacts -> 200 OK (7 artifacts) ✓")

    # GET /artifacts/{artifact_id}
    last_art = artifacts[-1]
    resp_one = client.get(f"/api/v2/artifacts/{last_art['artifact_id']}")
    assert resp_one.status_code == 200
    assert resp_one.json()["type"] == "GLB_3D"
    print(f"  GET /api/v2/artifacts/{last_art['artifact_id'][:8]}... -> 200 OK (GLB 3D) ✓")

    # Cleanup DB
    with engine.connect() as conn:
        conn.execute(sql_text("DELETE FROM processed_artifacts WHERE project_id = :id"), {"id": proj_id})
        conn.execute(sql_text("DELETE FROM processing_job_nodes WHERE job_id = :id"), {"id": job_id})
        conn.execute(sql_text("DELETE FROM processing_jobs WHERE id = :id"), {"id": job_id})
        conn.execute(sql_text("DELETE FROM projects WHERE id = :id"), {"id": proj_id})
        conn.commit()

    print("\n" + SEP)
    print("SUCCESS: STEP 16 AND STEP 17 100% VERIFIED!")
    print(SEP)


if __name__ == "__main__":
    main()
