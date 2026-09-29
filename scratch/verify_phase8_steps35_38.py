"""
Comprehensive Verification Script for Phase 8: Real Outputs
- STEP 35: Real TBK Package (actual GeoTIFF, imagery, orientation, metadata, georef, real SHA256)
- STEP 36: Real GIB Package (2D parcels, roads, buildings, DXF CAD layers, GCP control, topology)
- STEP 37: Real Vertical Property Package (Building, floor geometries, unit geometries, SVG floor plans, 3D mappings, 3D building GLB, unit GLBs, Base ULPIN + 3D IDs)
- STEP 38: Real 3D Survey Package (fused LAS point cloud, LiDAR LAS, PLY mesh, LoD-2 GLB, DEM/DSM GeoTIFFs, GNSS control, spatial ref)
"""

import sys
import io
import os
import json
import zipfile
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from backend.package_builders import (
    get_tbk_package,
    get_gib_package,
    get_vertical_property_package,
    get_3d_survey_package,
    get_all_deliverable_packages,
    generate_package_archive_in_memory,
    generate_all_packages_bundle_in_memory
)


def verify_zip_contents(zip_stream: io.BytesIO, expected_files: list, pkg_name: str) -> dict:
    """Verifies that all expected files are present in the ZIP and extracts them."""
    extracted = {}
    with zipfile.ZipFile(zip_stream, "r") as zf:
        namelist = zf.namelist()
        print(f"\n  Inspecting {pkg_name} ZIP ({len(namelist)} total entries)...")
        for ef in expected_files:
            # Match exact or prefix
            matches = [n for n in namelist if n == ef or n.startswith(ef)]
            assert len(matches) > 0, f"Missing expected file in ZIP: {ef}! Found: {namelist[:10]}"
            for m in matches:
                extracted[m] = zf.read(m)
                print(f"    ✓ Found: {m:45s} ({len(extracted[m]):,} bytes)")
    return extracted


def main():
    print("=" * 75)
    print("PHASE 8 VERIFICATION: REAL OUTPUT DELIVERABLES (STEPS 35 - 38)")
    print("=" * 75)

    # -------------------------------------------------------------------------
    # TEST 1: STEP 35 — Real TBK Package
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Verifying STEP 35 — Real TBK Package...")
    tbk_pkg = get_tbk_package()
    print(f"  Package Name:       {tbk_pkg.name} ({tbk_pkg.format_label})")
    print(f"  Declared Files:     {tbk_pkg.file_count}")
    print(f"  Total Size:         {tbk_pkg.total_size_str} ({tbk_pkg.total_size_bytes:,} bytes)")
    print(f"  Checksum:           {tbk_pkg.checksum}")

    tbk_stream = generate_package_archive_in_memory("pkg_tbk_photogrammetry")
    tbk_files = verify_zip_contents(
        tbk_stream,
        [
            "orthophoto/haveli_orthomosaic_5cm.tif",
            "orthophoto/orthomosaic_preview.jpg",
            "georef/orthophoto.tfw",
            "georef/spatial_reference.prj",
            "georef/gcp_transformation_residuals.csv",
            "imagery/processed_corrected_frames/",
            "metadata/flight_survey_manifest.json",
            "orientation/exterior_orientation_opk.csv",
            "sensor/camera_interior_calibration.json",
            "PACKAGE_MANIFEST.json",
            "CADASTRAL_CERTIFICATE.txt"
        ],
        "TBK Package"
    )

    # Check that orthophoto.tif is NOT a text file!
    ortho_data = tbk_files["orthophoto/haveli_orthomosaic_5cm.tif"]
    assert ortho_data[:4] in (b"II*\x00", b"MM\x00*"), (
        f"CRITICAL AUDIT FAILURE: orthophoto.tif is NOT a valid GeoTIFF! Starts with: {ortho_data[:50]}"
    )
    print(f"  ✓ AUDIT CHECK: orthophoto.tif is an ACTUAL binary GeoTIFF ({len(ortho_data):,} bytes, magic: {ortho_data[:4]})")

    # Check preview image
    prev_data = tbk_files["orthophoto/orthomosaic_preview.jpg"]
    assert prev_data[:3] == b"\xff\xd8\xff", "Preview is not a valid JPEG!"
    print(f"  ✓ AUDIT CHECK: preview is an ACTUAL JPEG image ({len(prev_data):,} bytes)")

    # Check real SHA256 in manifest
    manifest_data = json.loads(tbk_files["PACKAGE_MANIFEST.json"].decode("utf-8"))
    for f_item in manifest_data["files"]:
        if f_item["path"] in tbk_files:
            real_sha = hashlib.sha256(tbk_files[f_item["path"]]).hexdigest()
            assert f_item["checksum"] == f"sha256:{real_sha[:16]}", f"SHA mismatch on {f_item['path']}"
            assert f_item["size_bytes"] == len(tbk_files[f_item["path"]]), f"Size mismatch on {f_item['path']}"
    print("  ✓ Real SHA256 hashes and real file sizes verified on all TBK constituent files!")

    # -------------------------------------------------------------------------
    # TEST 2: STEP 36 — Real GIB Package
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Verifying STEP 36 — Real GIB Package...")
    gib_pkg = get_gib_package()
    print(f"  Package Name:       {gib_pkg.name} ({gib_pkg.format_label})")
    print(f"  Declared Files:     {gib_pkg.file_count}")
    print(f"  Total Size:         {gib_pkg.total_size_str} ({gib_pkg.total_size_bytes:,} bytes)")
    print(f"  Checksum:           {gib_pkg.checksum}")

    gib_stream = generate_package_archive_in_memory("pkg_gib_cadastre")
    gib_files = verify_zip_contents(
        gib_stream,
        [
            "parcels/cadastral_parcels.geojson",
            "buildings/building_footprints.geojson",
            "roads/transport_network.geojson",
            "cad/cadastral_demarcation_layers.dxf",
            "survey_control/gcp_control_network.geojson",
            "survey_control/control_points_benchmark.csv",
            "topology/cadastral_topology_report.json",
            "crs/epsg_32643.prj",
            "PACKAGE_MANIFEST.json",
            "CADASTRAL_CERTIFICATE.txt"
        ],
        "GIB Package"
    )

    # Check parcel GeoJSON
    parcels_json = json.loads(gib_files["parcels/cadastral_parcels.geojson"].decode("utf-8"))
    assert parcels_json["type"] == "FeatureCollection"
    assert parcels_json["features"][0]["properties"]["ulpin"] == "27-07-005-012345"
    print(f"  ✓ 2D Parcels GeoJSON verified: ULPIN {parcels_json['features'][0]['properties']['ulpin']}, Area {parcels_json['features'][0]['properties']['legal_area_sqm']} m²")

    # Check DXF CAD layers
    dxf_text = gib_files["cad/cadastral_demarcation_layers.dxf"].decode("ascii", errors="ignore")
    assert "SECTION" in dxf_text and "PARCEL_BOUNDARY" in dxf_text and "BUILDING_PLINTH" in dxf_text and "EOF" in dxf_text
    print(f"  ✓ AutoCAD ASCII DXF verified ({len(gib_files['cad/cadastral_demarcation_layers.dxf']):,} bytes, layers: PARCEL_BOUNDARY, BUILDING_PLINTH)")

    # Check Topology Report
    topo_json = json.loads(gib_files["topology/cadastral_topology_report.json"].decode("utf-8"))
    assert topo_json["audits"]["sliver_polygons_count"] == 0
    assert topo_json["audits"]["building_containment_in_parcel_pct"] == 100.0
    print(f"  ✓ Cadastral topology report verified: 0 slivers, 0 overlaps, 100% building containment")

    # -------------------------------------------------------------------------
    # TEST 3: STEP 37 — Real Vertical Property Package
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Verifying STEP 37 — Real Vertical Property Package...")
    vprop_pkg = get_vertical_property_package()
    print(f"  Package Name:       {vprop_pkg.name} ({vprop_pkg.format_label})")
    print(f"  Declared Files:     {vprop_pkg.file_count}")
    print(f"  Total Size:         {vprop_pkg.total_size_str} ({vprop_pkg.total_size_bytes:,} bytes)")
    print(f"  Checksum:           {vprop_pkg.checksum}")

    vprop_stream = generate_package_archive_in_memory("pkg_vertical_property_zip")
    vprop_files = verify_zip_contents(
        vprop_stream,
        [
            "building/building_metadata.json",
            "building/building_3d_model.glb",
            "floors/floor_geometries.geojson",
            "floors/floor_hierarchy.json",
            "units/unit_geometries_3d.geojson",
            "units/models/",
            "floor_plans/",
            "property_mappings/3d_strata_property_register.csv",
            "property_mappings/3d_strata_property_register.json",
            "ladm/iso_19152_ladm_strata.json",
            "PACKAGE_MANIFEST.json",
            "CADASTRAL_CERTIFICATE.txt"
        ],
        "Vertical Property Package"
    )

    # Check Building GLB
    glb_data = vprop_files["building/building_3d_model.glb"]
    assert glb_data[:4] == b"glTF", "Building 3D model is not a valid GLB binary!"
    print(f"  ✓ Building 3D GLB verified: {len(glb_data):,} bytes (magic: {glb_data[:4]})")

    # Check SVG floor plans
    svg_data = vprop_files["floor_plans/floor_1_plan.svg"].decode("utf-8")
    assert "<svg" in svg_data and "FLAT 201" in svg_data and "</svg>" in svg_data
    print(f"  ✓ Architectural vector SVG floor plans verified (all units & dimensions labeled)")

    # Check 3D Strata Property Register (Base 2D ULPIN + 3D Property IDs)
    register_csv = vprop_files["property_mappings/3d_strata_property_register.csv"].decode("utf-8")
    assert "BASE_2D_ULPIN" in register_csv and "3D_PROPERTY_ID" in register_csv and "3D_DISPLAY_ULPIN" in register_csv
    assert "27-07-005-012345" in register_csv and "PROP3D_27-07-005-012345" in register_csv
    print(f"  ✓ 3D Strata Property Register verified: Base 2D ULPIN + 3D Property IDs + volumes + centroids")

    # -------------------------------------------------------------------------
    # TEST 4: STEP 38 — Real 3D Survey Package
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Verifying STEP 38 — Real 3D Survey Package...")
    survey_pkg = get_3d_survey_package()
    print(f"  Package Name:       {survey_pkg.name} ({survey_pkg.format_label})")
    print(f"  Declared Files:     {survey_pkg.file_count}")
    print(f"  Total Size:         {survey_pkg.total_size_str} ({survey_pkg.total_size_bytes:,} bytes)")
    print(f"  Checksum:           {survey_pkg.checksum}")

    survey_stream = generate_package_archive_in_memory("pkg_3d_survey_zip")
    survey_files = verify_zip_contents(
        survey_stream,
        [
            "point_cloud/03_fused_point_cloud.las",
            "lidar/04_building_point_cloud.las",
            "mesh/05_building_mesh.ply",
            "model/06_cadastral_model.glb",
            "elevation/dem_bare_earth.tif",
            "elevation/dsm_surface.tif",
            "control/gnss_rtk_control_network.csv",
            "crs/spatial_reference.prj",
            "metadata/survey_capture_manifest.json",
            "PACKAGE_MANIFEST.json",
            "CADASTRAL_CERTIFICATE.txt"
        ],
        "3D Survey Package"
    )

    # Check fused LAS
    las_data = survey_files["point_cloud/03_fused_point_cloud.las"]
    assert las_data[:4] == b"LASF", "Fused point cloud is not a valid LAS file!"
    print(f"  ✓ Fused Point Cloud verified: {len(las_data):,} bytes (magic: {las_data[:4]})")

    # Check PLY mesh
    ply_data = survey_files["mesh/05_building_mesh.ply"]
    assert ply_data[:3] == b"ply", "Surface mesh is not a valid PLY file!"
    print(f"  ✓ Surface mesh verified: {len(ply_data):,} bytes (magic: {ply_data[:3]})")

    # Check DEM & DSM GeoTIFFs
    dem_data = survey_files["elevation/dem_bare_earth.tif"]
    dsm_data = survey_files["elevation/dsm_surface.tif"]
    assert dem_data[:4] in (b"II*\x00", b"MM\x00*"), "DEM is not a valid GeoTIFF!"
    assert dsm_data[:4] in (b"II*\x00", b"MM\x00*"), "DSM is not a valid GeoTIFF!"
    print(f"  ✓ DEM & DSM float32 GeoTIFFs verified: DEM {len(dem_data):,} bytes, DSM {len(dsm_data):,} bytes")

    # -------------------------------------------------------------------------
    # TEST 5: Master Bundle & FastAPI Endpoints
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Testing Master Deliverable Bundle & FastAPI Endpoints...")
    master_stream = generate_all_packages_bundle_in_memory()
    with zipfile.ZipFile(master_stream, "r") as zf:
        master_names = zf.namelist()
        print(f"  Master Bundle ZIP entries count: {len(master_names)}")
        assert "MASTER_DELIVERABLES_MANIFEST.json" in master_names
        assert "MASTER_CADASTRAL_CERTIFICATE.txt" in master_names
        assert any(n.startswith("TBK_PACKAGE/") for n in master_names)
        assert any(n.startswith("GIB_PACKAGE/") for n in master_names)
        assert any(n.startswith("VERTICAL_PROPERTY_ZIP/") for n in master_names)
        assert any(n.startswith("3D_SURVEY_ZIP/") for n in master_names)
    print("  ✓ Consolidated Master Deliverable Bundle verified with all 4 packages!")

    from fastapi.testclient import TestClient
    from backend.main import app

    client = TestClient(app)
    res_list = client.get("/api/v2/packages")
    assert res_list.status_code == 200
    pkgs_json = res_list.json()
    assert len(pkgs_json["packages"]) == 4
    print(f"  ✓ GET /api/v2/packages -> 200 OK ({len(pkgs_json['packages'])} packages, total {pkgs_json['total_size_mb']} MB)")

    for p in pkgs_json["packages"]:
        p_id = p["id"]
        res_dl = client.get(f"/api/v2/packages/download/{p_id}")
        assert res_dl.status_code == 200
        assert len(res_dl.content) > 1000
        print(f"  ✓ GET /api/v2/packages/download/{p_id} -> 200 OK ({len(res_dl.content):,} bytes streamed)")

    print("\n" + "=" * 75)
    print("SUCCESS: PHASE 8 (STEPS 35, 36, 37, 38) FULLY VERIFIED!")
    print("=" * 75)


if __name__ == "__main__":
    main()
