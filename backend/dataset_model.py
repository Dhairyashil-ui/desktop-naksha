"""
Naksha 2.0 — Real Dataset & Multi-File Grouping Model
Implements true Project → Dataset → Dataset Files relational hierarchy.

Key Principles:
- A Dataset groups multiple files within an input category.
- One category can contain multiple files (e.g. Photogrammetry contains images, camera.csv, trajectory.csv).
- Do not treat one file as one dataset.
- A dataset must have:
    - dataset_id
    - project_id
    - category
    - status
    - completeness
    - quality
    - metadata
    - validation_status
    - files (collection of dataset_files)
"""

import os
import uuid
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from pydantic import BaseModel, Field

try:
    from backend.config import settings
    from backend.database import engine
except ImportError:
    from config import settings
    from database import engine

from sqlalchemy import text


# ─────────────────────────────────────────────────────────────────
# PYDANTIC CANONICAL MODELS
# ─────────────────────────────────────────────────────────────────

class DatasetFileModel(BaseModel):
    """
    Child file entity belonging to a parent Dataset.
    """
    file_id: str
    dataset_id: str
    filename: str
    extension: str
    file_role: str = "RAW_DATA"
    mime_type: str
    size_bytes: int
    size: Optional[int] = None
    sha256: str
    SHA256: Optional[str] = None
    storage_location: Optional[str] = None
    relative_path: Optional[str] = None
    upload_status: Optional[str] = "UPLOADED"
    is_corrupt: bool = False
    created_at: str

    def __init__(self, **data):
        if "size" not in data and "size_bytes" in data:
            data["size"] = data["size_bytes"]
        elif "size_bytes" not in data and "size" in data:
            data["size_bytes"] = data["size"]
        if "SHA256" not in data and "sha256" in data:
            data["SHA256"] = data["sha256"]
        if "upload_status" not in data:
            data["upload_status"] = "UPLOADED"
        super().__init__(**data)


class DatasetModel(BaseModel):
    """
    Parent Dataset grouping multiple files for a Project and Category.
    """
    dataset_id: str
    project_id: str
    category: str
    name: str
    status: str
    completeness: float = Field(0.0, description="0-100 completeness score based on required file composition")
    quality: float = Field(0.0, description="0-100 quality score based on header validity and integrity")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Dataset metadata and manifest breakdown")
    validation_status: str = Field("PENDING", description="Validation status: PENDING, VALID, PARTIAL, WARNING, INVALID")
    file_count: int = 0
    total_size_bytes: int = 0
    files: List[DatasetFileModel] = Field(default_factory=list)
    created_at: str
    updated_at: str


# ─────────────────────────────────────────────────────────────────
# FILE ROLE INFERENCE
# ─────────────────────────────────────────────────────────────────

def infer_file_role(filename: str, category_enum: str, mime_type: str = "") -> str:
    """
    Infers the semantic role of a file within its parent category dataset.
    Example: camera.csv -> CAMERA_CALIBRATION, trajectory.csv -> TRAJECTORY_DATA
    """
    name_lower = filename.lower()
    ext = Path(filename).suffix.lower()

    # 1. Photogrammetry
    if category_enum == "CAT_01_PHOTOGRAMMETRY":
        if any(k in name_lower for k in ("camera", "calib", "lens", "interior_orientation")):
            return "CAMERA_CALIBRATION"
        if any(k in name_lower for k in ("trajectory", "pos", "flight", "nav", "mrk", "exterior")):
            return "TRAJECTORY_DATA"
        if any(k in name_lower for k in ("gcp", "control", "target", "tie_point")):
            return "GROUND_CONTROL_POINTS"
        if ext in (".jpg", ".jpeg", ".tif", ".tiff", ".png", ".raw", ".dng"):
            return "AERIAL_IMAGE"
        if ext in (".csv", ".txt", ".tsv"):
            return "COORDINATE_TABLE"
        return "PHOTOGRAMMETRY_AUX"

    # 2. LiDAR / Point Cloud
    if category_enum == "CAT_02_LIDAR_POINT_CLOUD":
        if ext in (".las", ".laz"):
            return "POINT_CLOUD_LAS"
        if ext in (".e57", ".ply", ".xyz", ".pts"):
            return "POINT_CLOUD_GENERIC"
        if any(k in name_lower for k in ("trajectory", "pos", "flight")):
            return "SCANNER_TRAJECTORY"
        if any(k in name_lower for k in ("gcp", "control", "benchmark")):
            return "SURVEY_CONTROL"
        return "LIDAR_AUX"

    # 3. GIS / CAD
    if category_enum == "CAT_03_GIS_CAD":
        if ext == ".shp":
            return "SHAPEFILE_GEOMETRY"
        if ext == ".shx":
            return "SHAPEFILE_INDEX"
        if ext == ".dbf":
            return "SHAPEFILE_ATTRIBUTES"
        if ext == ".prj":
            return "SHAPEFILE_PROJECTION"
        if ext == ".gpkg":
            return "GEOPACKAGE_CONTAINER"
        if ext in (".geojson", ".json"):
            return "GEOJSON_VECTOR"
        if ext in (".kml", ".kmz"):
            return "KML_BOUNDARY"
        if ext in (".dxf", ".dwg", ".dgn"):
            return "CAD_DRAWING"
        if ext == ".csv":
            return "CADASTRE_COORDINATES"
        return "GIS_CAD_AUX"

    # 4. GNSS / Survey
    if category_enum == "CAT_04_GNSS_SURVEY":
        if ext == ".obs" or (len(ext) == 4 and ext.endswith("o")):
            return "RINEX_OBSERVATION"
        if ext == ".nav" or (len(ext) == 4 and ext.endswith("n")):
            return "RINEX_NAVIGATION"
        if ext == ".ubx":
            return "UBLOX_BINARY_LOG"
        if ext in (".nmea", ".pos"):
            return "GNSS_SOLUTION"
        if ext in (".csv", ".txt"):
            return "CONTROL_POINT_TABLE"
        return "GNSS_SURVEY_AUX"

    # 5. DEM / Elevation
    if category_enum == "CAT_05_DEM_ELEVATION":
        if ext in (".tif", ".tiff", ".dem"):
            return "DEM_RASTER"
        if ext in (".asc", ".grd", ".xyz", ".hgt"):
            return "ELEVATION_GRID"
        return "DEM_AUX"

    # 6. Architectural / BIM
    if category_enum == "CAT_06_ARCHITECTURAL_BIM":
        if ext == ".ifc":
            return "BIM_IFC_MODEL"
        if ext in (".rvt", ".nwd", ".dwg", ".dxf", ".skp"):
            return "CAD_BIM_DESIGN"
        return "BIM_AUX"

    # 7. Property & Vertical Data
    if category_enum == "CAT_07_PROPERTY_VERTICAL_DATA":
        if any(k in name_lower for k in ("ror", "7_12", "satbara", "extract", "khata", "land_record")):
            return "ROR_LAND_REGISTRY"
        if any(k in name_lower for k in ("unit", "flat", "strata", "floor", "cadastre", "apartment")):
            return "PROPERTY_UNITS_DATA"
        if any(k in name_lower for k in ("property_card", "prcard", "card")):
            return "PROPERTY_CARD"
        return "PROPERTY_RECORD"

    # 8. Imagery / Orthophoto
    if category_enum == "CAT_08_IMAGERY_ORTHOPHOTO":
        if ext in (".tif", ".tiff", ".cog"):
            return "ORTHOMOSAIC_RASTER"
        return "IMAGERY_AUX"

    # 9. Project / Metadata
    if category_enum == "CAT_09_PROJECT_METADATA":
        return "PROJECT_METADATA_MANIFEST"

    # 10. Supporting Documents
    return "SUPPORTING_DOCUMENT"


# ─────────────────────────────────────────────────────────────────
# MULTI-FILE DATASET COMPLETENESS & QUALITY EVALUATOR
# ─────────────────────────────────────────────────────────────────

def compute_dataset_metrics(
    category_enum: str,
    files: List[Dict[str, Any]]
) -> Tuple[float, float, str, str, Dict[str, Any]]:
    """
    Computes real completeness and quality scores for a dataset based on
    the combination of files present.
    Returns: (completeness, quality, status, validation_status, metadata_summary)
    """
    if not files:
        return 0.0, 0.0, "MISSING", "PENDING", {"file_count": 0}

    total_files = len(files)
    corrupt_count = sum(1 for f in files if f.get("is_corrupt", False))
    clean_count = total_files - corrupt_count

    # Base quality from uncorrupted file ratio
    quality = round((clean_count / total_files) * 100.0, 2)

    roles = [f.get("file_role", "") for f in files]
    exts = [Path(f.get("filename", "")).suffix.lower() for f in files]

    completeness = 0.0
    breakdown: Dict[str, Any] = {
        "files_count": total_files,
        "clean_files": clean_count,
        "roles": list(set(roles)),
    }

    # 1. Photogrammetry: Multiple images + optional camera calibration + optional trajectory
    if category_enum == "CAT_01_PHOTOGRAMMETRY":
        image_count = sum(1 for r in roles if r == "AERIAL_IMAGE")
        has_camera = any(r == "CAMERA_CALIBRATION" for r in roles)
        has_trajectory = any(r in ("TRAJECTORY_DATA", "GROUND_CONTROL_POINTS") for r in roles)

        breakdown["image_count"] = image_count
        breakdown["has_camera_calibration"] = has_camera
        breakdown["has_trajectory_data"] = has_trajectory

        if image_count > 0:
            completeness += 60.0
            if image_count >= 5:
                completeness += 15.0
            elif image_count >= 2:
                completeness += 10.0
        if has_camera:
            completeness += 15.0
        if has_trajectory:
            completeness += 10.0

    # 2. LiDAR: Point cloud + scanner trajectory/GCP
    elif category_enum == "CAT_02_LIDAR_POINT_CLOUD":
        pc_count = sum(1 for r in roles if "POINT_CLOUD" in r)
        has_traj = any(r in ("SCANNER_TRAJECTORY", "SURVEY_CONTROL") for r in roles)
        breakdown["point_cloud_files"] = pc_count
        breakdown["has_trajectory_or_control"] = has_traj

        if pc_count > 0:
            completeness += 75.0
        if has_traj:
            completeness += 25.0
        elif pc_count > 1:
            completeness += 15.0

    # 3. GIS / CAD: Multi-part shapefile (.shp + .shx + .dbf + .prj) or container
    elif category_enum == "CAT_03_GIS_CAD":
        has_shp = ".shp" in exts
        has_shx = ".shx" in exts
        has_dbf = ".dbf" in exts
        has_prj = ".prj" in exts
        has_gpkg = ".gpkg" in exts
        has_geojson = any(e in (".geojson", ".json") for e in exts)

        breakdown["is_shapefile_bundle"] = has_shp
        if has_shp:
            completeness += 40.0
            if has_shx: completeness += 20.0
            if has_dbf: completeness += 20.0
            if has_prj: completeness += 20.0
        elif has_gpkg or has_geojson:
            completeness = 100.0
        else:
            completeness = min(100.0, total_files * 35.0)

    # 4. GNSS: Observations + navigation or coordinates
    elif category_enum == "CAT_04_GNSS_SURVEY":
        has_obs = any("OBSERVATION" in r for r in roles)
        has_nav = any("NAVIGATION" in r for r in roles)
        has_coords = any(r == "CONTROL_POINT_TABLE" for r in roles)

        if has_obs: completeness += 60.0
        if has_nav: completeness += 30.0
        if has_coords: completeness += 20.0
        if completeness == 0:
            completeness = min(100.0, total_files * 40.0)

    # Other categories default calculation
    else:
        completeness = min(100.0, total_files * 50.0)

    completeness = min(100.0, round(completeness, 2))

    # Derive validation_status and canonical dataset_status
    if corrupt_count > 0 and clean_count == 0:
        validation_status = "INVALID"
        status = "INVALID"
    elif completeness >= 80.0 and quality >= 75.0:
        validation_status = "PASSED"
        status = "VALID"
    elif completeness >= 40.0:
        validation_status = "PARTIAL"
        status = "PARTIAL"
    else:
        validation_status = "WARNING"
        status = "PARTIAL"

    return completeness, quality, status, validation_status, breakdown


# ─────────────────────────────────────────────────────────────────
# DATASET GROUPING REPOSITORY
# ─────────────────────────────────────────────────────────────────

def get_or_create_project_dataset(
    project_id: str,
    category_enum: str,
    dataset_name: Optional[str] = None
) -> str:
    """
    Finds existing dataset for (project_id, category_enum) or creates a new one.
    Guarantees files for a category are grouped into one parent Dataset.
    """
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT id FROM input_datasets
            WHERE project_id = :project_id AND category = :category
            ORDER BY created_at ASC
            LIMIT 1;
        """), {"project_id": project_id, "category": category_enum}).fetchone()

        if row:
            return str(row[0])

        new_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        name = dataset_name or f"{category_enum}_{now.strftime('%Y%m%d_%H%M%S')}"

        conn.execute(text("""
            INSERT INTO input_datasets (
                id, project_id, category, name,
                status, completeness, quality, validation_status,
                total_size_bytes, file_count, metadata_manifest,
                created_at, updated_at
            ) VALUES (
                :id, :project_id, :category, :name,
                'SCANNING', 0.0, 100.0, 'PENDING',
                0, 0, '{}'::jsonb,
                :now, :now
            );
        """), {
            "id": new_id,
            "project_id": project_id,
            "category": category_enum,
            "name": name,
            "now": now,
        })
        conn.commit()
        return new_id


def sync_dataset_metrics(dataset_id: str) -> Optional[DatasetModel]:
    """
    Recalculates completeness, quality, status, validation_status, and file count
    across all files grouped under the dataset, and persists to PostgreSQL.
    """
    with engine.connect() as conn:
        ds_row = conn.execute(text("""
            SELECT id, project_id, category, name, created_at, updated_at
            FROM input_datasets
            WHERE id = :id;
        """), {"id": dataset_id}).fetchone()

        if not ds_row:
            return None

        project_id = str(ds_row[1])
        category_enum = str(ds_row[2])
        ds_name = ds_row[3]
        created_at_str = str(ds_row[4])

        # Query all child files
        files_rows = conn.execute(text("""
            SELECT id, file_name, extension, file_role, mime_type,
                   size_bytes, sha256, relative_path, is_corrupt, created_at
            FROM dataset_files
            WHERE dataset_id = :id
            ORDER BY created_at ASC;
        """), {"id": dataset_id}).fetchall()

        file_list: List[Dict[str, Any]] = []
        file_models: List[DatasetFileModel] = []
        total_size = 0

        for r in files_rows:
            f_dict = {
                "file_id": str(r[0]),
                "dataset_id": dataset_id,
                "filename": r[1],
                "extension": r[2],
                "file_role": r[3],
                "mime_type": r[4],
                "size_bytes": int(r[5]),
                "size": int(r[5]),
                "sha256": str(r[6]).strip(),
                "SHA256": str(r[6]).strip(),
                "relative_path": r[7],
                "upload_status": "UPLOADED",
                "upload status": "UPLOADED",
                "is_corrupt": bool(r[8]),
                "created_at": str(r[9]),
            }
            # Storage location resolve
            try:
                storage_loc = str((Path(settings.LOCAL_STORAGE_PATH) / r[7]).resolve())
            except Exception:
                storage_loc = r[7]
            f_dict["storage_location"] = storage_loc
            f_dict["storage location"] = storage_loc

            file_list.append(f_dict)
            file_models.append(DatasetFileModel(**f_dict))
            total_size += f_dict["size_bytes"]

        completeness, quality, status, val_status, breakdown = compute_dataset_metrics(category_enum, file_list)

        now = datetime.now(timezone.utc)
        manifest_data = {
            "category": category_enum,
            "breakdown": breakdown,
            "total_files": len(file_models),
            "total_size_bytes": total_size,
            "last_synced": now.isoformat(),
        }

        # Update input_datasets record with real scores
        conn.execute(text("""
            UPDATE input_datasets
            SET file_count = :file_count,
                total_size_bytes = :total_size,
                completeness = :completeness,
                quality = :quality,
                status = CAST(:status AS dataset_status_enum),
                validation_status = :val_status,
                metadata_manifest = CAST(:manifest AS jsonb),
                updated_at = :now
            WHERE id = :id;
        """), {
            "id": dataset_id,
            "file_count": len(file_models),
            "total_size": total_size,
            "completeness": completeness,
            "quality": quality,
            "status": status,
            "val_status": val_status,
            "manifest": json.dumps(manifest_data),
            "now": now,
        })
        conn.commit()

        return DatasetModel(
            dataset_id=dataset_id,
            project_id=project_id,
            category=category_enum,
            name=ds_name,
            status=status,
            completeness=completeness,
            quality=quality,
            metadata=manifest_data,
            validation_status=val_status,
            file_count=len(file_models),
            total_size_bytes=total_size,
            files=file_models,
            created_at=created_at_str,
            updated_at=str(now),
        )


def get_dataset_model(dataset_id: str) -> Optional[DatasetModel]:
    """
    Returns the real Dataset model with all required fields and child files.
    """
    return sync_dataset_metrics(dataset_id)


def list_project_datasets_grouped(project_id: str) -> List[DatasetModel]:
    """
    Returns all grouped datasets for a project with their child files.
    """
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id FROM input_datasets
            WHERE project_id = :project_id
            ORDER BY created_at ASC;
        """), {"project_id": project_id}).fetchall()

    datasets: List[DatasetModel] = []
    for r in rows:
        ds = sync_dataset_metrics(str(r[0]))
        if ds:
            datasets.append(ds)
    return datasets
