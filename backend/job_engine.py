"""
Naksha 2.0 — Real Processing Job & Node System (Step 16 & Step 17)

Job
 ├── Node
 │    ├── status
 │    ├── started_at
 │    ├── finished_at
 │    ├── input artifacts
 │    ├── output artifacts
 │    └── error

Asynchronous background worker architecture with real spatial computations.
Persists Job and Node status to PostgreSQL.
Produces verified artifacts at every step:
  Raw LAS -> Clean LAS -> Registered LAS -> Fused Cloud -> Building Cloud -> Mesh -> GLB
"""

from __future__ import annotations

import os
import sys
import uuid
import time
import json
import asyncio
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import text as sql_text

try:
    from backend.database import engine
    from backend.config import settings
    from backend.artifact_system import (
        register_artifact,
        get_artifact_storage_dir,
        ArtifactRecord,
        list_job_artifacts,
    )
    from backend.pipeline_processors import (
        clean_las,
        register_las,
        fuse_point_cloud,
        segment_building_points,
        reconstruct_mesh,
        export_glb,
    )
except ImportError:
    from database import engine
    from config import settings
    from artifact_system import (
        register_artifact,
        get_artifact_storage_dir,
        ArtifactRecord,
        list_job_artifacts,
    )
    from pipeline_processors import (
        clean_las,
        register_las,
        fuse_point_cloud,
        segment_building_points,
        reconstruct_mesh,
        export_glb,
    )

# Dedicated thread pool for async spatial background execution
_worker_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="naksha_worker_")


# ──────────────────────────────────────────────────────────────────────────────
# DATA STRUCTURES
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class NodeRecord:
    id: str
    job_id: str
    name: str
    category: str
    status: str = "PENDING"             # PENDING | RUNNING | SUCCESS | FAILED | SKIPPED
    started_at: Optional[str] = None    # ISO UTC
    finished_at: Optional[str] = None   # ISO UTC
    input_artifacts: List[str] = field(default_factory=list)
    output_artifacts: List[str] = field(default_factory=list)
    error: Optional[str] = None
    metrics: Dict[str, Any] = field(default_factory=dict)
    progress: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        # Explicit uppercase aliases matching prompt requirements
        d["STATUS"] = self.status
        d["STARTED_AT"] = self.started_at
        d["FINISHED_AT"] = self.finished_at
        d["INPUT_ARTIFACTS"] = self.input_artifacts
        d["OUTPUT_ARTIFACTS"] = self.output_artifacts
        d["ERROR"] = self.error
        return d


@dataclass
class JobRecord:
    job_id: str
    project_id: str
    pipeline_type: str
    status: str = "PENDING"             # PENDING | PROCESSING | COMPLETED | FAILED
    progress: float = 0.0
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None
    nodes: List[NodeRecord] = field(default_factory=list)
    created_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "project_id": self.project_id,
            "pipeline_type": self.pipeline_type,
            "status": self.status,
            "progress": self.progress,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "error": self.error,
            "nodes": [n.to_dict() for n in self.nodes],
            "created_at": self.created_at,
        }


# ──────────────────────────────────────────────────────────────────────────────
# DATABASE PERSISTENCE HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def persist_job_start(job_id: str, project_id: str, pipeline_type: str, db_engine=None):
    conn_engine = db_engine or engine
    now = datetime.now(timezone.utc)
    with conn_engine.connect() as conn:
        conn.execute(
            sql_text("""
                INSERT INTO processing_jobs (
                    id, project_id, pipeline_type, status, priority,
                    progress_percentage, parameters, dispatched_at, created_at, updated_at
                ) VALUES (
                    :id, :proj_id, :ptype, 'RUNNING'::job_status_enum, 1,
                    0.0, '{}'::jsonb, :now, :now, :now
                )
                ON CONFLICT (id) DO UPDATE SET
                    status = 'RUNNING'::job_status_enum,
                    progress_percentage = 0.0,
                    dispatched_at = :now,
                    updated_at = :now;
            """),
            {
                "id": job_id,
                "proj_id": project_id,
                "ptype": pipeline_type,
                "now": now,
            }
        )
        conn.commit()


def persist_job_complete(job_id: str, status: str, progress: float, error: Optional[str] = None, db_engine=None):
    conn_engine = db_engine or engine
    now = datetime.now(timezone.utc)
    db_status = "SUCCESS" if status in ("COMPLETED", "SUCCESS") else "FAILED"
    with conn_engine.connect() as conn:
        conn.execute(
            sql_text("""
                UPDATE processing_jobs
                SET status = CAST(:status AS job_status_enum),
                    progress_percentage = :progress,
                    completed_at = :now,
                    error_summary = :err,
                    updated_at = :now
                WHERE id = :id;
            """),
            {
                "id": job_id,
                "status": db_status,
                "progress": progress,
                "err": error,
                "now": now,
            }
        )
        conn.commit()


def persist_node(node: NodeRecord, db_engine=None):
    conn_engine = db_engine or engine
    with conn_engine.connect() as conn:
        conn.execute(
            sql_text("""
                INSERT INTO processing_job_nodes (
                    id, job_id, name, category, status,
                    started_at, finished_at, input_artifacts, output_artifacts,
                    error, metrics, progress, updated_at
                ) VALUES (
                    :id, :job_id, :name, :cat, :status,
                    :started, :finished, CAST(:inputs AS jsonb), CAST(:outputs AS jsonb),
                    :err, CAST(:metrics AS jsonb), :prog, now()
                )
                ON CONFLICT (job_id, id) DO UPDATE SET
                    status = EXCLUDED.status,
                    started_at = EXCLUDED.started_at,
                    finished_at = EXCLUDED.finished_at,
                    input_artifacts = EXCLUDED.input_artifacts,
                    output_artifacts = EXCLUDED.output_artifacts,
                    error = EXCLUDED.error,
                    metrics = EXCLUDED.metrics,
                    progress = EXCLUDED.progress,
                    updated_at = now();
            """),
            {
                "id": node.id,
                "job_id": node.job_id,
                "name": node.name,
                "cat": node.category,
                "status": node.status,
                "started": node.started_at,
                "finished": node.finished_at,
                "inputs": json.dumps(node.input_artifacts),
                "outputs": json.dumps(node.output_artifacts),
                "err": node.error,
                "metrics": json.dumps(node.metrics),
                "prog": node.progress,
            }
        )
        conn.commit()


# ──────────────────────────────────────────────────────────────────────────────
# REAL PIPELINE EXECUTION (STEP 16 & STEP 17)
# ──────────────────────────────────────────────────────────────────────────────

def run_real_spatial_pipeline(
    project_id: str,
    raw_las_path: Path | str,
    target_epsg: int = 32643,
    job_id: Optional[str] = None,
    db_engine = None,
) -> JobRecord:
    """
    Synchronous execution worker (run inside background thread/Celery task).
    Executes real spatial processing pipeline:
      Raw LAS
        ↓
      Clean LAS (Noise Filter)
        ↓
      Registered LAS (Georeferencing)
        ↓
      Fused Point Cloud (Voxel Deduplication)
        ↓
      Building Point Cloud (Structural Segmentation)
        ↓
      Mesh (Delaunay 3D Surface PLY)
        ↓
      GLB (glTF 2.0 Binary)

    Produces and registers actual artifacts at every stage.
    """
    jid = job_id or str(uuid.uuid4())
    in_raw_p = Path(raw_las_path).resolve()
    if not in_raw_p.exists():
        raise FileNotFoundError(f"Input Raw LAS file not found: {in_raw_p}")

    crs_str = f"EPSG:{target_epsg}"
    storage_dir = get_artifact_storage_dir(project_id, jid)

    # 1. Initialize Job & Nodes
    persist_job_start(jid, project_id, "REAL_CADASTRAL_3D_LIDAR_PIPELINE", db_engine)

    nodes_def = [
        ("node_clean_las", "Clean LAS (Noise Filtering)", "Point Cloud Processing"),
        ("node_registered_las", "Registered LAS (Coordinate Transformation)", "Georeferencing"),
        ("node_fused_cloud", "Fused Point Cloud (Voxel Harmonization)", "Point Cloud Fusion"),
        ("node_building_cloud", "Building Point Cloud (Superstructure Segmentation)", "AI Segmentation"),
        ("node_mesh", "3D Surface Mesh Reconstruction (PLY)", "Mesh Generation"),
        ("node_glb", "3D Web Delivery Asset (glTF Binary GLB)", "Web Delivery"),
    ]

    nodes_map: Dict[str, NodeRecord] = {}
    for nid, nname, ncat in nodes_def:
        nr = NodeRecord(id=nid, job_id=jid, name=nname, category=ncat, status="PENDING")
        nodes_map[nid] = nr
        persist_node(nr, db_engine)

    job_rec = JobRecord(
        job_id=jid,
        project_id=project_id,
        pipeline_type="REAL_CADASTRAL_3D_LIDAR_PIPELINE",
        status="PROCESSING",
        started_at=datetime.now(timezone.utc).isoformat(),
        created_at=datetime.now(timezone.utc).isoformat(),
        nodes=list(nodes_map.values()),
    )

    # Register initial RAW LAS artifact
    raw_artifact = register_artifact(
        project_id=project_id,
        job_id=jid,
        artifact_type="RAW_LAS",
        file_path=in_raw_p,
        crs=crs_str,
        node_id=None,
        metadata={"stage": "initial_input", "original_filename": in_raw_p.name},
        db_engine=db_engine,
    )

    current_input_art = raw_artifact
    current_input_path = in_raw_p

    total_nodes = len(nodes_def)

    try:
        # ──────────────────────────────────────────────────────────────────────
        # STAGE 1: CLEAN LAS
        # ──────────────────────────────────────────────────────────────────────
        n1 = nodes_map["node_clean_las"]
        n1.status = "RUNNING"
        n1.started_at = datetime.now(timezone.utc).isoformat()
        n1.input_artifacts = [current_input_art.artifact_id]
        persist_node(n1, db_engine)

        out_clean_path = storage_dir / "01_clean_point_cloud.las"
        clean_res = clean_las(current_input_path, out_clean_path)

        clean_art = register_artifact(
            project_id=project_id,
            job_id=jid,
            artifact_type="CLEAN_LAS",
            file_path=out_clean_path,
            crs=crs_str,
            node_id=n1.id,
            metadata=clean_res,
            db_engine=db_engine,
        )

        n1.status = "SUCCESS"
        n1.finished_at = datetime.now(timezone.utc).isoformat()
        n1.output_artifacts = [clean_art.artifact_id]
        n1.metrics = clean_res
        n1.progress = 100.0
        persist_node(n1, db_engine)

        current_input_art = clean_art
        current_input_path = out_clean_path

        # ──────────────────────────────────────────────────────────────────────
        # STAGE 2: REGISTERED LAS
        # ──────────────────────────────────────────────────────────────────────
        n2 = nodes_map["node_registered_las"]
        n2.status = "RUNNING"
        n2.started_at = datetime.now(timezone.utc).isoformat()
        n2.input_artifacts = [current_input_art.artifact_id]
        persist_node(n2, db_engine)

        out_reg_path = storage_dir / "02_registered_point_cloud.las"
        reg_res = register_las(current_input_path, out_reg_path, target_epsg=target_epsg)

        reg_art = register_artifact(
            project_id=project_id,
            job_id=jid,
            artifact_type="REGISTERED_LAS",
            file_path=out_reg_path,
            crs=crs_str,
            node_id=n2.id,
            metadata=reg_res,
            db_engine=db_engine,
        )

        n2.status = "SUCCESS"
        n2.finished_at = datetime.now(timezone.utc).isoformat()
        n2.output_artifacts = [reg_art.artifact_id]
        n2.metrics = reg_res
        n2.progress = 100.0
        persist_node(n2, db_engine)

        current_input_art = reg_art
        current_input_path = out_reg_path

        # ──────────────────────────────────────────────────────────────────────
        # STAGE 3: FUSED POINT CLOUD
        # ──────────────────────────────────────────────────────────────────────
        n3 = nodes_map["node_fused_cloud"]
        n3.status = "RUNNING"
        n3.started_at = datetime.now(timezone.utc).isoformat()
        n3.input_artifacts = [current_input_art.artifact_id]
        persist_node(n3, db_engine)

        out_fused_path = storage_dir / "03_fused_point_cloud.las"
        fused_res = fuse_point_cloud([current_input_path], out_fused_path, voxel_size_m=0.03)

        fused_art = register_artifact(
            project_id=project_id,
            job_id=jid,
            artifact_type="FUSED_POINT_CLOUD",
            file_path=out_fused_path,
            crs=crs_str,
            node_id=n3.id,
            metadata=fused_res,
            db_engine=db_engine,
        )

        n3.status = "SUCCESS"
        n3.finished_at = datetime.now(timezone.utc).isoformat()
        n3.output_artifacts = [fused_art.artifact_id]
        n3.metrics = fused_res
        n3.progress = 100.0
        persist_node(n3, db_engine)

        current_input_art = fused_art
        current_input_path = out_fused_path

        # ──────────────────────────────────────────────────────────────────────
        # STAGE 4: BUILDING POINT CLOUD
        # ──────────────────────────────────────────────────────────────────────
        n4 = nodes_map["node_building_cloud"]
        n4.status = "RUNNING"
        n4.started_at = datetime.now(timezone.utc).isoformat()
        n4.input_artifacts = [current_input_art.artifact_id]
        persist_node(n4, db_engine)

        out_bldg_path = storage_dir / "04_building_point_cloud.las"
        bldg_res = segment_building_points(current_input_path, out_bldg_path)

        bldg_art = register_artifact(
            project_id=project_id,
            job_id=jid,
            artifact_type="BUILDING_POINT_CLOUD",
            file_path=out_bldg_path,
            crs=crs_str,
            node_id=n4.id,
            metadata=bldg_res,
            db_engine=db_engine,
        )

        n4.status = "SUCCESS"
        n4.finished_at = datetime.now(timezone.utc).isoformat()
        n4.output_artifacts = [bldg_art.artifact_id]
        n4.metrics = bldg_res
        n4.progress = 100.0
        persist_node(n4, db_engine)

        current_input_art = bldg_art
        current_input_path = out_bldg_path

        # ──────────────────────────────────────────────────────────────────────
        # STAGE 5: 3D SURFACE MESH (PLY)
        # ──────────────────────────────────────────────────────────────────────
        n5 = nodes_map["node_mesh"]
        n5.status = "RUNNING"
        n5.started_at = datetime.now(timezone.utc).isoformat()
        n5.input_artifacts = [current_input_art.artifact_id]
        persist_node(n5, db_engine)

        out_mesh_path = storage_dir / "05_building_mesh.ply"
        mesh_res = reconstruct_mesh(current_input_path, out_mesh_path)

        mesh_art = register_artifact(
            project_id=project_id,
            job_id=jid,
            artifact_type="MESH_3D",
            file_path=out_mesh_path,
            crs=crs_str,
            node_id=n5.id,
            metadata=mesh_res,
            db_engine=db_engine,
        )

        n5.status = "SUCCESS"
        n5.finished_at = datetime.now(timezone.utc).isoformat()
        n5.output_artifacts = [mesh_art.artifact_id]
        n5.metrics = mesh_res
        n5.progress = 100.0
        persist_node(n5, db_engine)

        current_input_art = mesh_art
        current_input_path = out_mesh_path

        # ──────────────────────────────────────────────────────────────────────
        # STAGE 6: GLB 3D (glTF 2.0 Binary)
        # ──────────────────────────────────────────────────────────────────────
        n6 = nodes_map["node_glb"]
        n6.status = "RUNNING"
        n6.started_at = datetime.now(timezone.utc).isoformat()
        n6.input_artifacts = [current_input_art.artifact_id]
        persist_node(n6, db_engine)

        out_glb_path = storage_dir / "06_cadastral_model.glb"
        glb_res = export_glb(current_input_path, out_glb_path)

        glb_art = register_artifact(
            project_id=project_id,
            job_id=jid,
            artifact_type="GLB_3D",
            file_path=out_glb_path,
            crs=crs_str,
            node_id=n6.id,
            metadata=glb_res,
            db_engine=db_engine,
        )

        n6.status = "SUCCESS"
        n6.finished_at = datetime.now(timezone.utc).isoformat()
        n6.output_artifacts = [glb_art.artifact_id]
        n6.metrics = glb_res
        n6.progress = 100.0
        persist_node(n6, db_engine)

        # ──────────────────────────────────────────────────────────────────────
        # PIPELINE SUCCESS
        # ──────────────────────────────────────────────────────────────────────
        persist_job_complete(jid, "COMPLETED", 100.0, None, db_engine)
        job_rec.status = "COMPLETED"
        job_rec.progress = 100.0
        job_rec.finished_at = datetime.now(timezone.utc).isoformat()
        job_rec.nodes = list(nodes_map.values())

    except Exception as exc:
        err_msg = str(exc)
        # Find whichever node was running and mark failed
        for n in nodes_map.values():
            if n.status == "RUNNING":
                n.status = "FAILED"
                n.error = err_msg
                n.finished_at = datetime.now(timezone.utc).isoformat()
                persist_node(n, db_engine)
            elif n.status == "PENDING":
                n.status = "SKIPPED"
                persist_node(n, db_engine)

        persist_job_complete(jid, "FAILED", 0.0, err_msg, db_engine)
        job_rec.status = "FAILED"
        job_rec.error = err_msg
        job_rec.finished_at = datetime.now(timezone.utc).isoformat()
        job_rec.nodes = list(nodes_map.values())
        raise

    return job_rec


# ──────────────────────────────────────────────────────────────────────────────
# ASYNCHRONOUS WORKER RUNNER
# ──────────────────────────────────────────────────────────────────────────────

def dispatch_job_async(
    project_id: str,
    raw_las_path: Path | str,
    target_epsg: int = 32643,
    job_id: Optional[str] = None,
) -> str:
    """
    Dispatches real pipeline asynchronously:
    - Returns job_id immediately
    - Background worker executes the 6-stage spatial pipeline
    - Status and artifacts are persisted to PostgreSQL in real-time
    """
    jid = job_id or str(uuid.uuid4())

    def _worker():
        try:
            run_real_spatial_pipeline(
                project_id=project_id,
                raw_las_path=raw_las_path,
                target_epsg=target_epsg,
                job_id=jid,
            )
        except Exception as e:
            print(f"[Worker Error] Job {jid} failed: {e}", file=sys.stderr)

    _worker_pool.submit(_worker)
    return jid


def get_job_full_status(job_id: str, db_engine=None) -> Optional[Dict[str, Any]]:
    """
    Queries complete job state from PostgreSQL:
    Job -> Nodes -> Artifacts.
    """
    try:
        uuid.UUID(str(job_id))
    except (ValueError, AttributeError):
        return None

    conn_engine = db_engine or engine
    with conn_engine.connect() as conn:
        job_row = conn.execute(
            sql_text("""
                SELECT id, project_id, pipeline_type, status, progress_percentage,
                       dispatched_at, completed_at, error_summary, created_at
                FROM processing_jobs
                WHERE id = :id
            """),
            {"id": job_id},
        ).fetchone()

        if not job_row:
            return None

        node_rows = conn.execute(
            sql_text("""
                SELECT id, job_id, name, category, status, started_at, finished_at,
                       input_artifacts, output_artifacts, error, metrics, progress
                FROM processing_job_nodes
                WHERE job_id = :jid
                ORDER BY created_at ASC
            """),
            {"jid": job_id},
        ).fetchall()

    artifacts = list_job_artifacts(job_id, conn_engine)

    nodes_list = []
    for nr in node_rows:
        inputs = nr.input_artifacts if isinstance(nr.input_artifacts, list) else (json.loads(nr.input_artifacts) if nr.input_artifacts else [])
        outputs = nr.output_artifacts if isinstance(nr.output_artifacts, list) else (json.loads(nr.output_artifacts) if nr.output_artifacts else [])
        metrics = nr.metrics if isinstance(nr.metrics, dict) else (json.loads(nr.metrics) if nr.metrics else {})
        nodes_list.append({
            "id": nr.id,
            "name": nr.name,
            "category": nr.category,
            "status": nr.status,
            "started_at": nr.started_at.isoformat() if hasattr(nr.started_at, "isoformat") else str(nr.started_at) if nr.started_at else None,
            "finished_at": nr.finished_at.isoformat() if hasattr(nr.finished_at, "isoformat") else str(nr.finished_at) if nr.finished_at else None,
            "input_artifacts": inputs,
            "output_artifacts": outputs,
            "error": nr.error,
            "metrics": metrics,
            "progress": float(nr.progress or 0.0),
            # Uppercase aliases matching prompt
            "STATUS": nr.status,
            "STARTED_AT": nr.started_at.isoformat() if hasattr(nr.started_at, "isoformat") else str(nr.started_at) if nr.started_at else None,
            "FINISHED_AT": nr.finished_at.isoformat() if hasattr(nr.finished_at, "isoformat") else str(nr.finished_at) if nr.finished_at else None,
            "INPUT_ARTIFACTS": inputs,
            "OUTPUT_ARTIFACTS": outputs,
            "ERROR": nr.error,
        })

    status_str = "COMPLETED" if str(job_row.status).upper() == "SUCCESS" else str(job_row.status)
    return {
        "job_id": str(job_row.id),
        "project_id": str(job_row.project_id),
        "pipeline_type": job_row.pipeline_type,
        "status": status_str,
        "STATUS": status_str,
        "progress": float(job_row.progress_percentage or 0.0),
        "dispatched_at": job_row.dispatched_at.isoformat() if hasattr(job_row.dispatched_at, "isoformat") else str(job_row.dispatched_at) if job_row.dispatched_at else None,
        "completed_at": job_row.completed_at.isoformat() if hasattr(job_row.completed_at, "isoformat") else str(job_row.completed_at) if job_row.completed_at else None,
        "error": job_row.error_summary,
        "nodes": nodes_list,
        "artifacts": [a.to_dict() for a in artifacts],
    }
