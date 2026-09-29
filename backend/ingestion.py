"""
Naksha 2.0 — Real File Ingestion Service
Handles actual file upload, storage, metadata extraction, and database registration.

This is the entry point for ALL real data. Every downstream phase (validation,
processing, 3D, matching, packages) reads from datasets registered here.
"""

import os
import uuid
import hashlib
import shutil
import mimetypes
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from fastapi import UploadFile

try:
    from backend.config import settings
    from backend.database import engine
except ImportError:
    from config import settings
    from database import engine

from sqlalchemy import text

# ─────────────────────────────────────────────────────────────────
# SUPPORTED FILE TYPES PER CATEGORY
# ─────────────────────────────────────────────────────────────────
CATEGORY_EXTENSIONS: Dict[str, List[str]] = {
    "CAT_01_PHOTOGRAMMETRY":    [".jpg", ".jpeg", ".tif", ".tiff", ".png", ".raw", ".dng", ".csv", ".pos", ".mrk"],
    "CAT_02_LIDAR_POINT_CLOUD": [".las", ".laz", ".e57", ".ply", ".xyz", ".pts"],
    "CAT_03_GIS_CAD":           [".shp", ".shx", ".dbf", ".prj", ".gpkg", ".geojson", ".kml", ".dwg", ".dxf", ".dgn"],
    "CAT_04_GNSS_SURVEY":       [".obs", ".nav", ".csv", ".txt", ".nmea", ".ubx", ".pos"],
    "CAT_05_DEM_ELEVATION":     [".tif", ".tiff", ".asc", ".dem", ".grd", ".xyz"],
    "CAT_06_ARCHITECTURAL_BIM": [".ifc", ".rvt", ".nwd", ".dwg"],
    "CAT_07_PROPERTY_VERTICAL_DATA": [".xlsx", ".xls", ".csv", ".pdf"],
    "CAT_08_IMAGERY_ORTHOPHOTO":[".tif", ".tiff", ".png", ".jpg", ".cog"],
    "CAT_09_PROJECT_METADATA":  [".json", ".xml", ".yaml", ".yml"],
    "CAT_10_SUPPORTING_DOCS":   [".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png"],
}

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024  # 5 GB per file


def _sha256_of_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def _get_storage_path(project_id: str, category_id: str, dataset_id: str) -> Path:
    """Returns the canonical local storage path for a dataset."""
    base = Path(settings.LOCAL_STORAGE_PATH)
    return base / project_id / category_id / dataset_id


def validate_file_extension(filename: str, category_id: str) -> tuple[bool, str]:
    """Returns (is_valid, reason)."""
    ext = Path(filename).suffix.lower()
    allowed = CATEGORY_EXTENSIONS.get(category_id, [])
    if not allowed:
        return False, f"Unknown category: {category_id}"
    if ext not in allowed:
        return False, f"Extension '{ext}' not accepted for {category_id}. Allowed: {', '.join(allowed)}"
    return True, "OK"


async def store_uploaded_files(
    project_id: str,
    category_id: str,
    dataset_name: str,
    files: List[UploadFile],
    survey_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Saves uploaded files to local storage, computes SHA-256, registers in database.
    Returns dataset metadata dict.
    """
    dataset_id = f"ds_{uuid.uuid4().hex[:12]}"
    dest_dir = _get_storage_path(project_id, category_id, dataset_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved_files = []
    total_bytes = 0
    rejected_files = []

    for upload in files:
        filename = upload.filename or "unnamed_file"
        ext = Path(filename).suffix.lower()
        allowed = CATEGORY_EXTENSIONS.get(category_id, [])

        # Extension validation
        if ext not in allowed:
            rejected_files.append({
                "filename": filename,
                "reason": f"Extension '{ext}' not accepted for {category_id}"
            })
            continue

        # Save to disk in chunks (handles large files without memory overflow)
        dest_file = dest_dir / filename
        file_size = 0
        hasher = hashlib.sha256()

        too_large = False
        try:
            with open(dest_file, "wb") as out:
                while chunk := await upload.read(65536):
                    if file_size + len(chunk) > MAX_FILE_SIZE_BYTES:
                        dest_file.unlink(missing_ok=True)
                        rejected_files.append({"filename": filename, "reason": "File exceeds 5GB limit"})
                        too_large = True
                        break
                    out.write(chunk)
                    hasher.update(chunk)
                    file_size += len(chunk)

            if not too_large:
                sha256 = hasher.hexdigest()
                mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
                saved_files.append({
                    "filename": filename,
                    "size_bytes": file_size,
                    "sha256": sha256,
                    "mime_type": mime_type,
                    "relative_path": str(dest_file.relative_to(Path(settings.LOCAL_STORAGE_PATH))),
                    "absolute_path": str(dest_file),
                })
                total_bytes += file_size
        except Exception as e:
            rejected_files.append({"filename": filename, "reason": str(e)})

    if not saved_files:
        shutil.rmtree(dest_dir, ignore_errors=True)
        return {
            "success": False,
            "dataset_id": None,
            "error": "No valid files were saved",
            "rejected": rejected_files,
        }

    # Register dataset in PostgreSQL
    now = datetime.now(timezone.utc)
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                INSERT INTO input_datasets (
                    id, project_id, survey_id, category, name,
                    status, readiness_score, total_size_bytes, file_count,
                    metadata_manifest, created_at, updated_at
                ) VALUES (
                    :id, :project_id, :survey_id, :category, :name,
                    'SCANNING', 0.0, :total_bytes, :file_count,
                    CAST(:manifest AS jsonb), :now, :now
                )
                ON CONFLICT (id) DO UPDATE SET
                    status = 'SCANNING',
                    total_size_bytes = EXCLUDED.total_size_bytes,
                    file_count = EXCLUDED.file_count,
                    updated_at = EXCLUDED.updated_at
            """), {
                "id": dataset_id,
                "project_id": project_id,
                "survey_id": survey_id,
                "category": category_id,
                "name": dataset_name,
                "total_bytes": total_bytes,
                "file_count": len(saved_files),
                "manifest": __import__("json").dumps({
                    "files": saved_files,
                    "storage_path": str(dest_dir),
                    "rejected": rejected_files,
                }),
                "now": now,
            })

            # Register each file in dataset_files table
            for f in saved_files:
                ext = Path(f["filename"]).suffix.lower()
                conn.execute(text("""
                    INSERT INTO dataset_files (
                        id, dataset_id, relative_path, file_name,
                        extension, file_role, mime_type, size_bytes,
                        sha256, s3_bucket, s3_key, is_corrupt, created_at
                    ) VALUES (
                        :id, :dataset_id, :rel_path, :filename,
                        :ext, 'RAW_DATA', :mime, :size,
                        :sha256, :bucket, :s3_key, false, :now
                    )
                """), {
                    "id": str(uuid.uuid4()),
                    "dataset_id": dataset_id,
                    "rel_path": f["relative_path"],
                    "filename": f["filename"],
                    "ext": ext,
                    "mime": f["mime_type"],
                    "size": f["size_bytes"],
                    "sha256": f["sha256"],
                    "bucket": settings.STORAGE_BUCKET,
                    "s3_key": f["relative_path"],
                    "now": now,
                })
            conn.commit()
    except Exception as db_err:
        # DB write failed, but files are saved — return partial success with warning
        return {
            "success": True,
            "dataset_id": dataset_id,
            "dataset_name": dataset_name,
            "category_id": category_id,
            "project_id": project_id,
            "storage_path": str(dest_dir),
            "files_saved": len(saved_files),
            "total_bytes": total_bytes,
            "files": saved_files,
            "rejected": rejected_files,
            "db_warning": str(db_err),
        }

    return {
        "success": True,
        "dataset_id": dataset_id,
        "dataset_name": dataset_name,
        "category_id": category_id,
        "project_id": project_id,
        "storage_path": str(dest_dir),
        "files_saved": len(saved_files),
        "total_bytes": total_bytes,
        "files": saved_files,
        "rejected": rejected_files,
    }


def get_dataset_files(dataset_id: str) -> List[Dict[str, Any]]:
    """Returns all stored files for a dataset from the database."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT file_name, file_path, file_size_bytes, mime_type, sha256_hash, created_at
                FROM dataset_files
                WHERE dataset_id = :id
                ORDER BY file_name
            """), {"id": dataset_id}).fetchall()
            return [
                {
                    "filename": r[0],
                    "path": r[1],
                    "size_bytes": r[2],
                    "mime_type": r[3],
                    "sha256": r[4],
                    "created_at": str(r[5]),
                }
                for r in rows
            ]
    except Exception as e:
        return []


def get_dataset_info(dataset_id: str) -> Optional[Dict[str, Any]]:
    """Returns dataset metadata from database."""
    try:
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT id, project_id, category, name, status,
                       readiness_score, total_size_bytes, file_count,
                       metadata_manifest, created_at, updated_at
                FROM input_datasets
                WHERE id = :id
            """), {"id": dataset_id}).fetchone()
            if not row:
                return None
            return {
                "dataset_id": str(row[0]),
                "project_id": str(row[1]),
                "category": row[2],
                "name": row[3],
                "status": str(row[4]),
                "readiness_score": float(row[5]) if row[5] else 0.0,
                "total_bytes": int(row[6]) if row[6] else 0,
                "file_count": int(row[7]) if row[7] else 0,
                "manifest": row[8],
                "created_at": str(row[9]),
                "updated_at": str(row[10]),
            }
    except Exception as e:
        return None


def list_project_datasets(project_id: str) -> List[Dict[str, Any]]:
    """Returns all datasets for a project."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT id, category, name, status, readiness_score,
                       total_size_bytes, file_count, created_at
                FROM input_datasets
                WHERE project_id = :pid
                ORDER BY created_at DESC
            """), {"pid": project_id}).fetchall()
            return [
                {
                    "dataset_id": str(r[0]),
                    "category": r[1],
                    "name": r[2],
                    "status": str(r[3]),
                    "readiness_score": float(r[4]) if r[4] else 0.0,
                    "total_bytes": int(r[5]) if r[5] else 0,
                    "file_count": int(r[6]) if r[6] else 0,
                    "created_at": str(r[7]),
                }
                for r in rows
            ]
    except Exception as e:
        return []
