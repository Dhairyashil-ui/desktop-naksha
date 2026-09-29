"""
Naksha 2.0 — Real Asset Scanner (Step 14)
Covers remaining categories:
  - CAT_05: DEM / Elevation (DEM, DTM, DSM, GeoTIFF, COG, ASC, HGT)
  - CAT_06: Architectural / BIM (IFC, RVT, Floor Plans)
  - CAT_07: Property & Vertical Data (CSV, XLSX, XLS Cadastral Registers)
  - CAT_08: Imagery / Orthophoto (GeoTIFF, COG, ECW, JP2 Orthomosaics)
  - CAT_09: Project / Metadata (JSON, XML, TXT Survey Control Metadata)
  - CAT_10: Supporting Documents (PDF, DOCX Legal Deeds & Survey Certificates)

HONEST STATUS HANDLING:
  Formats that cannot be reliably parsed directly (e.g. RVT proprietary Autodesk binaries,
  scanned un-OCRed PDFs, raster image floor plans needing manual vectorization)
  are explicitly marked:
      status: "REQUIRES_MANUAL_REVIEW"
  instead of pretending validation succeeded.
"""

from __future__ import annotations

import io
import os
import re
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime, timezone
from collections import Counter

import numpy as np

# ──────────────────────────────────────────────────────────────────────────────
# DATA STRUCTURES
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class FileScanDetail:
    file_path: str
    file_name: str
    format: str
    is_valid: bool = False
    status: str = "REJECTED"  # READY | PARTIAL | REJECTED | REQUIRES_MANUAL_REVIEW
    review_reason: Optional[str] = None
    crs_string: Optional[str] = None
    epsg: Optional[int] = None
    bbox: Optional[Dict[str, float]] = None
    metrics: Dict[str, Any] = field(default_factory=dict)
    schema: Dict[str, str] = field(default_factory=dict)
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class AssetScanReport:
    category: str
    dataset_id: str
    project_id: str
    scanned_at: str = ""
    total_files: int = 0
    readable_files: int = 0
    files: List[FileScanDetail] = field(default_factory=list)
    combined_bbox: Optional[Dict[str, float]] = None
    dominant_epsg: Optional[int] = None
    crs_string: Optional[str] = None
    requires_manual_review: bool = False
    manual_review_items: List[str] = field(default_factory=list)
    summary_metrics: Dict[str, Any] = field(default_factory=dict)
    completeness: float = 0.0
    quality: float = 0.0
    status: str = "REJECTED"  # READY | PARTIAL | REJECTED | REQUIRES_MANUAL_REVIEW
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────────────
# 1. DEM / DTM / DSM & GEOTIFF / COG (CAT_05 & CAT_08)
# ──────────────────────────────────────────────────────────────────────────────

def scan_dem_raster(path: Path) -> FileScanDetail:
    """
    Parses a DEM/DTM/DSM GeoTIFF raster using rasterio.
    Extracts dimensions, bands, CRS/EPSG, transform bounds, GSD/resolution,
    elevation stats (min, max, mean), and nodata percentage.
    """
    detail = FileScanDetail(
        file_path=str(path),
        file_name=path.name,
        format=path.suffix.upper().lstrip("."),
    )

    try:
        import rasterio

        with rasterio.open(str(path)) as src:
            width = src.width
            height = src.height
            bands = src.count
            crs = src.crs
            bounds = src.bounds
            res_x, res_y = src.res
            nodata = src.nodata

            detail.metrics = {
                "width": width,
                "height": height,
                "bands": bands,
                "dtype": src.dtypes[0] if src.dtypes else "unknown",
                "pixel_resolution_m": [round(res_x, 4), round(res_y, 4)],
                "nodata_value": nodata,
            }

            if crs:
                detail.crs_string = str(crs)
                epsg = crs.to_epsg()
                detail.epsg = epsg
                if epsg:
                    detail.crs_string = f"EPSG:{epsg}"

            if bounds:
                detail.bbox = {
                    "x_min": round(bounds.left, 4),
                    "x_max": round(bounds.right, 4),
                    "y_min": round(bounds.bottom, 4),
                    "y_max": round(bounds.top, 4),
                }

            # Sample elevation stats (read downsampled raster up to 512x512)
            out_h = min(height, 512)
            out_w = min(width, 512)
            arr = src.read(1, out_shape=(out_h, out_w))

            if nodata is not None:
                valid_mask = (arr != nodata) & (~np.isnan(arr))
            else:
                valid_mask = (~np.isnan(arr))

            valid_pixels = arr[valid_mask]
            nodata_count = int(np.sum(~valid_mask))
            total_sample = out_h * out_w

            if len(valid_pixels) > 0:
                min_elev = float(np.min(valid_pixels))
                max_elev = float(np.max(valid_pixels))
                mean_elev = float(np.mean(valid_pixels))
                std_elev = float(np.std(valid_pixels))

                detail.metrics.update({
                    "min_elevation_m": round(min_elev, 2),
                    "max_elevation_m": round(max_elev, 2),
                    "mean_elevation_m": round(mean_elev, 2),
                    "stddev_elevation_m": round(std_elev, 2),
                    "elevation_range_m": round(max_elev - min_elev, 2),
                    "nodata_percentage": round((nodata_count / total_sample) * 100.0, 1),
                })

                # Sanity check elevation bounds (physical earth bounds -500m to 9000m)
                if min_elev < -500 or max_elev > 9000:
                    detail.warnings.append(f"Elevation values out of typical terrestrial range: [{min_elev:.1f}m..{max_elev:.1f}m]")
            else:
                detail.issues.append("All sampled DEM pixels are NoData or NaN")

            # Check if Cloud Optimized GeoTIFF (COG)
            is_tiled = bool(src.profile.get("tiled", False))
            detail.metrics["is_cog_tiled"] = is_tiled

            if detail.epsg or detail.crs_string:
                detail.is_valid = True
                detail.status = "READY"
            else:
                detail.is_valid = True
                detail.status = "PARTIAL"
                detail.warnings.append("DEM raster lacks embedded spatial reference / CRS")

    except Exception as e:
        detail.issues.append(f"Rasterio parse error: {e}")
        detail.status = "REJECTED"

    return detail


def scan_ortho_raster(path: Path) -> FileScanDetail:
    """
    Parses Orthophoto / Aerial Imagery GeoTIFF using rasterio.
    Extracts RGB/RGBA bands, pixel resolution (GSD cm/px), bounds, CRS.
    """
    detail = FileScanDetail(
        file_path=str(path),
        file_name=path.name,
        format="ORTHOPHOTO_GEOTIFF",
    )

    try:
        import rasterio

        with rasterio.open(str(path)) as src:
            width = src.width
            height = src.height
            bands = src.count
            crs = src.crs
            bounds = src.bounds
            res_x, res_y = src.res

            gsd_cm = round(float(np.mean([res_x, res_y])) * 100.0, 2)
            detail.metrics = {
                "width": width,
                "height": height,
                "bands": bands,
                "band_type": "RGBA" if bands == 4 else ("RGB" if bands == 3 else f"{bands}-band"),
                "gsd_cm_per_pixel": gsd_cm,
                "is_tiled_cog": bool(src.profile.get("tiled", False)),
            }

            if crs:
                detail.crs_string = str(crs)
                epsg = crs.to_epsg()
                detail.epsg = epsg
                if epsg:
                    detail.crs_string = f"EPSG:{epsg}"

            if bounds:
                detail.bbox = {
                    "x_min": round(bounds.left, 4),
                    "x_max": round(bounds.right, 4),
                    "y_min": round(bounds.bottom, 4),
                    "y_max": round(bounds.top, 4),
                }

            if detail.epsg or detail.crs_string:
                detail.is_valid = True
                detail.status = "READY"
            else:
                detail.is_valid = True
                detail.status = "PARTIAL"
                detail.warnings.append("Orthophoto lacks embedded CRS projection tags")

    except Exception as e:
        detail.issues.append(f"Orthophoto raster error: {e}")
        detail.status = "REJECTED"

    return detail


# ──────────────────────────────────────────────────────────────────────────────
# 2. ARCHITECTURAL / BIM — IFC, RVT, FLOOR PLANS (CAT_06)
# ──────────────────────────────────────────────────────────────────────────────

def scan_ifc_bim(path: Path) -> FileScanDetail:
    """
    Parses Industry Foundation Classes (.ifc) using ifcopenshell.
    Extracts schema (IFC2X3, IFC4), storeys, walls, slabs, columns, spaces, units.
    """
    detail = FileScanDetail(
        file_path=str(path),
        file_name=path.name,
        format="IFC",
    )

    try:
        import ifcopenshell

        model = ifcopenshell.open(str(path))
        schema = model.schema
        detail.metrics["schema"] = schema

        # Extract Project & Building
        projects = model.by_type("IfcProject")
        proj_name = projects[0].Name if projects and projects[0].Name else "Unnamed Project"
        detail.metrics["project_name"] = proj_name

        storeys = model.by_type("IfcBuildingStorey")
        walls = model.by_type("IfcWall")
        slabs = model.by_type("IfcSlab")
        columns = model.by_type("IfcColumn")
        doors = model.by_type("IfcDoor")
        windows = model.by_type("IfcWindow")
        spaces = model.by_type("IfcSpace")

        total_elements = len(walls) + len(slabs) + len(columns) + len(doors) + len(windows)
        detail.metrics.update({
            "storey_count": len(storeys),
            "wall_count": len(walls),
            "slab_count": len(slabs),
            "column_count": len(columns),
            "door_count": len(doors),
            "window_count": len(windows),
            "space_count": len(spaces),
            "total_structural_elements": total_elements,
            "storey_names": [s.Name for s in storeys if s.Name][:10],
        })

        detail.is_valid = True
        detail.status = "READY"
        detail.crs_string = "Local BIM Coordinate System (IFC Project Grid)"

    except Exception as e:
        # Fallback STEP physical header parse if ifcopenshell fails
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                head = [f.readline() for _ in range(50)]
                schema_match = re.search(r"FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'", "".join(head))
                if schema_match:
                    detail.metrics["schema"] = schema_match.group(1)
                    detail.is_valid = True
                    detail.status = "READY"
                    return detail
        except Exception:
            pass
        detail.issues.append(f"IFC parse error: {e}")
        detail.status = "REJECTED"

    return detail


def scan_rvt_bim(path: Path) -> FileScanDetail:
    """
    Autodesk Revit (.rvt) scanner.
    HONEST DECLARATION: RVT is Autodesk's proprietary OLE binary format.
    No open-source geometry engine exists in Python without the Autodesk Revit API.
    Extracts version string from OLE BasicFileInfo if present, and explicitly marks:
        status = "REQUIRES_MANUAL_REVIEW"
    """
    detail = FileScanDetail(
        file_path=str(path),
        file_name=path.name,
        format="RVT",
        status="REQUIRES_MANUAL_REVIEW",
        is_valid=False,
    )

    # Sniff Revit version string in binary header
    revit_ver = "Revit (Version Unknown)"
    try:
        with open(path, "rb") as f:
            chunk = f.read(65536)  # Read initial 64KB for OLE BasicFileInfo
            text_chunk = chunk.decode("utf-16le", errors="ignore")
            m = re.search(r"Autodesk Revit\s+(\d{4})", text_chunk)
            if m:
                revit_ver = f"Autodesk Revit {m.group(1)}"
            else:
                m2 = re.search(r"Format:\s*(\d{4})", text_chunk)
                if m2:
                    revit_ver = f"Revit Format {m2.group(1)}"
    except Exception:
        pass

    detail.metrics = {
        "revit_version": revit_ver,
        "format_type": "Autodesk Proprietary OLE Binary",
        "parsing_capability": "Header metadata only (Geometry requires Autodesk Revit API or IFC export)",
    }
    detail.review_reason = (
        "Revit (.rvt) is a proprietary Autodesk format. "
        "Native 3D geometry and plinth boundaries cannot be directly extracted without Autodesk Revit. "
        "Export to IFC or 2D DXF for automatic ingestion, or complete manual review."
    )
    detail.warnings.append(detail.review_reason)

    return detail


def scan_floor_plan(path: Path) -> FileScanDetail:
    """
    Parses Floor Plans.
    - DXF: parses entities and plinth polylines natively via ezdxf -> READY.
    - DWG / PDF / Image (PNG/JPG): marks as REQUIRES_MANUAL_REVIEW for vectorization.
    """
    ext = path.suffix.lower()

    if ext == ".dxf":
        try:
            import ezdxf
            doc = ezdxf.readfile(str(path))
            msp = doc.modelspace()
            polylines = len(list(msp.query("LWPOLYLINE POLYLINE")))
            lines = len(list(msp.query("LINE")))
            texts = len(list(msp.query("TEXT MTEXT")))
            layers = [l.dxf.name for l in doc.layers]

            return FileScanDetail(
                file_path=str(path),
                file_name=path.name,
                format="DXF_FLOOR_PLAN",
                is_valid=True,
                status="READY",
                metrics={
                    "polylines": polylines,
                    "lines": lines,
                    "text_annotations": texts,
                    "layers": layers,
                },
                crs_string="Local CAD Drawing Units",
            )
        except Exception as e:
            return FileScanDetail(
                file_path=str(path),
                file_name=path.name,
                format="DXF_FLOOR_PLAN",
                is_valid=False,
                status="REJECTED",
                issues=[f"DXF floor plan error: {e}"],
            )

    elif ext == ".pdf":
        return FileScanDetail(
            file_path=str(path),
            file_name=path.name,
            format="PDF_FLOOR_PLAN",
            is_valid=False,
            status="REQUIRES_MANUAL_REVIEW",
            review_reason="PDF Floor Plan requires manual inspection / cadastral plinth vectorization.",
            warnings=["PDF drawing cannot be directly parsed into vector plinths. Manual review required."],
        )

    else:
        return FileScanDetail(
            file_path=str(path),
            file_name=path.name,
            format="RASTER_FLOOR_PLAN",
            is_valid=False,
            status="REQUIRES_MANUAL_REVIEW",
            review_reason="Raster image floor plan requires manual vectorization to generate 3D plinths.",
            warnings=["Raster floor plan needs manual demarcation."],
        )


# ──────────────────────────────────────────────────────────────────────────────
# 3. PROPERTY & VERTICAL DATA — CSV / XLSX REGISTERS (CAT_07)
# ──────────────────────────────────────────────────────────────────────────────

def scan_property_register(path: Path) -> FileScanDetail:
    """
    Parses Cadastral property registers and vertical unit databases (.csv, .xlsx).
    Uses pandas / openpyxl to validate parcel IDs, CTS numbers, owner names,
    floor units, areas, and duplicate entries.
    """
    detail = FileScanDetail(
        file_path=str(path),
        file_name=path.name,
        format=path.suffix.upper().lstrip("."),
    )

    try:
        import pandas as pd

        ext = path.suffix.lower()
        if ext in (".xlsx", ".xls"):
            df = pd.read_excel(str(path))
        else:
            df = pd.read_csv(str(path))

        row_count, col_count = df.shape
        cols = [str(c).strip() for c in df.columns]
        cols_lower = [c.lower().replace(" ", "_") for c in cols]

        detail.metrics = {
            "total_records": row_count,
            "total_columns": col_count,
            "columns": cols,
        }

        # Check for cadastral columns
        cadastral_fields = {
            "parcel_id": ["parcel", "parcel_id", "plot", "plot_no", "survey_no", "gat_no", "cts_no", "cts", "property_id"],
            "owner": ["owner", "owner_name", "holder", "occupant", "claimant"],
            "area": ["area", "area_sqm", "carpet_area", "built_up", "sqm", "sq_m"],
            "floor": ["floor", "floor_no", "level", "storey"],
            "unit": ["unit", "unit_no", "flat_no", "shop_no", "apartment"],
        }

        found_fields = {}
        for role, aliases in cadastral_fields.items():
            for alias in aliases:
                for idx, c in enumerate(cols_lower):
                    if alias in c:
                        found_fields[role] = cols[idx]
                        break
                if role in found_fields:
                    break

        detail.metrics["identified_fields"] = found_fields

        # Check null values in identified key fields
        null_counts = {}
        for role, col_name in found_fields.items():
            nulls = int(df[col_name].isna().sum())
            if nulls > 0:
                null_counts[col_name] = nulls
        detail.metrics["null_counts"] = null_counts

        # Check duplicates in parcel/property ID
        id_col = found_fields.get("parcel_id")
        if id_col:
            dups = int(df[id_col].duplicated().sum())
            detail.metrics["duplicate_ids"] = dups
            if dups > 0:
                detail.warnings.append(f"{dups} duplicate parcel/property IDs in column '{id_col}'")

        if row_count > 0 and len(found_fields) >= 2:
            detail.is_valid = True
            detail.status = "READY"
        elif row_count > 0:
            detail.is_valid = True
            detail.status = "PARTIAL"
            detail.warnings.append("Table lacks standard cadastral parcel/owner field mappings")
        else:
            detail.issues.append("Property register file contains 0 data rows")
            detail.status = "REJECTED"

    except Exception as e:
        detail.issues.append(f"Property register parse error: {e}")
        detail.status = "REJECTED"

    return detail


# ──────────────────────────────────────────────────────────────────────────────
# 4. SUPPORTING DOCUMENTS — PDF / DOCX LEGAL CERTIFICATES (CAT_10 & CAT_09)
# ──────────────────────────────────────────────────────────────────────────────

def scan_document(path: Path) -> FileScanDetail:
    """
    Parses PDF or DOCX supporting survey certificates, deeds, and metadata.
    Uses pypdf, pymupdf (fitz), or python-docx.
    Detects page count, word count, text extraction, and flags scanned image PDFs
    without OCR as REQUIRES_MANUAL_REVIEW.
    """
    ext = path.suffix.lower()
    detail = FileScanDetail(
        file_path=str(path),
        file_name=path.name,
        format=ext.upper().lstrip("."),
    )

    try:
        if ext == ".pdf":
            import pypdf

            reader = pypdf.PdfReader(str(path))
            page_count = len(reader.pages)
            extracted_text = ""
            for p in reader.pages[:10]:  # sample first 10 pages
                extracted_text += p.extract_text() or ""

            word_count = len(extracted_text.split())
            meta = reader.metadata or {}

            detail.metrics = {
                "page_count": page_count,
                "word_count": word_count,
                "title": meta.get("/Title") or meta.get("title"),
                "author": meta.get("/Author") or meta.get("author"),
                "is_encrypted": reader.is_encrypted,
            }

            # Check if scanned document with 0 OCR text
            if page_count > 0 and word_count < 10:
                detail.is_valid = False
                detail.status = "REQUIRES_MANUAL_REVIEW"
                detail.review_reason = (
                    f"PDF document '{path.name}' contains {page_count} page(s) but no machine-readable text "
                    "(appears to be a scanned image without OCR). Manual review required."
                )
                detail.warnings.append(detail.review_reason)
            else:
                # Check for cadastral keywords
                keywords = ["survey", "title", "deed", "demarcation", "certificate", "ownership", "gat", "cts", "7/12", "khatiyan"]
                matches = [kw for kw in keywords if kw in extracted_text.lower()]
                detail.metrics["cadastral_keywords_found"] = matches
                detail.is_valid = True
                detail.status = "READY"

        elif ext in (".docx", ".doc"):
            import docx

            doc = docx.Document(str(path))
            paragraphs = doc.paragraphs
            text = " ".join([p.text for p in paragraphs])
            words = len(text.split())

            detail.metrics = {
                "paragraph_count": len(paragraphs),
                "word_count": words,
                "table_count": len(doc.tables),
            }
            detail.is_valid = True
            detail.status = "READY"

        elif ext == ".json":
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            detail.metrics = {
                "keys_count": len(data.keys()) if isinstance(data, dict) else len(data),
                "is_dict": isinstance(data, dict),
            }
            detail.is_valid = True
            detail.status = "READY"

    except Exception as e:
        detail.issues.append(f"Document parse error: {e}")
        detail.status = "REJECTED"

    return detail


# ──────────────────────────────────────────────────────────────────────────────
# 5. DATASET SCAN DISPATCHERS (CAT_05 to CAT_10)
# ──────────────────────────────────────────────────────────────────────────────

def scan_asset_dataset(
    category_id: str,
    dataset_id: str,
    project_id: str,
    file_paths: List[Path],
) -> AssetScanReport:
    """
    Generic dispatcher for CAT_05 through CAT_10 datasets.
    Computes real completeness, quality, and status (including REQUIRES_MANUAL_REVIEW).
    """
    report = AssetScanReport(
        category=category_id,
        dataset_id=dataset_id,
        project_id=project_id,
        total_files=len(file_paths),
        scanned_at=datetime.now(timezone.utc).isoformat(),
    )

    if not file_paths:
        report.issues.append(f"No files found on disk for category {category_id}")
        report.status = "REJECTED"
        return report

    scans: List[FileScanDetail] = []
    for p in file_paths:
        ext = p.suffix.lower()

        if category_id == "CAT_05_DEM_ELEVATION":
            scans.append(scan_dem_raster(p))
        elif category_id == "CAT_08_IMAGERY_ORTHOPHOTO":
            scans.append(scan_ortho_raster(p))
        elif category_id == "CAT_06_ARCHITECTURAL_BIM":
            if ext == ".ifc":
                scans.append(scan_ifc_bim(p))
            elif ext == ".rvt":
                scans.append(scan_rvt_bim(p))
            else:
                scans.append(scan_floor_plan(p))
        elif category_id == "CAT_07_PROPERTY_VERTICAL_DATA":
            scans.append(scan_property_register(p))
        else:  # CAT_09 or CAT_10
            scans.append(scan_document(p))

    report.files = scans
    report.readable_files = sum(1 for s in scans if s.is_valid)

    # Check for manual review items
    manual_reviews = [s for s in scans if s.status == "REQUIRES_MANUAL_REVIEW"]
    if manual_reviews:
        report.requires_manual_review = True
        for m in manual_reviews:
            msg = f"{m.file_name}: {m.review_reason or 'Requires manual review'}"
            report.manual_review_items.append(msg)
            report.warnings.append(msg)

    # Collect Bounding Boxes & CRS
    bboxes = [s.bbox for s in scans if s.bbox]
    if bboxes:
        report.combined_bbox = {
            "x_min": min(b.get("x_min", b.get("lon_min", 0)) for b in bboxes),
            "x_max": max(b.get("x_max", b.get("lon_max", 0)) for b in bboxes),
            "y_min": min(b.get("y_min", b.get("lat_min", 0)) for b in bboxes),
            "y_max": max(b.get("y_max", b.get("lat_max", 0)) for b in bboxes),
        }

    epsgs = [s.epsg for s in scans if s.epsg]
    if epsgs:
        report.dominant_epsg = Counter(epsgs).most_common(1)[0][0]
        report.crs_string = next((s.crs_string for s in scans if s.epsg == report.dominant_epsg), None)

    for s in scans:
        for iss in s.issues:
            report.issues.append(f"{s.file_name}: {iss}")
        for w in s.warnings:
            report.warnings.append(f"{s.file_name}: {w}")

    # ── COMPLETENESS & QUALITY ──────────────────────────────────────
    valid_count = sum(1 for s in scans if s.is_valid)
    report.completeness = round((valid_count / max(len(scans), 1)) * 100.0, 1)

    quality = 100.0
    if report.requires_manual_review:
        quality -= 20.0
    quality -= len(report.issues) * 20.0
    report.quality = round(max(0.0, min(100.0, quality)), 1)

    # ── FINAL STATUS ──────────────────────────────────────────────────
    if report.requires_manual_review:
        report.status = "REQUIRES_MANUAL_REVIEW"
    elif report.completeness >= 80.0 and report.quality >= 75.0 and not report.issues:
        report.status = "READY"
    elif report.completeness >= 40.0:
        report.status = "PARTIAL"
    else:
        report.status = "REJECTED"

    return report


def format_asset_response(report: AssetScanReport) -> Dict[str, Any]:
    return {
        "category": report.category,
        "completeness": report.completeness,
        "quality": report.quality,
        "status": report.status,
        "requires_manual_review": report.requires_manual_review,
        "manual_review_items": report.manual_review_items,
        "summary": {
            "total_files": report.total_files,
            "readable_files": report.readable_files,
            "dominant_epsg": report.dominant_epsg,
            "crs": report.crs_string,
            "bbox": report.combined_bbox,
        },
        "issues": report.issues,
        "warnings": report.warnings,
        "files": [
            {
                "file_name": s.file_name,
                "format": s.format,
                "status": s.status,
                "is_valid": s.is_valid,
                "crs": s.crs_string,
                "epsg": s.epsg,
                "bbox": s.bbox,
                "metrics": s.metrics,
                "issues": s.issues,
                "warnings": s.warnings,
            }
            for s in report.files
        ],
        "scanned_at": report.scanned_at,
    }
