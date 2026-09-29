"""
Canonical Project Builder for Naksha 2.0.
Phase 15: Builds the canonical data representation for Pune Residential 001.
"""

from typing import List
from .models import (
    CanonicalProject,
    Parcel,
    Building,
    Floor,
    CadastralUnit,
    GeometryStore,
    Coordinates,
    BoundingBox3D,
    SurveyData,
    GovernmentRecords,
    RoRRecord,
    ValidationReport
)

def build_canonical_project_pune_001() -> CanonicalProject:
    """
    Constructs the canonical geospatial data model instance for Pune Residential 001.
    """
    project_id = "project_pune_res_001"
    parcel_id = "parcel_haveli_142b"
    building_id = "bldg_shivaji_heights_a"

    # 1. Parcel (Survey No 142/B)
    parcel = Parcel(
        id=parcel_id,
        ulpin="MH-PUN-2026-0942",
        state_code="27",
        district="Pune",
        taluka="Haveli",
        village="Haveli",
        survey_number="142",
        sub_division="B",
        land_use="RESIDENTIAL",
        legal_recorded_area_sqm=1250.00,
        gis_computed_area_sqm=1249.85,
        area_delta_percentage=0.012,
        perimeter_meters=144.20,
        boundary_coordinates=[
            [385420.0, 2048150.0],
            [385455.0, 2048152.0],
            [385452.0, 2048190.0],
            [385418.0, 2048188.0],
            [385420.0, 2048150.0]
        ]
    )

    # 2. Building & 8 Floors
    floors: List[Floor] = []
    floor_count = 8
    base_elevation = 542.15
    floor_height = 1.5

    for f in range(floor_count):
        floor_id = f"floor_{f}"
        floor_label = f"Floor {f}" if f > 0 else "Ground Floor (Floor 0)"
        elev_min = base_elevation + (f * floor_height)
        elev_max = elev_min + floor_height

        unit_ids = [f"unit_{(f + 1) * 100 + u + 1}" for u in range(8)]
        floors.append(Floor(
            id=floor_id,
            building_id=building_id,
            floor_number=f,
            floor_label=floor_label,
            elevation_min_z=round(elev_min, 2),
            elevation_max_z=round(elev_max, 2),
            height_meters=floor_height,
            slab_thickness_meters=0.18,
            units_count=8,
            unit_ids=unit_ids
        ))

    building = Building(
        id=building_id,
        parcel_id=parcel_id,
        building_code="BLDG-A",
        name="Shivaji Heights Wing A",
        structure_type="RCC_RESIDENTIAL",
        floors_above_ground=8,
        floors_below_ground=1,
        ground_elevation_z=base_elevation,
        height_meters=12.0,
        footprint_area_sqm=320.0,
        gross_built_up_area_sqm=2560.0,
        floors=floors
    )

    # 3. 64 Strata Units & Matching Government Records
    units: List[CadastralUnit] = []
    ror_records: List[RoRRecord] = []

    owners_sample = [
        "Rajesh M. Patil", "Sunita R. Kulkarni", "Amit V. Deshmukh", "Pooja S. Joshi",
        "Vikram H. Shinde", "Anjali N. Pawar", "Suresh T. Gaikwad", "Meena K. Bhosale"
    ]

    for f in range(floor_count):
        for u in range(8):
            unit_num = (f + 1) * 100 + (u + 1)
            unit_id = f"unit_{unit_num}"
            record_id = f"ror_712_mh_pun_{unit_num}"
            owner_name = owners_sample[u % len(owners_sample)] if not (f == 3 and u == 1) else "Rajesh M. Patil"

            # 3D Bounding Box in local coordinate frame
            min_x = (u % 2) * 4.0 - 4.0
            max_x = min_x + 3.88
            min_z = (u // 2) * 2.5 - 5.0
            max_z = min_z + 2.38
            min_y = base_elevation + (f * floor_height) + 0.08
            max_y = min_y + 1.34

            units.append(CadastralUnit(
                id=unit_id,
                floor_id=f"floor_{f}",
                unit_number=str(unit_num),
                unit_type="RESIDENTIAL_FLAT",
                carpet_area_sqm=84.50,
                built_up_area_sqm=105.62,
                undivided_land_share_pct=1.5625,
                solid_volume_bbox=BoundingBox3D(
                    min_x=min_x, min_y=min_y, min_z=min_z,
                    max_x=max_x, max_y=max_y, max_z=max_z
                ),
                title_deed_record_id=record_id,
                status="MATCHED_VERIFIED"
            ))

            ror_records.append(RoRRecord(
                record_id=record_id,
                unit_number=str(unit_num),
                cts_number=f"CTS 142/B-{unit_num}",
                ulpin=f"MH-PUN-2026-0942-{unit_num}",
                owner_name=owner_name,
                ownership_type="FREEHOLD_STRATA",
                carpet_area_sqm=84.50,
                deed_registration_number=f"MH-PUN-HAV-2026-{unit_num:04d}",
                registration_date="2026-04-12",
                encumbrance_status="CLEAR"
            ))

    # 4. Geometry Store
    geometry = GeometryStore(
        lod2_model_uri="s3://naksha-storage/models/pune_001_lod2.glb",
        point_cloud_fused_uri="s3://naksha-storage/fused/master_fused.copc.laz",
        total_fused_points=89200000,
        gis_2d_layers={
            "parcel_boundary": {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [73.8567, 18.5204],
                        [73.8572, 18.5204],
                        [73.8572, 18.5209],
                        [73.8567, 18.5209],
                        [73.8567, 18.5204]
                    ]]
                },
                "properties": {"survey_no": "142/B", "ulpin": "MH-PUN-2026-0942"}
            }
        },
        solid_3d_units_count=64,
        mesh_topology_watertight=True
    )

    # 5. Coordinates
    coordinates = Coordinates(
        target_crs="EPSG:32643",
        target_crs_name="WGS 84 / UTM zone 43N",
        geodetic_datum="WGS 84",
        ellipsoid="WGS 84 (a=6378137.0m, 1/f=298.257223563)",
        vertical_datum="EGM2008 Geoid (MSL)",
        combined_scale_factor=0.9996024,
        bounding_box=BoundingBox3D(
            min_x=385415.0, min_y=2048145.0, min_z=540.0,
            max_x=385460.0, max_y=2048195.0, max_z=556.0
        ),
        gcp_count=18,
        horizontal_rmse_m=0.011,
        vertical_rmse_m=0.019
    )

    # 6. Survey Data
    survey_data = SurveyData(
        photogrammetry_images_count=1420,
        photogrammetry_gsd_cm=2.8,
        photogrammetry_overlap="82% Forward / 71% Sidelap",
        lidar_points_raw=52100000,
        lidar_outliers_filtered=142000,
        lidar_sensor_model="Riegl miniVUX-3UAV",
        gnss_survey_mode="RTK / Static Dual-Frequency GNSS",
        dem_resolution_m=0.50
    )

    # 7. Government Records
    government_records = GovernmentRecords(
        jurisdiction="Maharashtra Land Revenue Code 1966 & MahaRERA",
        total_records=64,
        matched_records=64,
        match_percentage=100.0,
        records=ror_records
    )

    # 8. Validation Report
    validation = ValidationReport(
        boundary_audit=True,
        boundary_delta_m=0.008,
        coordinates_audit=True,
        coordinates_crs="EPSG:32643",
        topology_audit=True,
        overlapping_volumes_count=0,
        record_audit=True,
        matched_records_ratio="64 / 64 (100%)",
        overall_certified=True,
        iso_19152_compliant=True
    )

    return CanonicalProject(
        id=project_id,
        code="Pune_Residential_001",
        title="Pune Residential 001",
        organization="Department of Land Records, Maharashtra",
        created_at="2026-09-29T10:00:00Z",
        accuracy_tier="TIER_1_CADASTRAL_LEGAL",
        parcel=parcel,
        building=building,
        units=units,
        geometry=geometry,
        coordinates=coordinates,
        survey_data=survey_data,
        government_records=government_records,
        validation=validation
    )
