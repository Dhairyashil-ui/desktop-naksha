/**
 * Canonical Geospatial Data Model - TypeScript Definitions
 * Phase 15: The Heart of Naksha 2.0 - Unified Internal Representation
 */

export interface BoundingBox3D {
  min_x: number;
  min_y: number;
  min_z: number;
  max_x: number;
  max_y: number;
  max_z: number;
}

export interface CadastralUnit {
  id: string;
  floor_id: string;
  unit_number: string;
  unit_type: string;
  carpet_area_sqm: number;
  built_up_area_sqm: number;
  undivided_land_share_pct: number;
  solid_volume_bbox: BoundingBox3D;
  title_deed_record_id?: string;
  status: string;
}

export interface Floor {
  id: string;
  building_id: string;
  floor_number: number;
  floor_label: string;
  elevation_min_z: number;
  elevation_max_z: number;
  height_meters: number;
  slab_thickness_meters: number;
  units_count: number;
  unit_ids: string[];
}

export interface Building {
  id: string;
  parcel_id: string;
  building_code: string;
  name: string;
  structure_type: string;
  floors_above_ground: number;
  floors_below_ground: number;
  ground_elevation_z: number;
  height_meters: number;
  footprint_area_sqm: number;
  gross_built_up_area_sqm: number;
  floors: Floor[];
}

export interface Parcel {
  id: string;
  ulpin: string;
  state_code: string;
  district: string;
  taluka: string;
  village: string;
  survey_number: string;
  sub_division: string;
  land_use: string;
  legal_recorded_area_sqm: number;
  gis_computed_area_sqm: number;
  area_delta_percentage: number;
  perimeter_meters: number;
  boundary_coordinates: number[][];
}

export interface GeometryStore {
  lod2_model_uri: string;
  point_cloud_fused_uri: string;
  total_fused_points: number;
  gis_2d_layers: Record<string, unknown>;
  solid_3d_units_count: number;
  mesh_topology_watertight: boolean;
}

export interface Coordinates {
  target_crs: string;
  target_crs_name: string;
  geodetic_datum: string;
  ellipsoid: string;
  vertical_datum: string;
  combined_scale_factor: number;
  bounding_box: BoundingBox3D;
  gcp_count: number;
  horizontal_rmse_m: number;
  vertical_rmse_m: number;
}

export interface SurveyData {
  photogrammetry_images_count: number;
  photogrammetry_gsd_cm: number;
  photogrammetry_overlap: string;
  lidar_points_raw: number;
  lidar_outliers_filtered: number;
  lidar_sensor_model: string;
  gnss_survey_mode: string;
  dem_resolution_m: number;
}

export interface RoRRecord {
  record_id: string;
  unit_number: string;
  cts_number: string;
  ulpin: string;
  owner_name: string;
  ownership_type: string;
  carpet_area_sqm: number;
  deed_registration_number: string;
  registration_date: string;
  encumbrance_status: string;
}

export interface GovernmentRecords {
  jurisdiction: string;
  total_records: number;
  matched_records: number;
  match_percentage: number;
  records: RoRRecord[];
}

export interface ValidationReport {
  boundary_audit: boolean;
  boundary_delta_m: number;
  coordinates_audit: boolean;
  coordinates_crs: string;
  topology_audit: boolean;
  overlapping_volumes_count: number;
  record_audit: boolean;
  matched_records_ratio: string;
  overall_certified: boolean;
  iso_19152_compliant: boolean;
}

export interface CanonicalProject {
  id: string;
  code: string;
  title: string;
  organization: string;
  created_at: string;
  accuracy_tier: string;
  parcel: Parcel;
  building: Building;
  units: CadastralUnit[];
  geometry: GeometryStore;
  coordinates: Coordinates;
  survey_data: SurveyData;
  government_records: GovernmentRecords;
  validation: ValidationReport;
}

export interface CanonicalTreeNode {
  id: string;
  name: string;
  type: 
    | 'PROJECT' 
    | 'PARCEL' 
    | 'BUILDING' 
    | 'FLOOR' 
    | 'UNITS_BRANCH'
    | 'UNIT' 
    | 'UNIT_SUMMARY'
    | 'GEOMETRY' 
    | 'COORDINATES' 
    | 'SURVEY_DATA' 
    | 'GOVERNMENT_RECORDS' 
    | 'VALIDATION';
  details?: string;
  metric?: string;
  children?: CanonicalTreeNode[];
}

/**
 * Benchmark Seed Data for Pune Residential 001
 */
export const CANONICAL_PUNE_001: CanonicalProject = {
  id: 'project_pune_res_001',
  code: 'Pune_Residential_001',
  title: 'Pune Residential 001',
  organization: 'Department of Land Records, Maharashtra',
  created_at: '2026-09-29T10:00:00Z',
  accuracy_tier: 'TIER_1_CADASTRAL_LEGAL',
  parcel: {
    id: 'parcel_haveli_142b',
    ulpin: 'MH-PUN-2026-0942',
    state_code: '27',
    district: 'Pune',
    taluka: 'Haveli',
    village: 'Haveli',
    survey_number: '142',
    sub_division: 'B',
    land_use: 'RESIDENTIAL',
    legal_recorded_area_sqm: 1250.00,
    gis_computed_area_sqm: 1249.85,
    area_delta_percentage: 0.012,
    perimeter_meters: 144.20,
    boundary_coordinates: [
      [385420.0, 2048150.0],
      [385455.0, 2048152.0],
      [385452.0, 2048190.0],
      [385418.0, 2048188.0],
      [385420.0, 2048150.0]
    ]
  },
  building: {
    id: 'bldg_shivaji_heights_a',
    parcel_id: 'parcel_haveli_142b',
    building_code: 'BLDG-A',
    name: 'Shivaji Heights Wing A',
    structure_type: 'RCC_RESIDENTIAL',
    floors_above_ground: 8,
    floors_below_ground: 1,
    ground_elevation_z: 542.15,
    height_meters: 12.0,
    footprint_area_sqm: 320.0,
    gross_built_up_area_sqm: 2560.0,
    floors: Array.from({ length: 8 }, (_, f) => ({
      id: `floor_${f}`,
      building_id: 'bldg_shivaji_heights_a',
      floor_number: f,
      floor_label: f === 0 ? 'Ground Floor (Floor 0)' : `Floor ${f}`,
      elevation_min_z: 542.15 + f * 1.5,
      elevation_max_z: 542.15 + (f + 1) * 1.5,
      height_meters: 1.5,
      slab_thickness_meters: 0.18,
      units_count: 8,
      unit_ids: Array.from({ length: 8 }, (_, u) => `unit_${(f + 1) * 100 + u + 1}`)
    }))
  },
  units: Array.from({ length: 64 }, (_, i) => {
    const f = Math.floor(i / 8);
    const u = i % 8;
    const unitNum = (f + 1) * 100 + (u + 1);
    return {
      id: `unit_${unitNum}`,
      floor_id: `floor_${f}`,
      unit_number: `${unitNum}`,
      unit_type: 'RESIDENTIAL_FLAT',
      carpet_area_sqm: 84.50,
      built_up_area_sqm: 105.62,
      undivided_land_share_pct: 1.5625,
      solid_volume_bbox: {
        min_x: (u % 2) * 4.0 - 4.0,
        min_y: 542.15 + f * 1.5 + 0.08,
        min_z: Math.floor(u / 2) * 2.5 - 5.0,
        max_x: (u % 2) * 4.0 - 0.12,
        max_y: 542.15 + f * 1.5 + 1.42,
        max_z: Math.floor(u / 2) * 2.5 - 2.62
      },
      title_deed_record_id: `ror_712_mh_pun_${unitNum}`,
      status: 'MATCHED_VERIFIED'
    };
  }),
  geometry: {
    lod2_model_uri: 's3://naksha-storage/models/pune_001_lod2.glb',
    point_cloud_fused_uri: 's3://naksha-storage/fused/master_fused.copc.laz',
    total_fused_points: 89200000,
    gis_2d_layers: {
      parcel_boundary: {
        type: 'Polygon',
        coordinates: [
          [385420.0, 2048150.0],
          [385455.0, 2048152.0],
          [385452.0, 2048190.0],
          [385418.0, 2048188.0],
          [385420.0, 2048150.0]
        ]
      }
    },
    solid_3d_units_count: 64,
    mesh_topology_watertight: true
  },
  coordinates: {
    target_crs: 'EPSG:32643',
    target_crs_name: 'WGS 84 / UTM zone 43N',
    geodetic_datum: 'WGS 84',
    ellipsoid: 'WGS 84 (a=6378137.0m, 1/f=298.257223563)',
    vertical_datum: 'EGM2008 Geoid (MSL)',
    combined_scale_factor: 0.9996024,
    bounding_box: {
      min_x: 385415.0,
      min_y: 2048145.0,
      min_z: 540.0,
      max_x: 385460.0,
      max_y: 2048195.0,
      max_z: 556.0
    },
    gcp_count: 18,
    horizontal_rmse_m: 0.011,
    vertical_rmse_m: 0.019
  },
  survey_data: {
    photogrammetry_images_count: 1420,
    photogrammetry_gsd_cm: 2.8,
    photogrammetry_overlap: '82% Forward / 71% Sidelap',
    lidar_points_raw: 52100000,
    lidar_outliers_filtered: 142000,
    lidar_sensor_model: 'Riegl miniVUX-3UAV',
    gnss_survey_mode: 'RTK / Static Dual-Frequency GNSS',
    dem_resolution_m: 0.50
  },
  government_records: {
    jurisdiction: 'Maharashtra Land Revenue Code 1966 & MahaRERA',
    total_records: 64,
    matched_records: 64,
    match_percentage: 100.0,
    records: Array.from({ length: 64 }, (_, i) => {
      const unitNum = (Math.floor(i / 8) + 1) * 100 + (i % 8 + 1);
      return {
        record_id: `ror_712_mh_pun_${unitNum}`,
        unit_number: `${unitNum}`,
        cts_number: `CTS 142/B-${unitNum}`,
        ulpin: `MH-PUN-2026-0942-${unitNum}`,
        owner_name: unitNum === 402 ? 'Rajesh M. Patil' : `Owner-${unitNum}`,
        ownership_type: 'FREEHOLD_STRATA',
        carpet_area_sqm: 84.50,
        deed_registration_number: `MH-PUN-HAV-2026-${String(unitNum).padStart(4, '0')}`,
        registration_date: '2026-04-12',
        encumbrance_status: 'CLEAR'
      };
    })
  },
  validation: {
    boundary_audit: true,
    boundary_delta_m: 0.008,
    coordinates_audit: true,
    coordinates_crs: 'EPSG:32643',
    topology_audit: true,
    overlapping_volumes_count: 0,
    record_audit: true,
    matched_records_ratio: '64 / 64 (100%)',
    overall_certified: true,
    iso_19152_compliant: true
  }
};

/**
 * Returns the Canonical Tree structure for UI rendering
 */
export function getCanonicalTree(): CanonicalTreeNode {
  const p = CANONICAL_PUNE_001;

  return {
    id: p.id,
    name: `PROJECT: ${p.title} (${p.code})`,
    type: 'PROJECT',
    details: `Accuracy: ${p.accuracy_tier} • Org: ${p.organization}`,
    metric: '100% Ready',
    children: [
      {
        id: p.parcel.id,
        name: `Parcel: Survey No. ${p.parcel.survey_number}/${p.parcel.sub_division} (ULPIN: ${p.parcel.ulpin})`,
        type: 'PARCEL',
        details: `Legal Area: ${p.parcel.legal_recorded_area_sqm} m² • GIS Area: ${p.parcel.gis_computed_area_sqm} m² (Delta ${p.parcel.area_delta_percentage}%)`,
        metric: `${p.parcel.legal_recorded_area_sqm} m²`
      },
      {
        id: p.building.id,
        name: `Building: ${p.building.name} (${p.building.building_code})`,
        type: 'BUILDING',
        details: `Height: ${p.building.height_meters}m • Footprint: ${p.building.footprint_area_sqm} m² • ${p.building.floors_above_ground} Floors Above Ground`,
        metric: `${p.building.floors_above_ground} Floors`,
        children: p.building.floors.map(fl => ({
          id: fl.id,
          name: `${fl.floor_label} (Elev ${fl.elevation_min_z.toFixed(2)}m - ${fl.elevation_max_z.toFixed(2)}m)`,
          type: 'FLOOR' as const,
          details: `${fl.units_count} Units • Height ${fl.height_meters}m • Slab: ${fl.slab_thickness_meters}m`,
          metric: `Z=${fl.elevation_min_z.toFixed(1)}m`
        }))
      },
      {
        id: 'branch_units',
        name: `Units (${p.units.length} Strata Property Units)`,
        type: 'UNITS_BRANCH',
        details: '64 Distinct 3D Cadastral Volumetric Units • 100% Title Matched',
        metric: `${p.units.length} Units`,
        children: [
          ...p.units.slice(0, 8).map((u): CanonicalTreeNode => ({
            id: u.id,
            name: `Unit ${u.unit_number}`,
            type: 'UNIT',
            details: `Carpet: ${u.carpet_area_sqm} m² • UDS: ${u.undivided_land_share_pct.toFixed(2)}%`,
            metric: u.status
          })),
          {
            id: 'units_more',
            name: `... and ${p.units.length - 8} more strata units across ${p.building.floors.length} floors`,
            type: 'UNIT_SUMMARY',
            details: `Total: ${p.units.length} units with individual legal titles`,
            metric: '64 Units Total'
          }
        ]
      },
      {
        id: 'branch_geometry',
        name: 'Geometry (LoD-2.2 Solid Mesh & 2D GIS Layers)',
        type: 'GEOMETRY',
        details: `LoD-2 Model GLB • ${p.geometry.total_fused_points.toLocaleString()} Fused Points • ${p.geometry.solid_3d_units_count} 3D Solid Volumes`,
        metric: 'Watertight Mesh'
      },
      {
        id: 'branch_coordinates',
        name: `Coordinates (${p.coordinates.target_crs} - ${p.coordinates.target_crs_name})`,
        type: 'COORDINATES',
        details: `Datum: ${p.coordinates.geodetic_datum} • Combined Scale Factor: ${p.coordinates.combined_scale_factor} • ${p.coordinates.gcp_count} GCPs`,
        metric: '±0.011m Horiz'
      },
      {
        id: 'branch_survey_data',
        name: 'Survey Data (Multi-Sensor Ingestion)',
        type: 'SURVEY_DATA',
        details: `Photogrammetry: ${p.survey_data.photogrammetry_images_count} Frames • LiDAR: ${p.survey_data.lidar_points_raw.toLocaleString()} Pts • DEM: ${p.survey_data.dem_resolution_m}m`,
        metric: '3 Datasets'
      },
      {
        id: 'branch_government_records',
        name: `Government Records (${p.government_records.jurisdiction})`,
        type: 'GOVERNMENT_RECORDS',
        details: `${p.government_records.matched_records}/${p.government_records.total_records} 7/12 RoR Titles Matched (100% Reconciliation)`,
        metric: '64 Titles Verified'
      },
      {
        id: 'branch_validation',
        name: 'Validation (Four-Pillar Legal Demarcation Audits)',
        type: 'VALIDATION',
        details: '✓ Boundary (±0.008m) • ✓ Coordinates (EPSG:32643) • ✓ Topology (0 Gaps) • ✓ Record (100% Match)',
        metric: '✓ 4/4 Passed'
      }
    ]
  };
}
