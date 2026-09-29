"""
Exporters for the Naksha 2.0 Canonical Geospatial Data Model.
Phase 15: Exports canonical representations to ISO 19152 LADM JSON and OGC GeoJSON-FG.
"""

from typing import Dict, Any
from .models import CanonicalProject

def export_canonical_to_ladm_json(project: CanonicalProject) -> Dict[str, Any]:
    """
    Exports the canonical model according to ISO 19152:2012 Land Administration Domain Model.
    - LA_BAUnit (Basic Administrative Unit): Parcel + Units
    - LA_SpatialUnit: 2D Land Parcel + 3D Strata Legal Spaces
    - LA_RRR: Rights, Restrictions, and Responsibilities (Ownership titles)
    - LA_Party: Landowners & Legal titleholders
    """
    return {
        "$schema": "https://schemas.iso.org/iso/19152/ladm/v2/cadastre.json",
        "standard": "ISO 19152:2012 LADM",
        "project_code": project.code,
        "title": project.title,
        "crs": project.coordinates.target_crs,
        "LA_SpatialSource": {
            "photogrammetry_frames": project.survey_data.photogrammetry_images_count,
            "lidar_points": project.survey_data.lidar_points_raw,
            "gnss_gcp_count": project.coordinates.gcp_count,
            "survey_accuracy_tier": project.accuracy_tier
        },
        "LA_BAUnit": {
            "name": f"Parcel {project.parcel.survey_number}/{project.parcel.sub_division}",
            "ulpin": project.parcel.ulpin,
            "legal_area_sqm": project.parcel.legal_recorded_area_sqm,
            "gis_area_sqm": project.parcel.gis_computed_area_sqm,
            "land_use": project.parcel.land_use
        },
        "LA_LegalSpaceBuildingUnit": {
            "building_code": project.building.building_code,
            "name": project.building.name,
            "floors_count": len(project.building.floors),
            "units_count": len(project.units),
            "units": [
                {
                    "suID": u.id,
                    "unit_number": u.unit_number,
                    "floor_level": u.floor_id,
                    "carpet_area": u.carpet_area_sqm,
                    "undivided_share": u.undivided_land_share_pct,
                    "volume_bbox": u.solid_volume_bbox.dict()
                }
                for u in project.units
            ]
        },
        "LA_RRR": [
            {
                "rrrID": rec.record_id,
                "unit_number": rec.unit_number,
                "cts_number": rec.cts_number,
                "deed_number": rec.deed_registration_number,
                "party": rec.owner_name,
                "share": "1/1",
                "tenure": rec.ownership_type,
                "encumbrance": rec.encumbrance_status
            }
            for rec in project.government_records.records
        ],
        "LA_QualityAudit": {
            "boundary_verified": project.validation.boundary_audit,
            "coordinates_verified": project.validation.coordinates_audit,
            "topology_watertight": project.validation.topology_audit,
            "records_matched_pct": project.government_records.match_percentage,
            "certified_for_title_registration": project.validation.overall_certified
        }
    }

def export_canonical_to_geojson_fg(project: CanonicalProject) -> Dict[str, Any]:
    """
    Exports 2D/3D spatial geometry as OGC Features and Geometries JSON (JSON-FG).
    """
    features = [
        {
            "type": "Feature",
            "id": project.parcel.id,
            "featureType": "CadastralParcel",
            "geometry": {
                "type": "Polygon",
                "coordinates": [project.parcel.boundary_coordinates]
            },
            "properties": {
                "ulpin": project.parcel.ulpin,
                "survey_no": f"{project.parcel.survey_number}/{project.parcel.sub_division}",
                "recorded_area_sqm": project.parcel.legal_recorded_area_sqm,
                "gis_area_sqm": project.parcel.gis_computed_area_sqm,
                "land_use": project.parcel.land_use
            }
        },
        {
            "type": "Feature",
            "id": project.building.id,
            "featureType": "BuildingLoD2",
            "properties": {
                "building_code": project.building.building_code,
                "name": project.building.name,
                "height_m": project.building.height_meters,
                "floors": project.building.floors_above_ground,
                "total_units": len(project.units)
            }
        }
    ]

    return {
        "type": "FeatureCollection",
        "conformsTo": [
            "http://www.opengis.net/spec/json-fg-1/0.2/core",
            "http://www.opengis.net/spec/json-fg-1/0.2/3d"
        ],
        "coordRefSys": f"http://www.opengis.net/def/crs/EPSG/0/{project.coordinates.target_crs.split(':')[-1]}",
        "features": features
    }
