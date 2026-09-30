"""
Naksha 2.0 — Real Artifact System (Step 17)

Every processing operation produces a verified artifact.
Each artifact gets:
  - artifact_id
  - project_id
  - job_id
  - type
  - path
  - size
  - SHA256
  - CRS
  - created_at

Backbone of the real spatial pipeline.
"""

from __future__ import annotations

import os
import sys
import uuid
import hashlib
import json
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy import text as sql_text

try:
    from backend.database import engine
    from backend.config import settings
except ImportError:
    from database import engine
    from config import settings


# ──────────────────────────────────────────────────────────────────────────────
# ARTIFACT MODEL
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class ArtifactRecord:
    artifact_id: str
    project_id: str
    job_id: str
    type: str                  # e.g., RAW_LAS, CLEAN_LAS, REGISTERED_LAS, FUSED_POINT_CLOUD, BUILDING_POINT_CLOUD, MESH_3D, GLB_3D
    path: str                  # Absolute filesystem path
    size: int                  # File size in bytes
    sha256: str                # Cryptographic hex digest
    crs: str                   # EPSG:32643 / WKT / Reference frame
    created_at: str            # ISO 8601 UTC timestamp
    node_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        # Add uppercase aliases to match exact prompt specification
        d["SHA256"] = self.sha256
        d["CRS"] = self.crs
        d["SIZE"] = self.size
        d["TYPE"] = self.type
        d["PATH"] = self.path
        return d


# ──────────────────────────────────────────────────────────────────────────────
# SHA-256 & STORAGE HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def compute_file_sha256(file_path: Path, block_size: int = 65536) -> str:
    """Computes SHA-256 checksum by streaming bytes."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(block_size):
            h.update(chunk)
    return h.hexdigest()


def get_artifact_storage_dir(project_id: str, job_id: str) -> Path:
    """Returns canonical filesystem directory for job artifacts."""
    base_dir = Path(getattr(settings, "LOCAL_STORAGE_PATH", "./storage_cache"))
    artifact_dir = base_dir / "projects" / project_id / "jobs" / job_id / "artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    return artifact_dir


# ──────────────────────────────────────────────────────────────────────────────
# ARTIFACT PERSISTENCE & REGISTRATION
# ──────────────────────────────────────────────────────────────────────────────

def register_artifact(
    project_id: str,
    job_id: str,
    artifact_type: str,
    file_path: Path | str,
    crs: str = "EPSG:32643",
    node_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    artifact_id: Optional[str] = None,
    db_engine = None,
) -> ArtifactRecord:
    """
    Registers a real physical file as an artifact in the database and records its:
    artifact_id, project_id, job_id, type, path, size, SHA256, CRS, created_at.
    """
    p = Path(file_path).resolve()
    if not p.exists():
        raise FileNotFoundError(f"Artifact source file does not exist: {p}")

    art_id = artifact_id or str(uuid.uuid4())
    file_size = p.stat().st_size
    sha256_hash = compute_file_sha256(p)
    now_iso = datetime.now(timezone.utc).isoformat()
    meta = metadata or {}

    record = ArtifactRecord(
        artifact_id=art_id,
        project_id=project_id,
        job_id=job_id,
        type=artifact_type,
        path=str(p),
        size=file_size,
        sha256=sha256_hash,
        crs=crs,
        created_at=now_iso,
        node_id=node_id,
        metadata=meta,
    )

    # Persist to PostgreSQL processed_artifacts
    conn_engine = db_engine or engine
    with conn_engine.connect() as conn:
        conn.execute(
            sql_text("""
                INSERT INTO processed_artifacts (
                    id, job_id, project_id, artifact_type, s3_bucket, s3_key,
                    size_bytes, path, sha256, crs, node_id, metadata, created_at
                ) VALUES (
                    :id, :job_id, :project_id, :type, :bucket, :key,
                    :size, :path, :sha256, :crs, :node_id, CAST(:meta AS jsonb), :created_at
                )
                ON CONFLICT (id) DO UPDATE SET
                    artifact_type = EXCLUDED.artifact_type,
                    size_bytes = EXCLUDED.size_bytes,
                    path = EXCLUDED.path,
                    sha256 = EXCLUDED.sha256,
                    crs = EXCLUDED.crs,
                    node_id = EXCLUDED.node_id,
                    metadata = EXCLUDED.metadata;
            """),
            {
                "id": art_id,
                "job_id": job_id,
                "project_id": project_id,
                "type": artifact_type,
                "bucket": "local-storage",
                "key": f"projects/{project_id}/jobs/{job_id}/{p.name}",
                "size": file_size,
                "path": str(p),
                "sha256": sha256_hash,
                "crs": crs,
                "node_id": node_id,
                "meta": json.dumps(meta),
                "created_at": datetime.now(timezone.utc),
            }
        )
        conn.commit()

    return record


def get_artifact(artifact_id: str, db_engine = None) -> Optional[ArtifactRecord]:
    """Retrieves an artifact by ID from PostgreSQL."""
    conn_engine = db_engine or engine
    with conn_engine.connect() as conn:
        row = conn.execute(
            sql_text("""
                SELECT id, job_id, project_id, artifact_type, path, size_bytes,
                       sha256, crs, node_id, metadata, created_at
                FROM processed_artifacts
                WHERE id = :id
            """),
            {"id": artifact_id},
        ).fetchone()

    if not row:
        return None

    meta = row.metadata if isinstance(row.metadata, dict) else (json.loads(row.metadata) if row.metadata else {})

    return ArtifactRecord(
        artifact_id=str(row.id),
        job_id=str(row.job_id),
        project_id=str(row.project_id),
        type=row.artifact_type,
        path=row.path or "",
        size=int(row.size_bytes or 0),
        sha256=row.sha256 or "",
        crs=row.crs or "EPSG:4326",
        created_at=row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at),
        node_id=row.node_id,
        metadata=meta,
    )


def list_job_artifacts(job_id: str, db_engine = None) -> List[ArtifactRecord]:
    """Retrieves all artifacts produced in a given job."""
    try:
        uuid.UUID(str(job_id))
    except (ValueError, AttributeError):
        return []

    conn_engine = db_engine or engine
    with conn_engine.connect() as conn:
        rows = conn.execute(
            sql_text("""
                SELECT id, job_id, project_id, artifact_type, path, size_bytes,
                       sha256, crs, node_id, metadata, created_at
                FROM processed_artifacts
                WHERE job_id = :job_id
                ORDER BY created_at ASC
            """),
            {"job_id": job_id},
        ).fetchall()

    results = []
    for r in rows:
        meta = r.metadata if isinstance(r.metadata, dict) else (json.loads(r.metadata) if r.metadata else {})
        results.append(
            ArtifactRecord(
                artifact_id=str(r.id),
                job_id=str(r.job_id),
                project_id=str(r.project_id),
                type=r.artifact_type,
                path=r.path or "",
                size=int(r.size_bytes or 0),
                sha256=r.sha256 or "",
                crs=r.crs or "EPSG:4326",
                created_at=r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at),
                node_id=r.node_id,
                metadata=meta,
            )
        )
    return results
