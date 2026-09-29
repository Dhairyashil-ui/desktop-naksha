"""
Naksha 2.0 — Real Processing Foundation Endpoints (Phase RF-1)
Mounted onto the main FastAPI app via app.include_router().

Replaces all mocked endpoints with real implementations:
- Real project creation (writes to PostgreSQL)
- Real file upload (saves to disk, computes SHA-256, writes to dataset_files)
- Real live input channel status (reads from database)
- Real file-level validation (laspy, pyproj, magic bytes)
- Real readiness score (computed from validated datasets in DB)
"""

import uuid
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import text as sql_text

try:
    from backend.database import engine
    from backend.ingestion import (
        store_uploaded_files,
        get_dataset_info,
        get_dataset_files,
        list_project_datasets,
        CATEGORY_EXTENSIONS,
    )
    from backend.file_validator import validate_dataset_by_id
    from backend.operation_logger import operation_logger, LogLevel
except ImportError:
    from database import engine
    from ingestion import (
        store_uploaded_files,
        get_dataset_info,
        get_dataset_files,
        list_project_datasets,
        CATEGORY_EXTENSIONS,
    )
    from file_validator import validate_dataset_by_id
    from operation_logger import operation_logger, LogLevel

router = APIRouter(prefix="/api/v2", tags=["real"])

REQUIRED_CATEGORIES = {
    "CAT_01_PHOTOGRAMMETRY",
    "CAT_03_GIS_CAD",
    "CAT_04_GNSS_SURVEY",
    "CAT_07_PROPERTY_VERTICAL_DATA",
}

CATEGORY_DISPLAY = {
    "CAT_01_PHOTOGRAMMETRY":          {"num": 1, "name": "Photogrammetry",          "required": True},
    "CAT_02_LIDAR_POINT_CLOUD":       {"num": 2, "name": "LiDAR / Point Cloud",     "required": False},
    "CAT_03_GIS_CAD":                 {"num": 3, "name": "GIS / CAD",               "required": True},
    "CAT_04_GNSS_SURVEY":             {"num": 4, "name": "GNSS / Survey",           "required": True},
    "CAT_05_DEM_ELEVATION":           {"num": 5, "name": "DEM / Elevation",         "required": False},
    "CAT_06_ARCHITECTURAL_BIM":       {"num": 6, "name": "Architectural / BIM",    "required": False},
    "CAT_07_PROPERTY_VERTICAL_DATA":  {"num": 7, "name": "Property & Vertical Data","required": True},
    "CAT_08_IMAGERY_ORTHOPHOTO":      {"num": 8, "name": "Imagery / Orthophoto",   "required": False},
    "CAT_09_PROJECT_METADATA":        {"num": 9, "name": "Project / Metadata",     "required": False},
    "CAT_10_SUPPORTING_DOCS":         {"num": 10,"name": "Supporting Documents",   "required": False},
}


# ─────────────────────────────────────────────────────────────────
# PROJECT CREATION
# ─────────────────────────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    title: str
    code: Optional[str] = None
    description: Optional[str] = ""
    target_crs_epsg: Optional[int] = 32643
    accuracy_tier: Optional[str] = "TIER_1_CADASTRAL_LEGAL"
    location: Optional[str] = ""


@router.post("/projects/create")
async def create_project_real(req: CreateProjectRequest):
    """
    REAL: Creates a project record in PostgreSQL.
    Returns the new project_id UUID.
    """
    project_id = str(uuid.uuid4())
    code = req.code or f"PROJ-{project_id[:8].upper()}"

    try:
        with engine.connect() as conn:
            org_row = conn.execute(sql_text("SELECT id FROM organizations LIMIT 1")).fetchone()
            org_id = str(org_row[0]) if org_row else "a0000000-0000-0000-0000-000000000001"

            conn.execute(sql_text("""
                INSERT INTO projects (
                    id, organization_id, code, title, description,
                    accuracy_tier, target_crs_epsg, created_at, updated_at
                ) VALUES (
                    :id, :org_id, :code, :title, :desc,
                    :tier, :crs, NOW(), NOW()
                )
            """), {
                "id": project_id,
                "org_id": org_id,
                "code": code,
                "title": req.title,
                "desc": req.description or "",
                "tier": req.accuracy_tier,
                "crs": req.target_crs_epsg,
            })
            conn.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Project creation failed: {str(e)}")

    await operation_logger.log(
        category="PROJECT",
        message=f"Project created: {req.title}",
        detail=f"ID={project_id}, Code={code}, CRS=EPSG:{req.target_crs_epsg}"
    )

    return {
        "success": True,
        "project_id": project_id,
        "code": code,
        "title": req.title,
        "target_crs_epsg": req.target_crs_epsg,
        "accuracy_tier": req.accuracy_tier,
    }


@router.get("/projects/{project_id}/detail")
async def get_project_detail(project_id: str):
    """Returns a single project from the database."""
    try:
        with engine.connect() as conn:
            row = conn.execute(sql_text("""
                SELECT id, code, title, description, accuracy_tier,
                       target_crs_epsg, created_at, updated_at
                FROM projects WHERE id = :id
            """), {"id": project_id}).fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    return {
        "project_id": str(row[0]),
        "code": row[1],
        "title": row[2],
        "description": row[3],
        "accuracy_tier": str(row[4]),
        "target_crs_epsg": row[5],
        "created_at": str(row[6]),
        "updated_at": str(row[7]),
    }


# ─────────────────────────────────────────────────────────────────
# FILE UPLOAD
# ─────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/datasets/{category_id}/upload")
async def upload_dataset_files(
    project_id: str,
    category_id: str,
    dataset_name: str = Form(...),
    files: List[UploadFile] = File(...),
):
    """
    REAL file upload.
    Saves file bytes to local storage (storage_cache/), computes SHA-256,
    registers each file in dataset_files and input_datasets tables.
    Returns dataset_id for downstream validation and processing.
    """
    if category_id not in CATEGORY_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category_id}")
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    cat_label = category_id.replace("CAT_", "").split("_")[0] if "_" in category_id else "UPLOAD"

    await operation_logger.log(
        category=cat_label,
        message=f"Upload started: {len(files)} file(s) → {dataset_name}",
        detail=f"Project: {project_id}, Category: {category_id}"
    )

    result = await store_uploaded_files(
        project_id=project_id,
        category_id=category_id,
        dataset_name=dataset_name,
        files=files,
    )

    if not result["success"]:
        await operation_logger.log(
            category=cat_label,
            message=f"Upload failed: {result.get('error')}",
            level=LogLevel.ERROR,
        )
        raise HTTPException(status_code=400, detail=result.get("error", "Upload failed"))

    await operation_logger.log(
        category=cat_label,
        message=f"Upload complete: {result['files_saved']} files, {result['total_bytes'] // 1024:.0f} KB saved",
        level=LogLevel.SUCCESS,
        detail=f"Dataset ID: {result['dataset_id']}"
    )

    return result


@router.get("/projects/{project_id}/datasets")
async def get_project_datasets_real(project_id: str):
    """Returns all real datasets registered in the database for this project."""
    datasets = list_project_datasets(project_id)
    return {"project_id": project_id, "count": len(datasets), "datasets": datasets}


@router.get("/datasets/{dataset_id}/files")
async def get_dataset_files_real(dataset_id: str):
    """Returns file list for a dataset from the database."""
    info = get_dataset_info(dataset_id)
    if not info:
        raise HTTPException(status_code=404, detail="Dataset not found")
    files = get_dataset_files(dataset_id)
    return {**info, "files": files}


# ─────────────────────────────────────────────────────────────────
# LIVE INPUT CHANNELS  (replaces INITIAL_PROJECT_STATE)
# ─────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/inputs/live")
async def get_live_input_channels(project_id: str):
    """
    REAL: Returns 10 input channel statuses derived from actual uploaded
    and validated datasets in the database.
    Replaces the hardcoded INITIAL_PROJECT_STATE TypeScript constant.
    """
    datasets = list_project_datasets(project_id)

    # Map category → latest dataset by created_at
    category_map: dict = {}
    for ds in datasets:
        cat = ds["category"]
        if cat not in category_map or ds["created_at"] > category_map[cat]["created_at"]:
            category_map[cat] = ds

    channels = []
    for cat_id, meta in CATEGORY_DISPLAY.items():
        ds = category_map.get(cat_id)
        exts = CATEGORY_EXTENSIONS.get(cat_id, [])

        if ds:
            score = float(ds.get("readiness_score", 0))
            db_status = str(ds.get("status", "UPLOADED"))
            if score >= 80:
                ui_status = "READY"
                badge = "Ready"
            elif score >= 40:
                ui_status = "READY_WITH_WARNINGS"
                badge = "Warnings"
            elif score > 0:
                ui_status = "UPLOADED"
                badge = "Uploaded"
            else:
                ui_status = "UPLOADED"
                badge = "Pending Validation"

            size_kb = ds["total_bytes"] // 1024
            size_str = f"{size_kb / 1024:.1f} MB" if size_kb >= 1024 else f"{size_kb} KB"

            channels.append({
                "channelNumber": meta["num"],
                "categoryId": cat_id,
                "displayName": meta["name"],
                "required": meta["required"],
                "status": ui_status,
                "datasetStatus": db_status,
                "statusDisplay": ui_status.replace("_", " "),
                "readinessScore": score,
                "datasetCount": 1,
                "datasetId": ds["dataset_id"],
                "primaryMetric": f"{ds['file_count']} file(s) — {size_str}",
                "badge": badge,
                "summary": f"Uploaded: {ds['created_at'][:19].replace('T', ' ')}",
                "supportedExtensions": exts,
            })
        else:
            channels.append({
                "channelNumber": meta["num"],
                "categoryId": cat_id,
                "displayName": meta["name"],
                "required": meta["required"],
                "status": "EMPTY",
                "datasetStatus": "Missing",
                "statusDisplay": "No data uploaded",
                "readinessScore": 0.0,
                "datasetCount": 0,
                "datasetId": None,
                "primaryMetric": f"Awaiting {', '.join(exts[:3])} upload",
                "badge": "Required" if meta["required"] else "Optional",
                "summary": "No data uploaded yet.",
                "supportedExtensions": exts,
            })

    return {"project_id": project_id, "channels": channels, "live": True}


# ─────────────────────────────────────────────────────────────────
# REAL FILE VALIDATION
# ─────────────────────────────────────────────────────────────────

@router.post("/datasets/{dataset_id}/validate")
async def validate_dataset_real(dataset_id: str):
    """
    REAL: Reads actual stored file bytes.
    - LAS/LAZ: laspy reads header → real point count, CRS, bounding box
    - Images: magic byte detection → real format confirmation
    - GeoJSON: JSON parse → real feature count + CRS
    - CSV: column header scan → real coordinate detection
    Returns actual quality score, not hardcoded values.
    """
    info = get_dataset_info(dataset_id)
    if not info:
        raise HTTPException(status_code=404, detail="Dataset not found")

    cat_label = info["category"].replace("CAT_", "").split("_")[0]

    await operation_logger.log(
        category=cat_label,
        message=f"File validation started: {info['name']}",
        detail=f"Category: {info['category']}, Files: {info['file_count']}"
    )

    result = validate_dataset_by_id(dataset_id)
    if not result:
        raise HTTPException(status_code=500, detail="Files not found on disk")

    # Write updated score back to database
    try:
        new_status = (
            "VALID" if result.ready_for_processing else
            ("PARTIAL" if result.quality_score > 20 else "INVALID")
        )
        with engine.connect() as conn:
            conn.execute(sql_text("""
                UPDATE input_datasets
                SET readiness_score = :score, status = :status, updated_at = NOW()
                WHERE id = :id
            """), {"score": result.quality_score, "status": new_status, "id": dataset_id})
            conn.commit()
    except Exception:
        pass

    lvl = LogLevel.SUCCESS if result.ready_for_processing else LogLevel.WARNING
    crs_str = f"CRS: {result.crs_detected}" if result.crs_detected else "CRS: not detected"
    pts_str = f", Points: {result.point_count:,}" if result.point_count else ""

    await operation_logger.log(
        category=cat_label,
        message=f"Validation complete: {result.quality_score:.0f}% quality — {'READY' if result.ready_for_processing else 'WARNINGS'}",
        level=lvl,
        detail=f"{crs_str}{pts_str}, Errors: {len(result.errors)}"
    )

    return result.dict()


@router.get("/datasets/{dataset_id}/validate")
async def get_validation_result_real(dataset_id: str):
    """GET convenience endpoint — runs same real validation as POST."""
    return await validate_dataset_real(dataset_id)


# ─────────────────────────────────────────────────────────────────
# LIVE READINESS (computed from real validated data)
# ─────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/readiness/live")
async def get_live_project_readiness(project_id: str):
    """
    REAL: Computes readiness from readiness_score column in input_datasets.
    Scores were set by actual file validation, not hardcoded.
    """
    datasets = list_project_datasets(project_id)

    cat_scores: dict = {}
    for ds in datasets:
        cat = ds["category"]
        score = float(ds.get("readiness_score", 0))
        if cat not in cat_scores or score > cat_scores[cat]:
            cat_scores[cat] = score

    req_scores = [cat_scores.get(c, 0.0) for c in REQUIRED_CATEGORIES]
    opt_categories = [c for c in cat_scores if c not in REQUIRED_CATEGORIES]
    opt_scores = [cat_scores[c] for c in opt_categories]

    avg_required = sum(req_scores) / len(req_scores) if req_scores else 0.0
    avg_optional = sum(opt_scores) / len(opt_scores) if opt_scores else 0.0

    overall = round((0.75 * avg_required) + (0.25 * avg_optional), 1)
    required_pct = round((sum(1 for s in req_scores if s >= 70) / len(REQUIRED_CATEGORIES)) * 100, 1)

    return {
        "project_id": project_id,
        "overall_readiness": overall,
        "required_data_pct": required_pct,
        "optional_data_pct": round(avg_optional, 1),
        "processing_ready": overall >= 70 and required_pct >= 75,
        "category_scores": cat_scores,
        "live": True,
    }
