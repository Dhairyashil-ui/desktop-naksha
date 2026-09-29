"""
Naksha 2.0 — Real Overall Project Readiness Engine (Step 15)

Replaces all hardcoded inputs with dynamic, database-driven evaluation.
Evaluates every category against actual uploaded datasets:
  - COMPLETENESS (actual % from real scanner)
  - QUALITY      (actual % from real scanner)
  - VALIDITY     (YES if validation_status == 'PASSED' / status == 'READY', NO otherwise)
  - REQUIRED STATUS (YES for mandatory workflow inputs, NO for optional/recommended)

The project becomes:
  READY FOR PROCESSING
ONLY when all required conditions are genuinely satisfied.
"""

from __future__ import annotations

import json
from typing import Dict, List, Any, Optional, Tuple
from enum import Enum
from datetime import datetime, timezone
from sqlalchemy import text as sql_text

try:
    from backend.database import engine
    from backend.ingestion import CATEGORY_NAMES, normalize_category
except ImportError:
    from database import engine
    from ingestion import CATEGORY_NAMES, normalize_category


class DatasetTier(str, Enum):
    REQUIRED = "REQUIRED"
    RECOMMENDED = "RECOMMENDED"
    OPTIONAL = "OPTIONAL"


# Canonical Cadastral 3D Demarcation Workflow Tier Profile
WORKFLOW_TIER_MAPPING: Dict[str, DatasetTier] = {
    "CAT_01_PHOTOGRAMMETRY":        DatasetTier.REQUIRED,    # Aerial triangulation
    "CAT_02_LIDAR_POINT_CLOUD":     DatasetTier.REQUIRED,    # High-density 3D spatial points
    "CAT_03_GIS_CAD":               DatasetTier.REQUIRED,    # Cadastral parcel base & plinths
    "CAT_04_GNSS_SURVEY":           DatasetTier.REQUIRED,    # Ground control & RTK baselines
    "CAT_05_DEM_ELEVATION":         DatasetTier.RECOMMENDED, # DTM / DSM elevation model
    "CAT_06_ARCHITECTURAL_BIM":     DatasetTier.OPTIONAL,    # Architectural IFC/RVT models
    "CAT_07_PROPERTY_VERTICAL_DATA": DatasetTier.REQUIRED,   # Property ownership & floor register
    "CAT_08_IMAGERY_ORTHOPHOTO":    DatasetTier.RECOMMENDED, # High-res orthomosaic
    "CAT_09_PROJECT_METADATA":      DatasetTier.RECOMMENDED, # Coordinate system & survey metadata
    "CAT_10_SUPPORTING_DOCS":       DatasetTier.OPTIONAL,    # Legal deeds & certificates
}

TIER_PROFILES: Dict[str, Dict[str, DatasetTier]] = {
    "TIER_1_CADASTRAL_LEGAL": WORKFLOW_TIER_MAPPING,
    "TIER_2_ENGINEERING_GRADE": {
        "CAT_01_PHOTOGRAMMETRY":        DatasetTier.RECOMMENDED,
        "CAT_02_LIDAR_POINT_CLOUD":     DatasetTier.REQUIRED,
        "CAT_03_GIS_CAD":               DatasetTier.REQUIRED,
        "CAT_04_GNSS_SURVEY":           DatasetTier.REQUIRED,
        "CAT_05_DEM_ELEVATION":         DatasetTier.REQUIRED,
        "CAT_06_ARCHITECTURAL_BIM":     DatasetTier.RECOMMENDED,
        "CAT_07_PROPERTY_VERTICAL_DATA": DatasetTier.OPTIONAL,
        "CAT_08_IMAGERY_ORTHOPHOTO":    DatasetTier.RECOMMENDED,
        "CAT_09_PROJECT_METADATA":      DatasetTier.RECOMMENDED,
        "CAT_10_SUPPORTING_DOCS":       DatasetTier.OPTIONAL,
    },
    "TIER_3_TOPOGRAPHIC_RECON": {
        "CAT_01_PHOTOGRAMMETRY":        DatasetTier.REQUIRED,
        "CAT_02_LIDAR_POINT_CLOUD":     DatasetTier.OPTIONAL,
        "CAT_03_GIS_CAD":               DatasetTier.REQUIRED,
        "CAT_04_GNSS_SURVEY":           DatasetTier.RECOMMENDED,
        "CAT_05_DEM_ELEVATION":         DatasetTier.REQUIRED,
        "CAT_06_ARCHITECTURAL_BIM":     DatasetTier.OPTIONAL,
        "CAT_07_PROPERTY_VERTICAL_DATA": DatasetTier.OPTIONAL,
        "CAT_08_IMAGERY_ORTHOPHOTO":    DatasetTier.RECOMMENDED,
        "CAT_09_PROJECT_METADATA":      DatasetTier.RECOMMENDED,
        "CAT_10_SUPPORTING_DOCS":       DatasetTier.OPTIONAL,
    },
}

# Pass thresholds for mandatory gating (Completeness and Quality must meet this)
MANDATORY_THRESHOLDS: Dict[str, float] = {
    "CAT_01_PHOTOGRAMMETRY":        75.0,
    "CAT_02_LIDAR_POINT_CLOUD":     75.0,
    "CAT_03_GIS_CAD":               80.0,
    "CAT_04_GNSS_SURVEY":           80.0,
    "CAT_07_PROPERTY_VERTICAL_DATA": 75.0,
}


def calculate_project_readiness_from_db(
    project_id: str,
    custom_engine=None,
    tier_mapping: Optional[Dict[str, DatasetTier]] = None,
) -> Dict[str, Any]:
    """
    Computes real, dynamic project readiness directly from PostgreSQL datasets.
    Zero hardcoded values.
    """
    db_engine = custom_engine or engine
    tiers = tier_mapping or WORKFLOW_TIER_MAPPING

    # If no tier_mapping provided, check if project has an accuracy_tier configured in DB
    if not tier_mapping:
        try:
            with db_engine.connect() as conn:
                p_row = conn.execute(
                    sql_text("SELECT accuracy_tier FROM projects WHERE id = :proj_id"),
                    {"proj_id": project_id},
                ).fetchone()
                if p_row and p_row[0] in TIER_PROFILES:
                    tiers = TIER_PROFILES[p_row[0]]
        except Exception:
            tiers = WORKFLOW_TIER_MAPPING

    # Query all datasets for this project
    with db_engine.connect() as conn:
        rows = conn.execute(
            sql_text("""
                SELECT id, name, category, status, validation_status,
                       completeness, quality, readiness_score, epsg_detected,
                       metadata_manifest, updated_at
                FROM input_datasets
                WHERE project_id = :proj_id
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
            """),
            {"proj_id": project_id},
        ).fetchall()

    # Index datasets by normalized canonical category
    datasets_by_cat: Dict[str, List[Any]] = {}
    for r in rows:
        try:
            norm_cat = normalize_category(r.category)
            datasets_by_cat.setdefault(norm_cat, []).append(r)
        except Exception:
            continue

    category_reports: List[Dict[str, Any]] = []
    required_passed_count = 0
    required_total_count = 0
    missing_required: List[str] = []
    failing_required: List[str] = []
    required_scores: List[float] = []
    optional_scores: List[float] = []

    # Evaluate each of the canonical 10 categories
    for cat_id, cat_name in CATEGORY_NAMES.items():
        tier = tiers.get(cat_id, DatasetTier.OPTIONAL)
        is_required = (tier == DatasetTier.REQUIRED)
        required_status_str = "YES" if is_required else "NO"

        cat_datasets = datasets_by_cat.get(cat_id, [])

        if cat_datasets:
            # Pick best/most recent dataset
            ds = cat_datasets[0]
            completeness = float(ds.completeness or 0.0)
            quality = float(ds.quality or 0.0)
            raw_status = ds.status or "REJECTED"
            val_status = ds.validation_status or "PENDING"

            # A dataset is valid if scanned as READY/VALID or validation passed
            is_valid = (
                val_status in ("PASSED", "PASS")
                or raw_status in ("READY", "VALID")
            )
            valid_status_str = "YES" if is_valid else "NO"

            threshold = MANDATORY_THRESHOLDS.get(cat_id, 75.0)
            meets_threshold = (completeness >= threshold and quality >= threshold and is_valid)

            rep = {
                "category_id": cat_id,
                "name": cat_name,
                "category": cat_name,
                # Explicit fields matching STEP 15 specification:
                "COMPLETENESS": round(completeness, 1),
                "completeness": round(completeness, 1),
                "Completeness": round(completeness, 1),
                "QUALITY": round(quality, 1),
                "quality": round(quality, 1),
                "Quality": round(quality, 1),
                "VALIDITY": valid_status_str,
                "valid_status": valid_status_str,
                "Valid": valid_status_str,
                "VALID": valid_status_str,
                "valid": is_valid,
                "REQUIRED_STATUS": required_status_str,
                "required_status": required_status_str,
                "Required": required_status_str,
                "REQUIRED": required_status_str,
                "required": is_required,
                "status": raw_status,
                "validation_status": val_status,
                "dataset_id": ds.id,
                "dataset_name": ds.name,
                "epsg": ds.epsg_detected,
                "meets_threshold": meets_threshold,
            }

            if is_required:
                required_total_count += 1
                required_scores.append(round((completeness + quality) / 2.0, 1))
                if meets_threshold:
                    required_passed_count += 1
                else:
                    failing_required.append(f"{cat_name} (Comp: {completeness:.0f}%, Qual: {quality:.0f}%, Valid: {valid_status_str})")
            else:
                optional_scores.append(round((completeness + quality) / 2.0, 1))

        else:
            # No dataset uploaded for this category
            rep = {
                "category_id": cat_id,
                "name": cat_name,
                "category": cat_name,
                # Explicit fields matching STEP 15 specification:
                "COMPLETENESS": 0.0,
                "completeness": 0.0,
                "Completeness": 0.0,
                "QUALITY": 0.0,
                "quality": 0.0,
                "Quality": 0.0,
                "VALIDITY": "NO",
                "valid_status": "NO",
                "Valid": "NO",
                "VALID": "NO",
                "valid": False,
                "REQUIRED_STATUS": required_status_str,
                "required_status": required_status_str,
                "Required": required_status_str,
                "REQUIRED": required_status_str,
                "required": is_required,
                "status": "MISSING",
                "validation_status": "MISSING",
                "dataset_id": None,
                "dataset_name": None,
                "epsg": None,
                "meets_threshold": False,
            }

            if is_required:
                required_total_count += 1
                missing_required.append(cat_name)
                required_scores.append(0.0)
            else:
                optional_scores.append(0.0)

        category_reports.append(rep)

    # ── AGGREGATION & READINESS STATUS ─────────────────────────────────
    required_data_pct = (
        round((required_passed_count / required_total_count) * 100)
        if required_total_count > 0 else 100
    )
    avg_required = (
        sum(required_scores) / len(required_scores)
        if required_scores else 0.0
    )
    optional_data_pct = (
        round(sum(optional_scores) / len(optional_scores))
        if optional_scores else 0
    )

    # Overall weighted score: 75% required weight + 25% optional weight
    overall_readiness = round((0.75 * avg_required) + (0.25 * optional_data_pct))

    # Project readiness status
    if required_total_count > 0 and required_passed_count == required_total_count:
        processing_status = "READY FOR PROCESSING"
        is_ready = True
    elif missing_required and len(missing_required) == required_total_count:
        processing_status = "BLOCKED"
        is_ready = False
    elif missing_required:
        processing_status = "BLOCKED"
        is_ready = False
    else:
        processing_status = "NOT READY"
        is_ready = False

    return {
        "overallReadiness": overall_readiness,
        "requiredData": required_data_pct,
        "optionalData": optional_data_pct,
        "processingStatus": processing_status,
        "isReadyForProcessing": is_ready,
        "categories": category_reports,
        "summary": {
            "total_categories": len(CATEGORY_NAMES),
            "required_count": required_total_count,
            "required_passed": required_passed_count,
            "missing_required": missing_required,
            "failing_required": failing_required,
        },
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }


def calculate_readiness(
    scores: Dict[str, float],
    tier_mapping: Optional[Dict[str, DatasetTier]] = None
) -> Dict[str, Any]:
    """
    In-memory fallback calculation for scores dictionary.
    Conforms to mathematical weighting (75% required / 25% optional).
    """
    tiers = tier_mapping or WORKFLOW_TIER_MAPPING

    # Map possible shorthand keys (e.g. "cat_01" -> "CAT_01_PHOTOGRAMMETRY")
    short_map = {
        "cat_01": "CAT_01_PHOTOGRAMMETRY",
        "cat_02": "CAT_02_LIDAR_POINT_CLOUD",
        "cat_03": "CAT_03_GIS_CAD",
        "cat_04": "CAT_04_GNSS_SURVEY",
        "cat_05": "CAT_05_DEM_ELEVATION",
        "cat_06": "CAT_06_ARCHITECTURAL_BIM",
        "cat_07": "CAT_07_PROPERTY_VERTICAL_DATA",
        "cat_08": "CAT_08_IMAGERY_ORTHOPHOTO",
        "cat_09": "CAT_09_PROJECT_METADATA",
        "cat_10": "CAT_10_SUPPORTING_DOCS",
    }

    norm_scores: Dict[str, float] = {}
    for k, v in scores.items():
        norm_key = short_map.get(k, k)
        norm_scores[norm_key] = float(v)

    required_items = [cat_id for cat_id, tier in tiers.items() if tier == DatasetTier.REQUIRED]
    optional_items = [cat_id for cat_id, tier in tiers.items() if tier in (DatasetTier.OPTIONAL, DatasetTier.RECOMMENDED)]

    required_passes = 0
    required_scores = []
    has_zero_required = False

    for cat_id in required_items:
        score = norm_scores.get(cat_id, 0.0)
        threshold = MANDATORY_THRESHOLDS.get(cat_id, 75.0)
        required_scores.append(score)
        if score <= 0.0:
            has_zero_required = True
        if score >= threshold:
            required_passes += 1

    required_data_pct = round((required_passes / len(required_items)) * 100) if required_items else 100
    avg_required_score = sum(required_scores) / len(required_scores) if required_scores else 0.0

    opt_scores = [norm_scores.get(cat_id, 0.0) for cat_id in optional_items]
    optional_data_pct = round(sum(opt_scores) / len(opt_scores)) if opt_scores else 0

    overall_readiness = round((0.75 * avg_required_score) + (0.25 * optional_data_pct))

    if has_zero_required:
        processing_status = "BLOCKED"
        is_ready = False
    elif required_data_pct == 100:
        processing_status = "READY FOR PROCESSING"
        is_ready = True
    else:
        processing_status = "NOT READY"
        is_ready = False

    return {
        "overallReadiness": overall_readiness,
        "requiredData": required_data_pct,
        "optionalData": optional_data_pct,
        "processingStatus": processing_status,
        "isReadyForProcessing": is_ready,
        "requiredDatasetCount": len(required_items),
        "requiredPassCount": required_passes,
    }
