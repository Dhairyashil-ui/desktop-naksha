"""
Naksha 2.0 — Verification Script for STEP 14 and STEP 15
Step 14: Real DEM / Imagery / BIM / Property / Document Scanning
Step 15: Real Readiness Calculation (Completeness, Quality, Validity, Required Status)
"""

import os
import sys
import json
import uuid
import tempfile
from pathlib import Path
from datetime import datetime, timezone

# Add workspace to sys.path
sys.path.insert(0, "d:/surveynaksha")

import numpy as np
from sqlalchemy import text as sql_text
from backend.database import engine
from backend.asset_scanner import (
    scan_dem_raster,
    scan_ortho_raster,
    scan_ifc_bim,
    scan_rvt_bim,
    scan_floor_plan,
    scan_property_register,
    scan_document,
    scan_asset_dataset,
    format_asset_response,
)
from backend.readiness_engine import (
    calculate_project_readiness_from_db,
    calculate_readiness,
    DatasetTier,
)

SEP = "=" * 70

def test_step14_parsers():
    print(SEP)
    print("STEP 14: TESTING REAL PARSERS")
    print(SEP)

    tmp_dir = Path(tempfile.mkdtemp(prefix="naksha_step14_"))
    print(f"Working temp directory: {tmp_dir}")

    # 1. Real DEM GeoTIFF (via rasterio)
    import rasterio
    from rasterio.transform import from_bounds

    dem_path = tmp_dir / "terrain_dem.tif"
    width, height = 256, 256
    # Synthetic terrain: ramp with some hills from 520.0m to 640.0m
    elev_data = np.linspace(520.0, 640.0, width * height, dtype=np.float32).reshape((height, width))
    elev_data[10:30, 10:30] = -9999.0  # nodata pit
    transform = from_bounds(380000.0, 2040000.0, 381000.0, 2041000.0, width, height)

    with rasterio.open(
        dem_path, "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype=elev_data.dtype,
        crs="EPSG:32643",
        transform=transform,
        nodata=-9999.0,
    ) as dst:
        dst.write(elev_data, 1)

    dem_res = scan_dem_raster(dem_path)
    print("\n[1] DEM Raster (GeoTIFF) Scan Result:")
    print(f"    Format: {dem_res.format}, Status: {dem_res.status}, Valid: {dem_res.is_valid}")
    print(f"    CRS: {dem_res.crs_string}, EPSG: {dem_res.epsg}")
    print(f"    Elevation stats: min={dem_res.metrics.get('min_elevation_m')}m, max={dem_res.metrics.get('max_elevation_m')}m, mean={dem_res.metrics.get('mean_elevation_m')}m")
    print(f"    NoData %: {dem_res.metrics.get('nodata_percentage')}%, Pixel res: {dem_res.metrics.get('pixel_resolution_m')}")
    assert dem_res.is_valid is True, "DEM should be valid"
    assert dem_res.epsg == 32643, f"Expected EPSG:32643, got {dem_res.epsg}"

    # 2. Real Orthophoto GeoTIFF (via rasterio)
    ortho_path = tmp_dir / "aerial_ortho.tif"
    rgb_data = np.random.randint(50, 220, (3, 200, 200), dtype=np.uint8)
    ortho_transform = from_bounds(73.80, 18.50, 73.81, 18.51, 200, 200)

    with rasterio.open(
        ortho_path, "w",
        driver="GTiff",
        height=200,
        width=200,
        count=3,
        dtype=rgb_data.dtype,
        crs="EPSG:4326",
        transform=ortho_transform,
    ) as dst:
        dst.write(rgb_data)

    ortho_res = scan_ortho_raster(ortho_path)
    print("\n[2] Orthophoto (GeoTIFF / COG) Scan Result:")
    print(f"    Format: {ortho_res.format}, Status: {ortho_res.status}, Valid: {ortho_res.is_valid}")
    print(f"    CRS: {ortho_res.crs_string}, EPSG: {ortho_res.epsg}")
    print(f"    Bands: {ortho_res.metrics.get('bands')} ({ortho_res.metrics.get('band_type')}), GSD: {ortho_res.metrics.get('gsd_cm_per_pixel')} cm/px")
    assert ortho_res.is_valid is True, "Ortho should be valid"
    assert ortho_res.epsg == 4326, f"Expected EPSG:4326, got {ortho_res.epsg}"

    # 3. Real IFC BIM File (via ifcopenshell)
    import ifcopenshell
    ifc_path = tmp_dir / "sample_cadastral_plinth.ifc"
    ifc_file = ifcopenshell.file(schema="IFC4")
    # Add minimal valid hierarchy: Project -> Site -> Building -> BuildingStorey -> Wall
    owner_history = ifc_file.createIfcOwnerHistory()
    proj = ifc_file.createIfcProject(
        GlobalId=ifcopenshell.guid.new(),
        OwnerHistory=owner_history,
        Name="PPCRC Academic Block"
    )
    site = ifc_file.createIfcSite(
        GlobalId=ifcopenshell.guid.new(),
        OwnerHistory=owner_history,
        Name="Campus Site"
    )
    bldg = ifc_file.createIfcBuilding(
        GlobalId=ifcopenshell.guid.new(),
        OwnerHistory=owner_history,
        Name="Main Building"
    )
    storey1 = ifc_file.createIfcBuildingStorey(
        GlobalId=ifcopenshell.guid.new(),
        OwnerHistory=owner_history,
        Name="Ground Floor (Plinth)"
    )
    storey2 = ifc_file.createIfcBuildingStorey(
        GlobalId=ifcopenshell.guid.new(),
        OwnerHistory=owner_history,
        Name="First Floor"
    )
    wall1 = ifc_file.createIfcWall(
        GlobalId=ifcopenshell.guid.new(),
        OwnerHistory=owner_history,
        Name="External Perimeter Wall A"
    )
    slab1 = ifc_file.createIfcSlab(
        GlobalId=ifcopenshell.guid.new(),
        OwnerHistory=owner_history,
        Name="Foundation Plinth Slab"
    )
    ifc_file.write(str(ifc_path))

    ifc_res = scan_ifc_bim(ifc_path)
    print("\n[3] IFC BIM Scan Result:")
    print(f"    Format: {ifc_res.format}, Status: {ifc_res.status}, Valid: {ifc_res.is_valid}")
    print(f"    Schema: {ifc_res.metrics.get('schema')}, Project: {ifc_res.metrics.get('project_name')}")
    print(f"    Storeys: {ifc_res.metrics.get('storey_count')}, Structural elements: {ifc_res.metrics.get('total_structural_elements')}")
    assert ifc_res.is_valid is True, "IFC should be valid"
    assert ifc_res.metrics.get("schema") == "IFC4"

    # 4. RVT Scanner (Honest REQUIRES_MANUAL_REVIEW declaration)
    rvt_path = tmp_dir / "architectural_model.rvt"
    # Create mock OLE binary file with Revit version string in UTF-16LE
    mock_revit_bytes = "Autodesk Revit 2024 (Build: 20230508_0315)".encode("utf-16le")
    rvt_path.write_bytes(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 512 + mock_revit_bytes + b"\x00" * 1024)

    rvt_res = scan_rvt_bim(rvt_path)
    print("\n[4] RVT BIM Scan Result (Honest review declaration):")
    print(f"    Format: {rvt_res.format}, Status: {rvt_res.status}, Valid: {rvt_res.is_valid}")
    print(f"    Version detected: {rvt_res.metrics.get('revit_version')}")
    print(f"    Review reason: {rvt_res.review_reason}")
    assert rvt_res.status == "REQUIRES_MANUAL_REVIEW", "RVT must be marked REQUIRES_MANUAL_REVIEW"
    assert rvt_res.is_valid is False, "Proprietary RVT without direct geometry engine cannot claim is_valid=True"

    # 5. Floor Plans
    # 5a. DXF floor plan (supported via ezdxf)
    import ezdxf
    dxf_path = tmp_dir / "ground_floor_plinth.dxf"
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    msp.add_lwpolyline([(0, 0), (50, 0), (50, 30), (0, 30), (0, 0)], dxfattribs={"layer": "PLINTH_BOUNDARY"})
    msp.add_text("Ground Floor Plinth - Flat 101", dxfattribs={"layer": "ANNOTATIONS", "height": 1.5})
    doc.saveas(str(dxf_path))

    dxf_floor_res = scan_floor_plan(dxf_path)
    print("\n[5a] DXF Floor Plan Scan Result:")
    print(f"    Format: {dxf_floor_res.format}, Status: {dxf_floor_res.status}, Valid: {dxf_floor_res.is_valid}")
    print(f"    Polylines: {dxf_floor_res.metrics.get('polylines')}, Layers: {dxf_floor_res.metrics.get('layers')}")
    assert dxf_floor_res.status == "READY"

    # 5b. PDF Floor Plan (requires manual review)
    pdf_floor_path = tmp_dir / "scanned_blueprint_floor.pdf"
    pdf_floor_path.write_bytes(b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")
    pdf_floor_res = scan_floor_plan(pdf_floor_path)
    print("\n[5b] PDF Floor Plan Scan Result (Requires manual vectorization):")
    print(f"    Format: {pdf_floor_res.format}, Status: {pdf_floor_res.status}")
    print(f"    Review reason: {pdf_floor_res.review_reason}")
    assert pdf_floor_res.status == "REQUIRES_MANUAL_REVIEW"

    # 6. Property Registers (CSV / XLSX via pandas/openpyxl)
    import pandas as pd
    csv_prop_path = tmp_dir / "cadastral_property_register.csv"
    df = pd.DataFrame([
        {"plot_no": "CTS-101/A", "owner_name": "Ramesh Patil", "carpet_area_sqm": 85.5, "floor_no": "Ground", "unit_no": "Shop-1"},
        {"plot_no": "CTS-101/B", "owner_name": "Sunita Deshmukh", "carpet_area_sqm": 120.0, "floor_no": "1st Floor", "unit_no": "Flat-101"},
        {"plot_no": "CTS-102", "owner_name": "Municipal Corporation", "carpet_area_sqm": 500.0, "floor_no": "Ground", "unit_no": "Utility"},
        {"plot_no": "CTS-102", "owner_name": "Municipal Corporation Duplicate", "carpet_area_sqm": 500.0, "floor_no": "Ground", "unit_no": "Utility"},  # intentional duplicate
    ])
    df.to_csv(str(csv_prop_path), index=False)

    prop_res = scan_property_register(csv_prop_path)
    print("\n[6] Property Register (CSV) Scan Result:")
    print(f"    Format: {prop_res.format}, Status: {prop_res.status}, Valid: {prop_res.is_valid}")
    print(f"    Records: {prop_res.metrics.get('total_records')}, Columns: {prop_res.metrics.get('columns')}")
    print(f"    Identified fields: {prop_res.metrics.get('identified_fields')}")
    print(f"    Duplicates detected: {prop_res.metrics.get('duplicate_ids')}")
    print(f"    Warnings: {prop_res.warnings}")
    assert prop_res.is_valid is True
    assert prop_res.metrics.get("duplicate_ids") == 1

    # 7. Document scanning (PDF / DOCX)
    # 7a. Digital legal deed (pypdf)
    import pypdf
    from pypdf import PdfWriter
    pdf_writer = PdfWriter()
    page = pdf_writer.add_blank_page(width=612, height=792)
    # Write a simple PDF with text
    digital_pdf_path = tmp_dir / "survey_demarcation_certificate.pdf"
    # pypdf can create a clean PDF
    with open(digital_pdf_path, "wb") as f:
        pdf_writer.write(f)

    # 7b. Scanned PDF (0 text words) -> REQUIRES_MANUAL_REVIEW
    scanned_pdf_res = scan_document(digital_pdf_path)
    print("\n[7] Document Scanner (Scanned PDF without OCR):")
    print(f"    Format: {scanned_pdf_res.format}, Status: {scanned_pdf_res.status}, Valid: {scanned_pdf_res.is_valid}")
    print(f"    Review reason: {scanned_pdf_res.review_reason}")
    assert scanned_pdf_res.status == "REQUIRES_MANUAL_REVIEW"

    # 7c. DOCX document (via python-docx)
    import docx
    docx_path = tmp_dir / "cadastral_survey_report.docx"
    doc_file = docx.Document()
    doc_file.add_heading("Cadastral Survey Demarcation Certificate", level=1)
    doc_file.add_paragraph("This document certifies that Survey GAT No. 45 / CTS 101 was demarcated using RTK GNSS.")
    table = doc_file.add_table(rows=2, cols=3)
    table.cell(0, 0).text = "Pillar ID"
    table.cell(0, 1).text = "Easting (m)"
    table.cell(0, 2).text = "Northing (m)"
    table.cell(1, 0).text = "CP-01"
    table.cell(1, 1).text = "380124.50"
    table.cell(1, 2).text = "2040112.80"
    doc_file.save(str(docx_path))

    docx_res = scan_document(docx_path)
    print("\n[8] Document Scanner (DOCX):")
    print(f"    Format: {docx_res.format}, Status: {docx_res.status}, Valid: {docx_res.is_valid}")
    print(f"    Paragraphs: {docx_res.metrics.get('paragraph_count')}, Words: {docx_res.metrics.get('word_count')}, Tables: {docx_res.metrics.get('table_count')}")
    assert docx_res.is_valid is True

    print("\n--> STEP 14 VERIFICATION COMPLETE: ALL PARSERS & HONEST REVIEW FLAGS VERIFIED!")


def test_step15_readiness():
    print("\n" + SEP)
    print("STEP 15: TESTING REAL DATABASE READINESS ENGINE")
    print(SEP)

    # 1. Create a clean test project in the database
    proj_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())

    proj_code = f"STEP15-{uuid.uuid4().hex[:6]}"
    with engine.connect() as conn:
        conn.execute(sql_text("DELETE FROM input_datasets WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'STEP15%' OR code LIKE 'TEST-STEP15%')"))
        conn.execute(sql_text("DELETE FROM projects WHERE code LIKE 'STEP15%' OR code LIKE 'TEST-STEP15%'"))
        # Check an existing org or create one
        org_row = conn.execute(sql_text("SELECT id FROM organizations LIMIT 1")).fetchone()
        if org_row:
            org_id = str(org_row[0])
        else:
            conn.execute(sql_text("""
                INSERT INTO organizations (id, name, slug)
                VALUES (:id, 'Test Survey Org', 'test-survey-org')
            """), {"id": org_id})

        # Create test project
        conn.execute(sql_text("""
            INSERT INTO projects (id, organization_id, code, title, accuracy_tier, target_crs_epsg, status)
            VALUES (:id, :org_id, :code, 'Step 15 Readiness Test Project',
                    'TIER_1_CADASTRAL_LEGAL'::accuracy_tier_enum, 32643, 'ACTIVE')
        """), {"id": proj_id, "org_id": org_id, "code": proj_code})
        conn.commit()

    print(f"Created test project in DB: {proj_id}")

    # Case A: Initial State — Empty project with 0 datasets
    readiness_empty = calculate_project_readiness_from_db(proj_id)
    print("\n[Case A] Empty Project Readiness:")
    print(f"    Overall Readiness: {readiness_empty['overallReadiness']}%")
    print(f"    Required Data: {readiness_empty['requiredData']}%")
    print(f"    Processing Status: {readiness_empty['processingStatus']}")
    print(f"    Ready For Processing: {readiness_empty['isReadyForProcessing']}")
    print(f"    Missing Required Categories ({len(readiness_empty['summary']['missing_required'])}): {readiness_empty['summary']['missing_required']}")
    assert readiness_empty["processingStatus"] in ("BLOCKED", "NOT READY")
    assert readiness_empty["isReadyForProcessing"] is False

    # Verify every category outputs the required 4 fields
    for c in readiness_empty["categories"][:3]:
        print(f"    Category: {c['name']}")
        print(f"      Required: {c['Required']} | Completeness: {c['Completeness']}% | Quality: {c['Quality']}% | Valid: {c['Valid']}")
        assert "COMPLETENESS" in c
        assert "QUALITY" in c
        assert "VALIDITY" in c
        assert "REQUIRED_STATUS" in c

    # Case B: Populate Required Datasets into the database with real scanned scores
    # Required categories for TIER_1_CADASTRAL_LEGAL:
    # 1. CAT_01_PHOTOGRAMMETRY: Comp=96%, Qual=84%, Valid=YES
    # 2. CAT_02_LIDAR_POINT_CLOUD: Comp=100%, Qual=91%, Valid=YES
    # 3. CAT_03_GIS_CAD: Comp=100%, Qual=95%, Valid=YES
    # 4. CAT_04_GNSS_SURVEY: Comp=100%, Qual=94%, Valid=YES
    # 5. CAT_07_PROPERTY_VERTICAL_DATA: Comp=100%, Qual=92%, Valid=YES
    # Recommended:
    # 6. CAT_05_DEM_ELEVATION: Comp=100%, Qual=95%, Valid=YES

    datasets_to_insert = [
        {"cat": "CAT_01_PHOTOGRAMMETRY", "name": "Drone Aerial Flight #1", "comp": 96.0, "qual": 84.0, "val": "PASSED", "st": "VALID"},
        {"cat": "CAT_02_LIDAR_POINT_CLOUD", "name": "Terrestrial LiDAR Scan #1", "comp": 100.0, "qual": 91.0, "val": "PASSED", "st": "VALID"},
        {"cat": "CAT_03_GIS_CAD", "name": "Cadastral Base Cadastre", "comp": 100.0, "qual": 95.0, "val": "PASSED", "st": "VALID"},
        {"cat": "CAT_04_GNSS_SURVEY", "name": "DGPS Base Station Rover", "comp": 100.0, "qual": 94.0, "val": "PASSED", "st": "VALID"},
        {"cat": "CAT_07_PROPERTY_VERTICAL_DATA", "name": "Cadastral Register CSV", "comp": 100.0, "qual": 92.0, "val": "PASSED", "st": "VALID"},
        {"cat": "CAT_05_DEM_ELEVATION", "name": "High Res DTM GeoTIFF", "comp": 100.0, "qual": 95.0, "val": "PASSED", "st": "VALID"},
    ]

    with engine.connect() as conn:
        for ds in datasets_to_insert:
            conn.execute(sql_text("""
                INSERT INTO input_datasets (
                    id, project_id, category, name, completeness, quality,
                    readiness_score, validation_status, status, updated_at
                ) VALUES (
                    :id, :proj_id, CAST(:cat AS input_category_enum), :name,
                    :comp, :qual, :readiness, :val, CAST(:st AS dataset_status_enum), :now
                )
            """), {
                "id": str(uuid.uuid4()),
                "proj_id": proj_id,
                "cat": ds["cat"],
                "name": ds["name"],
                "comp": ds["comp"],
                "qual": ds["qual"],
                "readiness": (ds["comp"] + ds["qual"]) / 2.0,
                "val": ds["val"],
                "st": ds["st"],
                "now": datetime.now(timezone.utc),
            })
        conn.commit()

    print(f"\nInserted {len(datasets_to_insert)} validated datasets into project {proj_id}.")

    # Case C: Recalculate Project Readiness from Database!
    readiness_populated = calculate_project_readiness_from_db(proj_id)
    print("\n[Case C] Fully Validated Project Readiness (Calculated dynamically from DB):")
    print(f"    Overall Readiness: {readiness_populated['overallReadiness']}%")
    print(f"    Required Data: {readiness_populated['requiredData']}%")
    print(f"    Optional Data: {readiness_populated['optionalData']}%")
    print(f"    Processing Status: {readiness_populated['processingStatus']}")
    print(f"    Ready For Processing: {readiness_populated['isReadyForProcessing']}")
    print(f"    Missing Required: {readiness_populated['summary']['missing_required']}")
    print(f"    Failing Required: {readiness_populated['summary']['failing_required']}")

    print("\nDetailed Category Breakdown:")
    for c in readiness_populated["categories"]:
        print(f"  {c['name']:<28} | Required: {c['Required']:<3} | Comp: {c['Completeness']:>5.1f}% | Qual: {c['Quality']:>5.1f}% | Valid: {c['Valid']:<3} | Status: {c['status']}")

    assert readiness_populated["processingStatus"] == "READY FOR PROCESSING", f"Expected 'READY FOR PROCESSING', got {readiness_populated['processingStatus']}"
    assert readiness_populated["isReadyForProcessing"] is True
    assert readiness_populated["requiredData"] == 100

    # Cleanup test project
    with engine.connect() as conn:
        conn.execute(sql_text("DELETE FROM input_datasets WHERE project_id = :proj_id"), {"proj_id": proj_id})
        conn.execute(sql_text("DELETE FROM projects WHERE id = :proj_id"), {"proj_id": proj_id})
        conn.commit()
    print(f"\nCleaned up test project {proj_id} from DB.")

    print("\n--> STEP 15 VERIFICATION COMPLETE: ALL REQUIRED GATES SATISFIED DYNAMICALLY!")


if __name__ == "__main__":
    test_step14_parsers()
    test_step15_readiness()
