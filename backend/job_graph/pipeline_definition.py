"""
Canonical definition of JOB 001 matching the Phase 12 Job Graph architecture.
"""

from .models import JobNode, JobGraph

def create_canonical_job_001(project_id: str = "project_pune_001", job_id: str = "JOB_001") -> JobGraph:
    """
    Constructs the directed acyclic graph for JOB 001.
    Includes branches for Photogrammetry, LiDAR, GNSS, GIS, DEM,
    followed by Point Cloud Fusion, Building Reconstruction, AI Segmentation,
    Floor & Unit Detection, Cadastre Boundary Creation, Gov Record Matching,
    Deep Validation, and Canonical Model publication.
    """
    graph = JobGraph(
        job_id=job_id,
        title="JOB 001: Integrated 3D Cadastre & Demarcation Pipeline",
        project_id=project_id
    )

    # 1. Root Gate: Validate Inputs
    graph.add_node(JobNode(
        id="validate_inputs",
        name="Validate Inputs",
        category="Preflight",
        level=1,
        dependencies=[],
        metrics={"checked_categories": 10, "manifest_valid": True}
    ))

    # 2. Photogrammetry Branch (5 sub-steps)
    graph.add_node(JobNode(
        id="photo_feature_extraction",
        name="Feature extraction",
        category="Photogrammetry",
        parent_category="Photogrammetry",
        level=2,
        dependencies=["validate_inputs"],
        metrics={"algorithm": "SIFT", "features_extracted": 1420000}
    ))

    graph.add_node(JobNode(
        id="photo_feature_matching",
        name="Feature matching",
        category="Photogrammetry",
        parent_category="Photogrammetry",
        level=2,
        dependencies=["photo_feature_extraction"],
        metrics={"matches_found": 845000, "inlier_ratio": 0.88}
    ))

    graph.add_node(JobNode(
        id="photo_camera_reconstruction",
        name="Camera reconstruction",
        category="Photogrammetry",
        parent_category="Photogrammetry",
        level=2,
        dependencies=["photo_feature_matching"],
        metrics={"calibrated_cameras": 1420, "reprojection_error_px": 0.42}
    ))

    graph.add_node(JobNode(
        id="photo_dense_reconstruction",
        name="Dense reconstruction",
        category="Photogrammetry",
        parent_category="Photogrammetry",
        level=2,
        dependencies=["photo_camera_reconstruction"],
        metrics={"depth_maps_fused": 1420, "density_pts_m2": 320}
    ))

    graph.add_node(JobNode(
        id="photo_point_cloud",
        name="Point cloud",
        category="Photogrammetry",
        parent_category="Photogrammetry",
        level=2,
        dependencies=["photo_dense_reconstruction"],
        output_artifacts={"copc": "s3://naksha-storage/pointclouds/photo_dense.copc.laz"},
        metrics={"total_points": 38400000}
    ))

    # 3. LiDAR Branch (5 sub-steps)
    graph.add_node(JobNode(
        id="lidar_read",
        name="Read",
        category="LiDAR",
        parent_category="LiDAR",
        level=2,
        dependencies=["validate_inputs"],
        metrics={"las_version": "1.4", "point_format": 6, "raw_points": 52100000}
    ))

    graph.add_node(JobNode(
        id="lidar_coordinate_transform",
        name="Coordinate transform",
        category="LiDAR",
        parent_category="LiDAR",
        level=2,
        dependencies=["lidar_read"],
        metrics={"source_crs": "EPSG:32643", "target_crs": "EPSG:32643"}
    ))

    graph.add_node(JobNode(
        id="lidar_noise_filtering",
        name="Noise filtering",
        category="LiDAR",
        parent_category="LiDAR",
        level=2,
        dependencies=["lidar_coordinate_transform"],
        metrics={"sor_neighbors": 16, "outliers_removed": 142000}
    ))

    graph.add_node(JobNode(
        id="lidar_classification",
        name="Classification",
        category="LiDAR",
        parent_category="LiDAR",
        level=2,
        dependencies=["lidar_noise_filtering"],
        metrics={"classes": ["Ground (2)", "Low Veg (3)", "High Veg (5)", "Building (6)"]}
    ))

    graph.add_node(JobNode(
        id="lidar_point_cloud",
        name="Point cloud",
        category="LiDAR",
        parent_category="LiDAR",
        level=2,
        dependencies=["lidar_classification"],
        output_artifacts={"copc": "s3://naksha-storage/pointclouds/lidar_clean.copc.laz"},
        metrics={"classified_points": 51958000}
    ))

    # 4. GNSS Branch
    graph.add_node(JobNode(
        id="gnss_coordinate_processing",
        name="Coordinate processing",
        category="GNSS",
        parent_category="GNSS",
        level=2,
        dependencies=["validate_inputs"],
        metrics={"gcps_triangulated": 18, "horizontal_rmse_m": 0.011, "vertical_rmse_m": 0.019}
    ))

    # 5. GIS Branch
    graph.add_node(JobNode(
        id="gis_parcel_processing",
        name="Parcel processing",
        category="GIS",
        parent_category="GIS",
        level=2,
        dependencies=["validate_inputs"],
        metrics={"parcels_loaded": 120, "sliver_polygons": 0, "ogc_valid": True}
    ))

    # 6. DEM Branch
    graph.add_node(JobNode(
        id="dem_elevation_processing",
        name="Elevation processing",
        category="DEM",
        parent_category="DEM",
        level=2,
        dependencies=["validate_inputs"],
        metrics={"resolution_m": 0.5, "hydro_enforced": True, "void_filled_pct": 100.0}
    ))

    # 7. Point Cloud Fusion (Barrier: Photogrammetry + LiDAR + GNSS)
    graph.add_node(JobNode(
        id="point_cloud_fusion",
        name="Point Cloud Fusion",
        category="Fusion",
        level=1,
        dependencies=["photo_point_cloud", "lidar_point_cloud", "gnss_coordinate_processing"],
        output_artifacts={"master_copc": "s3://naksha-storage/fused/master_fused.copc.laz"},
        metrics={"co_registration_residual_cm": 1.4, "total_fused_points": 89200000}
    ))

    # 8. Building Reconstruction (Fused Cloud + DEM)
    graph.add_node(JobNode(
        id="building_reconstruction",
        name="Building Reconstruction",
        category="3D Modeling",
        level=1,
        dependencies=["point_cloud_fusion", "dem_elevation_processing"],
        output_artifacts={"lod2_models": "s3://naksha-storage/models/lod2_buildings.glb"},
        metrics={"buildings_extracted": 42, "lod_level": "LoD-2.2", "watertight_meshes": 42}
    ))

    # 9. AI Segmentation
    graph.add_node(JobNode(
        id="ai_segmentation",
        name="AI Segmentation",
        category="AI / CV",
        level=1,
        dependencies=["building_reconstruction"],
        metrics={"model": "PointNet++ CadastreNet", "miou_accuracy": 0.942, "classes_detected": ["Roof", "Wall", "Facade", "Terrain"]}
    ))

    # 10. Floor Detection
    graph.add_node(JobNode(
        id="floor_detection",
        name="Floor Detection",
        category="Vertical Cadastre",
        level=1,
        dependencies=["ai_segmentation"],
        metrics={"total_floors_identified": 248, "avg_story_height_m": 3.05}
    ))

    # 11. Unit Detection
    graph.add_node(JobNode(
        id="unit_detection",
        name="Unit Detection",
        category="Vertical Cadastre",
        level=1,
        dependencies=["floor_detection"],
        metrics={"units_partitioned": 612, "volumetric_solids": 612}
    ))

    # 12. Property Boundary Creation (Units + GIS Parcels)
    graph.add_node(JobNode(
        id="property_boundary_creation",
        name="Property Boundary Creation",
        category="Legal Cadastre",
        level=1,
        dependencies=["unit_detection", "gis_parcel_processing"],
        metrics={"3d_boundaries_built": 612, "ground_parcels": 120, "strata_relations": 612}
    ))

    # 13. Government Record Matching
    graph.add_node(JobNode(
        id="government_record_matching",
        name="Government Record Matching",
        category="Legal Cadastre",
        level=1,
        dependencies=["property_boundary_creation"],
        metrics={"ror_7_12_matched": "120/120 (100%)", "mutation_entries_linked": 48}
    ))

    # 14. Validation
    graph.add_node(JobNode(
        id="validation",
        name="Validation",
        category="Audit",
        level=1,
        dependencies=["government_record_matching"],
        metrics={"topology_slivers": 0, "area_discrepancy_pct": 0.12, "compliance_iso19152": True}
    ))

    # 15. Canonical Model
    graph.add_node(JobNode(
        id="canonical_model",
        name="Canonical Model",
        category="Publication",
        level=1,
        dependencies=["validation"],
        output_artifacts={
            "3d_tiles": "s3://naksha-storage/tiles/3dtiles_v1_1/tileset.json",
            "orthophoto_cog": "s3://naksha-storage/raster/ortho.cog.tif",
            "cadastral_gpkg": "s3://naksha-storage/vectors/cadastre_ladm.gpkg"
        },
        metrics={"ladm_compliant": True, "published_layers": ["2D Parcels", "3D Strata Units", "Point Clouds", "Orthomosaic"]}
    ))

    return graph
