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
import json
import asyncio
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
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
        normalize_category,
        CATEGORY_NAMES,
    )
    from backend.file_validator import validate_dataset_by_id
    from backend.operation_logger import operation_logger, LogLevel
    from backend.scanner_engine import run_real_scanner_pipeline, ScannerPipelineResult
except ImportError:
    from database import engine
    from ingestion import (
        store_uploaded_files,
        get_dataset_info,
        get_dataset_files,
        list_project_datasets,
        CATEGORY_EXTENSIONS,
        normalize_category,
        CATEGORY_NAMES,
    )
    from file_validator import validate_dataset_by_id
    from operation_logger import operation_logger, LogLevel
    from scanner_engine import run_real_scanner_pipeline, ScannerPipelineResult

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
    title: Optional[str] = None
    name: Optional[str] = None
    location: Optional[str] = ""
    survey_date: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    code: Optional[str] = None
    description: Optional[str] = ""
    target_crs_epsg: Optional[int] = 32643
    accuracy_tier: Optional[str] = "TIER_1_CADASTRAL_LEGAL"


@router.post("/projects")
@router.post("/projects/create")
async def create_project_real(req: CreateProjectRequest):
    """
    REAL: Creates a project record in PostgreSQL projects table.
    Stores: project name, location, survey date, created_at, status.
    Returns: new project_id UUID.
    """
    project_id = str(uuid.uuid4())
    project_name = (req.name or req.title or "Untitled Project").strip()
    code = req.code or f"PROJ-{project_id[:8].upper()}"
    location = (req.location or "").strip()
    survey_date_raw = (req.survey_date or req.date or "").strip()
    status = (req.status or "ACTIVE").strip()

    # Parse survey date safely
    parsed_date = None
    if survey_date_raw:
        for fmt in ("%Y-%m-%d", "%d %b %Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                parsed_date = datetime.strptime(survey_date_raw, fmt).date()
                break
            except ValueError:
                pass

    created_iso = datetime.now(timezone.utc).isoformat()

    try:
        with engine.connect() as conn:
            org_row = conn.execute(sql_text("SELECT id FROM organizations LIMIT 1")).fetchone()
            org_id = str(org_row[0]) if org_row else "a0000000-0000-0000-0000-000000000001"

            conn.execute(sql_text("""
                INSERT INTO projects (
                    id, organization_id, code, title, description,
                    location, survey_date, status,
                    accuracy_tier, target_crs_epsg, created_at, updated_at
                ) VALUES (
                    :id, :org_id, :code, :title, :desc,
                    :location, :survey_date, :status,
                    :tier, :crs, NOW(), NOW()
                )
            """), {
                "id": project_id,
                "org_id": org_id,
                "code": code,
                "title": project_name,
                "desc": req.description or f"Cadastral survey project in {location}",
                "location": location,
                "survey_date": parsed_date,
                "status": status,
                "tier": req.accuracy_tier or "TIER_1_CADASTRAL_LEGAL",
                "crs": req.target_crs_epsg or 32643,
            })
            conn.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Project creation failed: {str(e)}")

    await operation_logger.log(
        category="PROJECT",
        message=f"Project created: {project_name}",
        detail=f"ID={project_id}, Code={code}, Location={location}, Status={status}"
    )

    return {
        "success": True,
        "project_id": project_id,
        "id": project_id,
        "name": project_name,
        "title": project_name,
        "code": code,
        "location": location,
        "survey_date": str(parsed_date) if parsed_date else survey_date_raw,
        "status": status,
        "created_at": created_iso,
        "target_crs_epsg": req.target_crs_epsg or 32643,
        "accuracy_tier": req.accuracy_tier or "TIER_1_CADASTRAL_LEGAL",
    }


@router.get("/projects")
async def list_projects():
    """Returns list of real projects from PostgreSQL."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(sql_text("""
                SELECT id, code, title, description, location, survey_date,
                       status, accuracy_tier, target_crs_epsg, created_at
                FROM projects
                ORDER BY created_at DESC;
            """)).fetchall()

            projects = []
            for r in rows:
                projects.append({
                    "project_id": str(r[0]),
                    "id": str(r[0]),
                    "code": r[1],
                    "title": r[2],
                    "name": r[2],
                    "description": r[3],
                    "location": r[4] or "",
                    "survey_date": str(r[5]) if r[5] else None,
                    "status": r[6] or "ACTIVE",
                    "accuracy_tier": str(r[7]),
                    "target_crs_epsg": r[8],
                    "created_at": str(r[9]),
                })
            return {"projects": projects, "count": len(projects)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/detail")
async def get_project_detail(project_id: str):
    """Returns a single project from the database."""
    try:
        with engine.connect() as conn:
            row = conn.execute(sql_text("""
                SELECT id, code, title, description, location, survey_date,
                       status, accuracy_tier, target_crs_epsg, created_at, updated_at
                FROM projects WHERE id = :id
            """), {"id": project_id}).fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    return {
        "project_id": str(row[0]),
        "id": str(row[0]),
        "code": row[1],
        "title": row[2],
        "name": row[2],
        "description": row[3],
        "location": row[4] or "",
        "survey_date": str(row[5]) if row[5] else None,
        "status": row[6] or "ACTIVE",
        "accuracy_tier": str(row[7]),
        "target_crs_epsg": row[8],
        "created_at": str(row[9]),
        "updated_at": str(row[10]),
    }


# ─────────────────────────────────────────────────────────────────
# FILE UPLOAD
# ─────────────────────────────────────────────────────────────────

@router.post("/datasets/upload")
async def upload_datasets(
    project_id: str = Form(...),
    category_id: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    dataset_name: Optional[str] = Form(None),
    dataset_id: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
    file: Optional[UploadFile] = File(default=None),
):
    """
    REAL multipart file upload endpoint: POST /api/v2/datasets/upload.
    Handles:
    - Multiple files and large files
    - File size validation & streaming
    - Filename sanitization
    - Extension validation
    - MIME/content signature validation (magic bytes)
    - SHA-256 hash calculation
    - Duplicate detection in dataset_files
    - Project ID validation
    - Category normalization across all 10 categories
    - Physical storage persistence (storage_cache/)
    - PostgreSQL dataset_files and input_datasets records
    - Returns file_id, dataset_id, filename, size, SHA256, category, storage location, upload status
    """
    cat_key = category_id or category
    if not cat_key:
        raise HTTPException(status_code=400, detail="Missing category_id or category field")

    file_list = list(files) if files else []
    if file is not None and file not in file_list:
        file_list.append(file)

    if not file_list:
        raise HTTPException(status_code=400, detail="No files provided for upload")

    cat_enum = normalize_category(cat_key)
    cat_label = cat_enum.replace("CAT_", "").split("_")[0]

    await operation_logger.log(
        category=cat_label,
        message=f"Upload initiated: {len(file_list)} file(s) for project {project_id[:8]}",
        detail=f"Category: {cat_enum}, Target Dataset: {dataset_name or 'Auto-generated'}"
    )

    result = await store_uploaded_files(
        project_id=project_id,
        category_id=cat_enum,
        files=file_list,
        dataset_name=dataset_name,
        dataset_id=dataset_id,
    )

    await operation_logger.log(
        category=cat_label,
        message=f"Upload complete: {result['files_saved']} file(s) saved ({result['total_bytes'] // 1024} KB)",
        level=LogLevel.SUCCESS,
        detail=f"Dataset ID: {result['dataset_id']}, Files: {', '.join([f['filename'] for f in result.get('files', [])])}"
    )

    return result


@router.post("/projects/{project_id}/datasets/{category_id}/upload")
async def upload_dataset_files(
    project_id: str,
    category_id: str,
    dataset_name: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
):
    """
    Project-scoped route for upload: delegates to store_uploaded_files with full validation.
    """
    cat_enum = normalize_category(category_id)
    return await store_uploaded_files(
        project_id=project_id,
        category_id=cat_enum,
        files=files,
        dataset_name=dataset_name,
    )


@router.get("/projects/{project_id}/datasets")
async def get_project_datasets_real(project_id: str):
    """Returns all real datasets registered in the database for this project."""
    datasets = list_project_datasets(project_id)
    return {"project_id": project_id, "count": len(datasets), "datasets": datasets}


@router.get("/datasets/{dataset_id}")
async def get_dataset_detail(dataset_id: str):
    """
    Step 7 Real Dataset Model.
    Returns: dataset_id, project_id, category, status, completeness,
    quality, metadata, validation_status, and all grouped files.
    """
    info = get_dataset_info(dataset_id)
    if not info:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return info


@router.get("/projects/{project_id}/datasets/{category_id}")
async def get_project_category_dataset_endpoint(project_id: str, category_id: str):
    """
    Returns the grouped dataset for a category in a project.
    """
    cat_enum = normalize_category(category_id)
    with engine.connect() as conn:
        row = conn.execute(sql_text("""
            SELECT id FROM input_datasets
            WHERE project_id = :project_id AND category = :category
            ORDER BY created_at DESC
            LIMIT 1;
        """), {"project_id": project_id, "category": cat_enum}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"No dataset found for category {category_id} in project {project_id}")

    return get_dataset_info(str(row[0]))


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
            completeness = float(ds.get("completeness", 0.0))
            quality = float(ds.get("quality", 100.0))
            val_status = str(ds.get("validation_status", "PENDING"))
            score = float(ds.get("readiness_score") or ((completeness * 0.5) + (quality * 0.5)))
            db_status = str(ds.get("status", "VALID"))

            if val_status == "PASSED" or score >= 80:
                ui_status = "READY"
                badge = "Ready"
            elif score >= 40 or val_status == "PARTIAL":
                ui_status = "READY_WITH_WARNINGS"
                badge = "Warnings"
            elif score > 0:
                ui_status = "UPLOADED"
                badge = "Uploaded"
            else:
                ui_status = "UPLOADED"
                badge = "Pending Validation"

            total_bytes = ds.get("total_bytes") or ds.get("total_size_bytes") or 0
            size_kb = total_bytes // 1024
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
                "completeness": completeness,
                "quality": quality,
                "validationStatus": val_status,
                "datasetCount": 1,
                "datasetId": ds["dataset_id"],
                "primaryMetric": f"{ds.get('file_count', len(ds.get('files', [])))} file(s) — {size_str}",
                "badge": badge,
                "summary": f"Uploaded: {ds['created_at'][:19].replace('T', ' ')}",
                "supportedExtensions": exts,
                "files": ds.get("files", []),
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
# REAL 10-STAGE DATASET SCANNER (Phase 2 / Step 8)
# ─────────────────────────────────────────────────────────────────

@router.post("/datasets/{dataset_id}/scan")
async def scan_dataset_endpoint(dataset_id: str):
    """
    Executes the real 10-stage scanner pipeline on actual uploaded files.
    Never uses timers or hardcoded values.
    """
    info = get_dataset_info(dataset_id)
    if not info:
        raise HTTPException(status_code=404, detail="Dataset not found")

    cat_label = info["category"].replace("CAT_", "").split("_")[0]
    await operation_logger.log(
        category=cat_label,
        message=f"Scanner pipeline started: {info['name']}",
        detail=f"10-stage verification across {info.get('file_count', 0)} file(s)"
    )

    try:
        result = await run_real_scanner_pipeline(dataset_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scanner error: {str(e)}")

    lvl = LogLevel.SUCCESS if result.ready_for_processing else LogLevel.WARNING
    await operation_logger.log(
        category=cat_label,
        message=f"Scan complete: {result.status} (C: {result.completeness}%, Q: {result.quality}%)",
        level=lvl,
        detail=f"CRS: {result.crs_detected or 'None'}, Checks: {len(result.quality_checks)}"
    )

    return result.dict()


@router.get("/datasets/{dataset_id}/scan/stream")
async def scan_dataset_stream(dataset_id: str):
    """
    Server-Sent Events (SSE) streaming endpoint for the real 10-stage scanner.
    Each event corresponds to an actual completed operation on disk files.
    """
    info = get_dataset_info(dataset_id)
    if not info:
        raise HTTPException(status_code=404, detail="Dataset not found")

    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()

        async def step_callback(step):
            await queue.put({"type": "step", "data": step.dict()})

        async def worker():
            try:
                res = await run_real_scanner_pipeline(dataset_id, progress_callback=step_callback)
                await queue.put({"type": "complete", "result": res.dict()})
            except Exception as e:
                await queue.put({"type": "error", "error": str(e)})

        task = asyncio.create_task(worker())

        while True:
            item = await queue.get()
            if item["type"] == "step":
                yield f"data: {json.dumps(item)}\n\n"
            elif item["type"] == "complete":
                yield f"data: {json.dumps(item)}\n\n"
                break
            elif item["type"] == "error":
                yield f"data: {json.dumps(item)}\n\n"
                break

        await task

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/projects/{project_id}/scan")
async def scan_all_project_datasets(project_id: str):
    """
    Scans all datasets in the project sequentially on actual disk files.
    Zero timers or fake delays.
    """
    datasets = list_project_datasets(project_id)
    results = []
    for ds in datasets:
        ds_id = ds["dataset_id"]
        try:
            res = await run_real_scanner_pipeline(ds_id)
            results.append(res.dict())
        except Exception as e:
            results.append({"dataset_id": ds_id, "error": str(e), "status": "INVALID"})

    return {
        "project_id": project_id,
        "scanned_count": len(results),
        "results": results,
    }


@router.post("/datasets/{dataset_id}/validate")
async def validate_dataset_real(dataset_id: str):
    """
    REAL: Runs the 10-stage scanner pipeline and returns the result.
    Backwards-compatible with validate callers.
    """
    return await scan_dataset_endpoint(dataset_id)


@router.get("/datasets/{dataset_id}/validate")
async def get_validation_result_real(dataset_id: str):
    """GET convenience endpoint — runs same real scan as POST."""
    return await scan_dataset_endpoint(dataset_id)


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
