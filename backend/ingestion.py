"""
Naksha 2.0 — Real File Ingestion Service
Handles actual multipart file uploads, physical storage persistence, filename sanitization,
content signature (magic bytes) validation, SHA-256 calculation, duplicate detection,
and PostgreSQL dataset_files registration.

Every uploaded file is physically saved to local storage cache and tracked in the database.
"""

import os
import re
import uuid
import json
import struct
import hashlib
import shutil
import mimetypes
from pathlib import Path
from typing import List, Optional, Dict, Any, Union, Tuple
from datetime import datetime, timezone

from fastapi import UploadFile, HTTPException

try:
    from backend.config import settings
    from backend.database import engine
except ImportError:
    from config import settings
    from database import engine

from sqlalchemy import text

# ─────────────────────────────────────────────────────────────────
# SUPPORTED 10 CATEGORIES & NORMALIZATION
# ─────────────────────────────────────────────────────────────────

CATEGORY_MAP: Dict[str, str] = {
    # Numerical ID mappings
    "1": "CAT_01_PHOTOGRAMMETRY",
    "2": "CAT_02_LIDAR_POINT_CLOUD",
    "3": "CAT_03_GIS_CAD",
    "4": "CAT_04_GNSS_SURVEY",
    "5": "CAT_05_DEM_ELEVATION",
    "6": "CAT_06_ARCHITECTURAL_BIM",
    "7": "CAT_07_PROPERTY_VERTICAL_DATA",
    "8": "CAT_08_IMAGERY_ORTHOPHOTO",
    "9": "CAT_09_PROJECT_METADATA",
    "10": "CAT_10_SUPPORTING_DOCS",
    # Exact enum identifiers
    "CAT_01_PHOTOGRAMMETRY": "CAT_01_PHOTOGRAMMETRY",
    "CAT_02_LIDAR_POINT_CLOUD": "CAT_02_LIDAR_POINT_CLOUD",
    "CAT_03_GIS_CAD": "CAT_03_GIS_CAD",
    "CAT_04_GNSS_SURVEY": "CAT_04_GNSS_SURVEY",
    "CAT_05_DEM_ELEVATION": "CAT_05_DEM_ELEVATION",
    "CAT_06_ARCHITECTURAL_BIM": "CAT_06_ARCHITECTURAL_BIM",
    "CAT_07_PROPERTY_VERTICAL_DATA": "CAT_07_PROPERTY_VERTICAL_DATA",
    "CAT_08_IMAGERY_ORTHOPHOTO": "CAT_08_IMAGERY_ORTHOPHOTO",
    "CAT_09_PROJECT_METADATA": "CAT_09_PROJECT_METADATA",
    "CAT_10_SUPPORTING_DOCS": "CAT_10_SUPPORTING_DOCS",
    # Friendly names & aliases (case-insensitive)
    "photogrammetry": "CAT_01_PHOTOGRAMMETRY",
    "aerial": "CAT_01_PHOTOGRAMMETRY",
    "drone": "CAT_01_PHOTOGRAMMETRY",
    "lidar": "CAT_02_LIDAR_POINT_CLOUD",
    "point cloud": "CAT_02_LIDAR_POINT_CLOUD",
    "pointcloud": "CAT_02_LIDAR_POINT_CLOUD",
    "gis": "CAT_03_GIS_CAD",
    "cad": "CAT_03_GIS_CAD",
    "gis / cad": "CAT_03_GIS_CAD",
    "gis/cad": "CAT_03_GIS_CAD",
    "vector": "CAT_03_GIS_CAD",
    "gnss": "CAT_04_GNSS_SURVEY",
    "survey": "CAT_04_GNSS_SURVEY",
    "gnss / survey": "CAT_04_GNSS_SURVEY",
    "gnss/survey": "CAT_04_GNSS_SURVEY",
    "dem": "CAT_05_DEM_ELEVATION",
    "elevation": "CAT_05_DEM_ELEVATION",
    "dem / elevation": "CAT_05_DEM_ELEVATION",
    "dem/elevation": "CAT_05_DEM_ELEVATION",
    "dtm": "CAT_05_DEM_ELEVATION",
    "dsm": "CAT_05_DEM_ELEVATION",
    "architectural": "CAT_06_ARCHITECTURAL_BIM",
    "bim": "CAT_06_ARCHITECTURAL_BIM",
    "architectural / bim": "CAT_06_ARCHITECTURAL_BIM",
    "architectural/bim": "CAT_06_ARCHITECTURAL_BIM",
    "property": "CAT_07_PROPERTY_VERTICAL_DATA",
    "vertical data": "CAT_07_PROPERTY_VERTICAL_DATA",
    "property & vertical data": "CAT_07_PROPERTY_VERTICAL_DATA",
    "property and vertical data": "CAT_07_PROPERTY_VERTICAL_DATA",
    "property/vertical data": "CAT_07_PROPERTY_VERTICAL_DATA",
    "imagery": "CAT_08_IMAGERY_ORTHOPHOTO",
    "orthophoto": "CAT_08_IMAGERY_ORTHOPHOTO",
    "orthomosaic": "CAT_08_IMAGERY_ORTHOPHOTO",
    "imagery / orthophoto": "CAT_08_IMAGERY_ORTHOPHOTO",
    "imagery/orthophoto": "CAT_08_IMAGERY_ORTHOPHOTO",
    "project": "CAT_09_PROJECT_METADATA",
    "metadata": "CAT_09_PROJECT_METADATA",
    "project / metadata": "CAT_09_PROJECT_METADATA",
    "project/metadata": "CAT_09_PROJECT_METADATA",
    "supporting": "CAT_10_SUPPORTING_DOCS",
    "documents": "CAT_10_SUPPORTING_DOCS",
    "supporting docs": "CAT_10_SUPPORTING_DOCS",
    "supporting documents": "CAT_10_SUPPORTING_DOCS",
}

CATEGORY_NAMES: Dict[str, str] = {
    "CAT_01_PHOTOGRAMMETRY": "Photogrammetry",
    "CAT_02_LIDAR_POINT_CLOUD": "LiDAR / Point Cloud",
    "CAT_03_GIS_CAD": "GIS / CAD",
    "CAT_04_GNSS_SURVEY": "GNSS / Survey",
    "CAT_05_DEM_ELEVATION": "DEM / Elevation",
    "CAT_06_ARCHITECTURAL_BIM": "Architectural / BIM",
    "CAT_07_PROPERTY_VERTICAL_DATA": "Property & Vertical Data",
    "CAT_08_IMAGERY_ORTHOPHOTO": "Imagery / Orthophoto",
    "CAT_09_PROJECT_METADATA": "Project / Metadata",
    "CAT_10_SUPPORTING_DOCS": "Supporting Documents",
}

def normalize_category(category_input: Union[int, str]) -> str:
    """
    Normalizes any category representation (e.g. 1, '1', 'LiDAR', 'CAT_02_LIDAR_POINT_CLOUD')
    into the canonical input_category_enum string.
    """
    if category_input is None:
        raise HTTPException(status_code=400, detail="Category ID is required")
    raw = str(category_input).strip()
    # Check direct match
    if raw in CATEGORY_MAP:
        return CATEGORY_MAP[raw]
    # Check lowercase match
    lower_raw = raw.lower()
    if lower_raw in CATEGORY_MAP:
        return CATEGORY_MAP[lower_raw]
    
    # Check numeric prefix or enum prefix
    clean_cat = re.sub(r'[^a-zA-Z0-9]', '', raw).upper()
    for k, v in CATEGORY_MAP.items():
        if re.sub(r'[^a-zA-Z0-9]', '', k).upper() == clean_cat:
            return v

    valid_opts = ", ".join([f"{i} ({name})" for i, name in enumerate(CATEGORY_NAMES.values(), 1)])
    raise HTTPException(
        status_code=400,
        detail=f"Invalid category '{category_input}'. Allowed categories: {valid_opts}"
    )


# ─────────────────────────────────────────────────────────────────
# SUPPORTED FILE EXTENSIONS PER CATEGORY
# ─────────────────────────────────────────────────────────────────

CATEGORY_EXTENSIONS: Dict[str, List[str]] = {
    "CAT_01_PHOTOGRAMMETRY":    [".jpg", ".jpeg", ".tif", ".tiff", ".png", ".raw", ".dng", ".csv", ".pos", ".mrk"],
    "CAT_02_LIDAR_POINT_CLOUD": [".las", ".laz", ".e57", ".ply", ".xyz", ".pts"],
    "CAT_03_GIS_CAD":           [".shp", ".shx", ".dbf", ".prj", ".gpkg", ".geojson", ".json", ".kml", ".kmz", ".dwg", ".dxf", ".dgn", ".zip", ".csv"],
    "CAT_04_GNSS_SURVEY":       [".obs", ".nav", ".csv", ".txt", ".nmea", ".ubx", ".pos", ".rinex", ".21o", ".22o", ".23o", ".24o"],
    "CAT_05_DEM_ELEVATION":     [".tif", ".tiff", ".asc", ".dem", ".grd", ".xyz", ".hgt", ".img"],
    "CAT_06_ARCHITECTURAL_BIM": [".ifc", ".rvt", ".nwd", ".dwg", ".dxf", ".skp"],
    "CAT_07_PROPERTY_VERTICAL_DATA": [".xlsx", ".xls", ".csv", ".pdf", ".json", ".tsv"],
    "CAT_08_IMAGERY_ORTHOPHOTO":[".tif", ".tiff", ".png", ".jpg", ".jpeg", ".cog", ".ecw", ".jp2"],
    "CAT_09_PROJECT_METADATA":  [".json", ".xml", ".yaml", ".yml", ".txt", ".csv"],
    "CAT_10_SUPPORTING_DOCS":   [".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png", ".txt", ".xlsx", ".zip"],
}

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024  # 5 GB per file limit


# ─────────────────────────────────────────────────────────────────
# FILENAME SANITIZATION & PATH RESOLUTION
# ─────────────────────────────────────────────────────────────────

def sanitize_filename(raw_filename: str) -> str:
    """
    Sanitizes filename against path traversal, control chars, null bytes,
    and OS-illegal characters.
    """
    if not raw_filename:
        return f"upload_{uuid.uuid4().hex[:8]}.bin"

    # Extract basename only (removes leading directories / traversal like ../../)
    base = Path(raw_filename).name
    # Strip cross-platform slashes
    base = base.split("/")[-1].split("\\")[-1]
    # Remove null bytes
    base = base.replace("\x00", "")
    # Remove excessive dots
    base = re.sub(r'\.{2,}', '.', base)
    # Replace illegal filesystem chars (Windows: <>:"/\|?* and control codes)
    base = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', '_', base)
    # Strip leading/trailing dots and whitespace
    base = base.strip(". ")

    if not base:
        base = f"upload_{uuid.uuid4().hex[:8]}.bin"

    return base


def _get_storage_path(project_id: str, category_id: str, dataset_id: str) -> Path:
    """Returns canonical local storage path on disk."""
    base = Path(settings.LOCAL_STORAGE_PATH).resolve()
    return base / str(project_id) / str(category_id) / str(dataset_id)


def validate_file_extension(filename: str, category_enum: str) -> Tuple[bool, str]:
    """Returns (is_valid, reason)."""
    ext = Path(filename).suffix.lower()
    allowed = CATEGORY_EXTENSIONS.get(category_enum, [])
    if not allowed:
        return False, f"Unknown category: {category_enum}"
    if ext not in allowed:
        return False, f"Extension '{ext}' not accepted for {category_enum}. Allowed: {', '.join(allowed)}"
    return True, "OK"


# ─────────────────────────────────────────────────────────────────
# MIME & CONTENT SIGNATURE (MAGIC BYTES) VALIDATION
# ─────────────────────────────────────────────────────────────────

def validate_content_signature(head: bytes, ext: str) -> Tuple[bool, str, str]:
    """
    Validates magic bytes / content signature from the first chunk of the file.
    Returns: (is_valid, detected_mime, details)
    """
    ext = ext.lower()

    # 1. Images
    if ext in ('.jpg', '.jpeg'):
        if len(head) >= 3 and head[:3] == b'\xff\xd8\xff':
            return True, "image/jpeg", "Valid JPEG SOI marker"
        return False, "unknown", "Corrupted or invalid JPEG (missing FF D8 FF marker)"

    if ext == '.png':
        if len(head) >= 8 and head[:8] == b'\x89PNG\r\n\x1a\n':
            return True, "image/png", "Valid PNG header"
        return False, "unknown", "Invalid PNG magic signature"

    if ext in ('.tif', '.tiff', '.cog', '.dem'):
        if len(head) >= 4:
            # Little endian (II*\0), Big endian (MM\0*), BigTIFF (II+\0 or MM\0+)
            if head[:4] in (b'II*\x00', b'MM\x00*', b'II\x2b\x00', b'MM\x00\x2b'):
                return True, "image/tiff", "Valid TIFF/GeoTIFF header"
        return False, "unknown", "Invalid TIFF/GeoTIFF byte order marker"

    # 2. Point Clouds
    if ext in ('.las', '.laz'):
        if len(head) >= 4 and head[:4] == b'LASF':
            return True, "application/vnd.las", "Valid ASPRS LAS/LAZ signature"
        return False, "unknown", "Invalid LAS/LAZ file: missing 'LASF' signature"

    # 3. Documents
    if ext == '.pdf':
        if len(head) >= 4 and head[:4] == b'%PDF':
            return True, "application/pdf", "Valid PDF header"
        return False, "unknown", "Invalid PDF magic signature"

    # 4. ZIP Containers (ZIP, Shapefile ZIP, KMZ, DOCX, XLSX)
    if ext in ('.zip', '.kmz', '.docx', '.xlsx'):
        if len(head) >= 4 and head[:4] in (b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08'):
            return True, "application/zip", "Valid ZIP container signature"
        return False, "unknown", "Invalid ZIP/archive signature"

    # 5. GeoPackage SQLite
    if ext == '.gpkg':
        if len(head) >= 16 and head[:16] == b'SQLite format 3\x00':
            return True, "application/geopackage+sqlite3", "Valid GeoPackage SQLite header"
        return False, "unknown", "Invalid GeoPackage signature (not a SQLite database)"

    # 6. JSON / GeoJSON
    if ext in ('.json', '.geojson'):
        try:
            head_str = head.decode('utf-8-sig', errors='ignore').strip()
            if head_str.startswith('{') or head_str.startswith('['):
                mime = "application/geo+json" if ext == '.geojson' else "application/json"
                return True, mime, "Valid JSON structure"
            return False, "unknown", "Invalid JSON/GeoJSON content: does not start with '{' or '['"
        except Exception as e:
            return False, "unknown", f"JSON decode error: {e}"

    # 7. Tabular / GNSS / Plain text
    if ext in ('.csv', '.txt', '.obs', '.nav', '.nmea', '.pos', '.asc', '.xyz', '.pts', '.rinex', '.tsv'):
        # Check for excessive binary null bytes
        if b'\x00' in head[:256]:
            return False, "unknown", "Binary data detected in text file"
        try:
            head[:512].decode('utf-8')
            mime = "text/csv" if ext == '.csv' else "text/plain"
            return True, mime, "Valid UTF-8 text structure"
        except UnicodeDecodeError:
            try:
                head[:512].decode('latin-1')
                return True, "text/plain", "Valid Latin-1 text structure"
            except Exception:
                return False, "unknown", "Unreadable text encoding"

    # 8. XML / KML
    if ext in ('.xml', '.kml'):
        head_str = head.decode('utf-8', errors='ignore').strip()
        if head_str.startswith('<?xml') or head_str.startswith('<'):
            mime = "application/vnd.google-earth.kml+xml" if ext == '.kml' else "application/xml"
            return True, mime, "Valid XML markup"
        return False, "unknown", "Invalid XML markup"

    # 9. BIM / CAD (IFC, DXF, Shapefiles)
    if ext == '.ifc':
        head_str = head.decode('utf-8', errors='ignore')
        if 'ISO-10303-21;' in head_str or 'HEADER;' in head_str:
            return True, "application/x-step", "Valid STEP/IFC header"
        return False, "unknown", "Missing IFC/STEP marker"

    if ext == '.dxf':
        head_str = head.decode('utf-8', errors='ignore')
        if 'SECTION' in head_str or 'HEADER' in head_str or head_str.strip().startswith('0'):
            return True, "application/dxf", "Valid DXF header"
        return False, "unknown", "Missing DXF header"

    if ext in ('.shp', '.shx'):
        if len(head) >= 4:
            file_code = struct.unpack('>I', head[:4])[0]
            if file_code == 9994:
                return True, "application/x-shapefile", "Valid ESRI shapefile code 9994"
        return True, "application/octet-stream", "Shapefile index/binary component"

    if ext == '.dbf':
        if len(head) >= 1 and head[0] in (0x02, 0x03, 0x04, 0x05, 0x30, 0x31, 0x83, 0x8B, 0xF5):
            return True, "application/x-dbase", "Valid dBASE table marker"
        return True, "application/x-dbase", "Generic DBF format"

    # Fallback to standard mime detection for any other accepted extension
    guessed, _ = mimetypes.guess_type("file" + ext)
    return True, guessed or "application/octet-stream", "Accepted format"


# ─────────────────────────────────────────────────────────────────
# CORE INGESTION & STORAGE ENGINE
# ─────────────────────────────────────────────────────────────────

async def store_uploaded_files(
    project_id: str,
    category_id: Union[int, str],
    files: List[UploadFile],
    dataset_name: Optional[str] = None,
    dataset_id: Optional[str] = None,
    survey_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Real file upload handler.
    1. Validates project existence in PostgreSQL projects table.
    2. Normalizes category to input_category_enum.
    3. Streams file chunks to disk (handles large multi-GB files without RAM exhaustion).
    4. Enforces file size limits (5GB) and non-zero validation.
    5. Sanitizes filenames against path traversal.
    6. Validates extensions and content signatures (magic bytes).
    7. Computes SHA-256 continuously.
    8. Detects duplicates against dataset_files in PostgreSQL.
    9. Persists records in input_datasets and dataset_files.
    10. Returns structured file_id, dataset_id, filename, size, SHA256, category,
        storage location, and upload status.
    """
    category_enum = normalize_category(category_id)

    if not files:
        raise HTTPException(status_code=400, detail="No files provided for upload")

    # 1. Verify project exists in database
    with engine.connect() as conn:
        proj_row = conn.execute(
            text("SELECT id, title FROM projects WHERE id = :id"),
            {"id": project_id}
        ).fetchone()
        if not proj_row:
            raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found in database")

    # 2. Setup dataset identifiers & storage directory
    if not dataset_id:
        dataset_id = str(uuid.uuid4())

    now = datetime.now(timezone.utc)
    if not dataset_name:
        friendly = CATEGORY_NAMES.get(category_enum, "Dataset")
        dataset_name = f"{friendly}_{now.strftime('%Y%m%d_%H%M%S')}"

    dest_dir = _get_storage_path(project_id, category_enum, dataset_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved_files: List[Dict[str, Any]] = []
    rejected_files: List[Dict[str, Any]] = []
    total_bytes = 0

    for upload in files:
        raw_filename = upload.filename or "unnamed_file"
        sanitized_name = sanitize_filename(raw_filename)
        ext = Path(sanitized_name).suffix.lower()

        # A. Extension validation
        is_ext_valid, ext_reason = validate_file_extension(sanitized_name, category_enum)
        if not is_ext_valid:
            rejected_files.append({
                "filename": raw_filename,
                "sanitized_name": sanitized_name,
                "reason": ext_reason,
            })
            continue

        # B. Stream chunks to physical disk and calculate SHA-256
        dest_file = dest_dir / sanitized_name
        hasher = hashlib.sha256()
        file_size = 0
        header_bytes = b""
        too_large = False

        try:
            with open(dest_file, "wb") as out_fp:
                # 64KB chunks for smooth streaming and low memory footprint
                while chunk := await upload.read(65536):
                    if not header_bytes:
                        header_bytes = chunk[:1024]
                    file_size += len(chunk)
                    if file_size > MAX_FILE_SIZE_BYTES:
                        too_large = True
                        break
                    hasher.update(chunk)
                    out_fp.write(chunk)

            if too_large:
                dest_file.unlink(missing_ok=True)
                rejected_files.append({
                    "filename": raw_filename,
                    "sanitized_name": sanitized_name,
                    "reason": f"File exceeds maximum allowed size of 5 GB",
                })
                continue

            if file_size == 0:
                dest_file.unlink(missing_ok=True)
                rejected_files.append({
                    "filename": raw_filename,
                    "sanitized_name": sanitized_name,
                    "reason": "File is empty (0 bytes)",
                })
                continue

            # C. Content Signature (Magic Bytes) Validation
            is_sig_valid, detected_mime, sig_msg = validate_content_signature(header_bytes, ext)
            if not is_sig_valid:
                dest_file.unlink(missing_ok=True)
                rejected_files.append({
                    "filename": raw_filename,
                    "sanitized_name": sanitized_name,
                    "reason": f"Signature validation failed: {sig_msg}",
                })
                continue

            sha256_hex = hasher.hexdigest()
            abs_location = str(dest_file.resolve())
            try:
                rel_path = str(dest_file.relative_to(Path(settings.LOCAL_STORAGE_PATH).resolve()))
            except ValueError:
                rel_path = f"{project_id}/{category_enum}/{dataset_id}/{sanitized_name}"

            # D. Duplicate Detection in PostgreSQL
            with engine.connect() as conn:
                dup_row = conn.execute(text("""
                    SELECT df.id, df.dataset_id, df.file_name, df.size_bytes, df.relative_path
                    FROM dataset_files df
                    JOIN input_datasets ds ON df.dataset_id = ds.id
                    WHERE df.sha256 = :sha256 AND ds.project_id = :project_id
                    LIMIT 1
                """), {"sha256": sha256_hex, "project_id": project_id}).fetchone()

            is_duplicate = dup_row is not None
            upload_status = "DUPLICATE" if is_duplicate else "UPLOADED"

            file_id = str(uuid.uuid4())

            saved_files.append({
                "file_id": file_id,
                "dataset_id": dataset_id,
                "filename": sanitized_name,
                "raw_filename": raw_filename,
                "size": file_size,
                "size_bytes": file_size,
                "SHA256": sha256_hex,
                "sha256": sha256_hex,
                "category": category_enum,
                "storage_location": abs_location,
                "storage location": abs_location,
                "relative_path": rel_path,
                "upload_status": upload_status,
                "upload status": upload_status,
                "mime_type": detected_mime,
                "is_duplicate": is_duplicate,
                "is_corrupt": False,
                "duplicate_of": str(dup_row[0]) if dup_row else None,
            })
            total_bytes += file_size

        except Exception as e:
            dest_file.unlink(missing_ok=True)
            rejected_files.append({
                "filename": raw_filename,
                "sanitized_name": sanitized_name,
                "reason": f"Upload I/O error: {str(e)}",
            })

    if not saved_files:
        # Clean up empty dataset directory
        shutil.rmtree(dest_dir, ignore_errors=True)
        reasons = "; ".join([f"{r['filename']}: {r['reason']}" for r in rejected_files])
        raise HTTPException(
            status_code=400,
            detail=f"No valid files could be uploaded. Errors: {reasons or 'Empty batch'}"
        )

    # 3. Create or update input_datasets record in PostgreSQL
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
                total_size_bytes = input_datasets.total_size_bytes + EXCLUDED.total_size_bytes,
                file_count = input_datasets.file_count + EXCLUDED.file_count,
                updated_at = EXCLUDED.updated_at;
        """), {
            "id": dataset_id,
            "project_id": project_id,
            "survey_id": survey_id,
            "category": category_enum,
            "name": dataset_name,
            "total_bytes": total_bytes,
            "file_count": len(saved_files),
            "manifest": json.dumps({
                "category": category_enum,
                "files_count": len(saved_files),
                "rejected_count": len(rejected_files),
                "storage_directory": str(dest_dir.resolve()),
                "created_at": now.isoformat(),
            }),
            "now": now,
        })

        # 4. Insert dataset_files records
        for f in saved_files:
            ext_val = Path(f["filename"]).suffix.lower()
            conn.execute(text("""
                INSERT INTO dataset_files (
                    id, dataset_id, relative_path, file_name,
                    extension, file_role, mime_type, size_bytes,
                    sha256, s3_bucket, s3_key, is_corrupt, created_at
                ) VALUES (
                    :id, :dataset_id, :rel_path, :filename,
                    :ext, 'RAW_DATA', :mime, :size,
                    :sha256, :bucket, :s3_key, :is_corrupt, :now
                );
            """), {
                "id": f["file_id"],
                "dataset_id": dataset_id,
                "rel_path": f["relative_path"],
                "filename": f["filename"],
                "ext": ext_val,
                "mime": f["mime_type"],
                "size": f["size_bytes"],
                "sha256": f["sha256"],
                "bucket": settings.STORAGE_BUCKET,
                "s3_key": f["relative_path"],
                "is_corrupt": f["is_corrupt"],
                "now": now,
            })
        conn.commit()

    # Form structured response meeting all exact criteria
    first_file = saved_files[0]
    return {
        "success": True,
        # Direct return fields required by spec
        "file_id": first_file["file_id"],
        "dataset_id": dataset_id,
        "filename": first_file["filename"],
        "size": first_file["size"],
        "SHA256": first_file["SHA256"],
        "sha256": first_file["sha256"],
        "category": category_enum,
        "storage_location": first_file["storage_location"],
        "storage location": first_file["storage location"],
        "upload_status": first_file["upload_status"],
        "upload status": first_file["upload status"],
        # Multi-file batch properties
        "files": saved_files,
        "files_saved": len(saved_files),
        "total_bytes": total_bytes,
        "rejected": rejected_files,
        "dataset_name": dataset_name,
        "project_id": project_id,
    }


def get_dataset_files(dataset_id: str) -> List[Dict[str, Any]]:
    """Returns all stored files for a dataset from the database."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT id, file_name, relative_path, size_bytes, mime_type, sha256, is_corrupt, created_at
                FROM dataset_files
                WHERE dataset_id = :id
                ORDER BY file_name;
            """), {"id": dataset_id}).fetchall()
            return [
                {
                    "file_id": str(r[0]),
                    "filename": r[1],
                    "path": r[2],
                    "size_bytes": r[3],
                    "mime_type": r[4],
                    "sha256": r[5],
                    "is_corrupt": r[6],
                    "created_at": str(r[7]),
                }
                for r in rows
            ]
    except Exception:
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
                WHERE id = :id;
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
    except Exception:
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
                ORDER BY created_at DESC;
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
    except Exception:
        return []
