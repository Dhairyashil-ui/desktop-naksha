-- ============================================================================
-- NAKSHA 2.0 PHYSICAL DATABASE DDL SCHEMA
-- Target Database: PostgreSQL 16+ with PostGIS 3.4+
-- Generated for Phase 2: Core Database Architecture
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "postgis_raster";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ENUMS
CREATE TYPE user_role_enum AS ENUM (
    'SUPER_ADMIN',
    'SURVEY_DIRECTOR',
    'CHIEF_SURVEYOR',
    'GIS_ANALYST',
    'CADASTRAL_OFFICER',
    'QA_QC_ENGINEER',
    'FIELD_OPERATOR',
    'CLIENT_VIEWER'
);

CREATE TYPE accuracy_tier_enum AS ENUM (
    'TIER_1_CADASTRAL_LEGAL',    -- Horiz <= 2cm, Vert <= 3cm
    'TIER_2_ENGINEERING_GRADE',  -- Horiz <= 5cm, Vert <= 7cm
    'TIER_3_TOPOGRAPHIC_RECON'   -- Horiz <= 20cm, Vert <= 30cm
);

CREATE TYPE input_category_enum AS ENUM (
    'CAT_01_PHOTOGRAMMETRY',
    'CAT_02_LIDAR_POINT_CLOUD',
    'CAT_03_GIS_CAD',
    'CAT_04_GNSS_SURVEY',
    'CAT_05_DEM_ELEVATION',
    'CAT_06_ARCHITECTURAL_BIM',
    'CAT_07_PROPERTY_VERTICAL_DATA',
    'CAT_08_IMAGERY_ORTHOPHOTO',
    'CAT_09_PROJECT_METADATA',
    'CAT_10_SUPPORTING_DOCS'
);

CREATE TYPE dataset_status_enum AS ENUM (
    'MISSING',       -- No data uploaded
    'SCANNING',      -- Scanning...
    'INVALID',       -- REJECTED
    'PARTIAL',       -- PARTIALLY READY
    'VALID',         -- READY
    'PROCESSING',    -- PROCESSING
    'COMPLETED'      -- COMPLETE
);

CREATE TYPE job_status_enum AS ENUM (
    'QUEUED',
    'DISPATCHED',
    'RUNNING',
    'SUCCESS',
    'WARNING',
    'FAILED',
    'CANCELLED'
);

CREATE TYPE point_role_enum AS ENUM (
    'GCP_CONTROL',
    'CHECK_POINT',
    'BENCHMARK',
    'TRAVERSE_STATION',
    'BOUNDARY_MONUMENT'
);

CREATE TYPE land_use_enum AS ENUM (
    'AGRICULTURAL',
    'RESIDENTIAL',
    'COMMERCIAL',
    'INDUSTRIAL',
    'FOREST_CONSERVATION',
    'GOVERNMENT_PUBLIC',
    'WATER_BODY',
    'INFRASTRUCTURE_RIGHT_OF_WAY'
);

-- ORGANIZATIONS & USERS
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    license_type VARCHAR(64) NOT NULL DEFAULT 'ENTERPRISE',
    storage_quota_bytes BIGINT NOT NULL DEFAULT 5497558138880,
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'FIELD_OPERATOR',
    license_number VARCHAR(128),
    digital_certificate_fingerprint VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PROJECTS & SURVEYS
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    survey_date DATE,
    status VARCHAR(64) NOT NULL DEFAULT 'ACTIVE',
    accuracy_tier accuracy_tier_enum NOT NULL DEFAULT 'TIER_1_CADASTRAL_LEGAL',
    target_crs_epsg INT NOT NULL DEFAULT 4326,
    custom_crs_wkt TEXT,
    combined_scale_factor NUMERIC(10, 8) DEFAULT 1.00000000,
    aoi_boundary GEOMETRY(Polygon, 4326),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_project_code UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_projects_aoi ON projects USING GIST (aoi_boundary);

CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    survey_code VARCHAR(64) NOT NULL,
    survey_type VARCHAR(64) NOT NULL,
    lead_surveyor_id UUID REFERENCES users(id),
    weather_conditions JSONB,
    instruments_manifest JSONB,
    surveyed_from TIMESTAMPTZ NOT NULL,
    surveyed_to TIMESTAMPTZ,
    signoff_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DATASETS & FILES
CREATE TABLE IF NOT EXISTS input_datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    survey_id UUID REFERENCES surveys(id) ON DELETE SET NULL,
    category input_category_enum NOT NULL,
    name VARCHAR(255) NOT NULL,
    status dataset_status_enum NOT NULL DEFAULT 'MISSING',
    readiness_score NUMERIC(5, 2) DEFAULT 0.00,
    epsg_detected INT,
    crs_wkt TEXT,
    spatial_extent GEOMETRY(PolygonZ, 4326),
    temporal_start TIMESTAMPTZ,
    temporal_end TIMESTAMPTZ,
    total_size_bytes BIGINT NOT NULL DEFAULT 0,
    file_count INT NOT NULL DEFAULT 0,
    completeness NUMERIC(5, 2) DEFAULT 0.00,
    quality NUMERIC(5, 2) DEFAULT 0.00,
    validation_status VARCHAR(64) DEFAULT 'PENDING',
    bundle_sha256 CHAR(64),
    metadata_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_input_datasets_spatial ON input_datasets USING GIST (spatial_extent);
CREATE INDEX IF NOT EXISTS idx_input_datasets_category ON input_datasets(category);
CREATE INDEX IF NOT EXISTS idx_input_datasets_status ON input_datasets(status);

CREATE TABLE IF NOT EXISTS dataset_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES input_datasets(id) ON DELETE CASCADE,
    relative_path VARCHAR(512) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    extension VARCHAR(32) NOT NULL,
    file_role VARCHAR(64) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    s3_bucket VARCHAR(128) NOT NULL,
    s3_key VARCHAR(1024) NOT NULL,
    is_corrupt BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dataset_files_dataset_id ON dataset_files(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_files_s3_key ON dataset_files(s3_key);

-- VALIDATION RESULTS
CREATE TABLE IF NOT EXISTS validation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES input_datasets(id) ON DELETE CASCADE,
    accuracy_tier_evaluated accuracy_tier_enum NOT NULL,
    verdict dataset_status_enum NOT NULL,
    readiness_score NUMERIC(5, 2) NOT NULL,
    required_passed BOOLEAN NOT NULL DEFAULT FALSE,
    required_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
    quality_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    remediation_cards JSONB NOT NULL DEFAULT '[]'::jsonb,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_results_dataset_id ON validation_results(dataset_id);

-- PROCESSING JOBS & ARTIFACTS
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pipeline_type VARCHAR(64) NOT NULL,
    status job_status_enum NOT NULL DEFAULT 'QUEUED',
    priority INT NOT NULL DEFAULT 5,
    progress_percentage NUMERIC(5, 2) DEFAULT 0.00,
    worker_node_id VARCHAR(128),
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    log_trace TEXT,
    error_summary TEXT,
    dispatched_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_input_bindings (
    job_id UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES input_datasets(id) ON DELETE RESTRICT,
    PRIMARY KEY (job_id, dataset_id)
);

CREATE TABLE IF NOT EXISTS processed_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    artifact_type VARCHAR(64) NOT NULL,
    s3_bucket VARCHAR(128) NOT NULL,
    s3_key VARCHAR(1024) NOT NULL,
    spatial_bounds GEOMETRY(PolygonZ, 4326),
    resolution_gsd_meters NUMERIC(8, 4),
    size_bytes BIGINT NOT NULL,
    stream_endpoint_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_artifacts_bounds ON processed_artifacts USING GIST (spatial_bounds);

-- GEODETIC CONTROL POINTS
CREATE TABLE IF NOT EXISTS ground_control_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    survey_id UUID REFERENCES surveys(id) ON DELETE SET NULL,
    point_identifier VARCHAR(64) NOT NULL,
    role point_role_enum NOT NULL DEFAULT 'GCP_CONTROL',
    geom GEOMETRY(PointZ, 4326) NOT NULL,
    projected_x NUMERIC(14, 4) NOT NULL,
    projected_y NUMERIC(14, 4) NOT NULL,
    projected_z NUMERIC(10, 4) NOT NULL,
    sigma_x NUMERIC(8, 4),
    sigma_y NUMERIC(8, 4),
    sigma_z NUMERIC(8, 4),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    field_photo_s3_key VARCHAR(1024),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_proj_point_id UNIQUE (project_id, point_identifier)
);

CREATE INDEX IF NOT EXISTS idx_gcps_geom ON ground_control_points USING GIST (geom);

-- CADASTRAL PARCELS & 3D HIERARCHY
CREATE TABLE IF NOT EXISTS parcels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    ulpin VARCHAR(32) UNIQUE,
    state_code VARCHAR(4) NOT NULL,
    district_code VARCHAR(8) NOT NULL,
    taluka_code VARCHAR(8) NOT NULL,
    village_code VARCHAR(16) NOT NULL,
    survey_number VARCHAR(64) NOT NULL,
    sub_division_number VARCHAR(32),
    land_use land_use_enum NOT NULL DEFAULT 'AGRICULTURAL',
    legal_recorded_area_sqm NUMERIC(14, 4) NOT NULL,
    gis_computed_area_sqm NUMERIC(14, 4),
    area_delta_percentage NUMERIC(6, 3),
    geom GEOMETRY(MultiPolygonZ, 4326) NOT NULL,
    valid_during TSTZRANGE NOT NULL DEFAULT TSTZRANGE(NOW(), NULL, '[)'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcels_geom ON parcels USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_parcels_ulpin ON parcels (ulpin);
CREATE INDEX IF NOT EXISTS idx_parcels_temporal ON parcels USING GIST (valid_during);

CREATE TABLE IF NOT EXISTS buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    building_code VARCHAR(64) NOT NULL,
    building_name VARCHAR(255),
    structure_type VARCHAR(64) NOT NULL DEFAULT 'RCC_RESIDENTIAL',
    floors_above_ground INT NOT NULL DEFAULT 1,
    floors_below_ground INT NOT NULL DEFAULT 0,
    ground_elevation_z NUMERIC(10, 3) NOT NULL,
    building_height_meters NUMERIC(8, 3) NOT NULL,
    bim_ifc_guid VARCHAR(64),
    footprint_geom GEOMETRY(MultiPolygonZ, 4326) NOT NULL,
    mesh_volume_geom GEOMETRY(PolyhedralSurfaceZ, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buildings_footprint ON buildings USING GIST (footprint_geom);

CREATE TABLE IF NOT EXISTS floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_number INT NOT NULL,
    floor_label VARCHAR(32) NOT NULL,
    elevation_min_z NUMERIC(10, 3) NOT NULL,
    elevation_max_z NUMERIC(10, 3) NOT NULL,
    footprint_geom GEOMETRY(MultiPolygonZ, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bldg_floor UNIQUE (building_id, floor_number)
);

CREATE INDEX IF NOT EXISTS idx_floors_geom ON floors USING GIST (footprint_geom);

CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    unit_number VARCHAR(64) NOT NULL,
    unit_type VARCHAR(64) NOT NULL DEFAULT 'RESIDENTIAL_FLAT',
    carpet_area_sqm NUMERIC(10, 4) NOT NULL,
    built_up_area_sqm NUMERIC(10, 4) NOT NULL,
    undivided_land_share_pct NUMERIC(6, 4),
    solid_volume_geom GEOMETRY(PolyhedralSurfaceZ, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_floor_unit UNIQUE (floor_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_units_solid ON units USING GIST (solid_volume_geom);

CREATE TABLE IF NOT EXISTS property_titles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    owner_name VARCHAR(255) NOT NULL,
    owner_identity_hash VARCHAR(128) NOT NULL,
    ownership_share_fraction NUMERIC(6, 5) NOT NULL DEFAULT 1.00000,
    tenure_type VARCHAR(64) NOT NULL DEFAULT 'FREEHOLD',
    registered_deed_number VARCHAR(128),
    deed_registration_date DATE,
    encumbrance_status VARCHAR(64) NOT NULL DEFAULT 'CLEAR',
    deed_document_s3_key VARCHAR(1024),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_title_target CHECK (
        (parcel_id IS NOT NULL AND unit_id IS NULL) OR
        (parcel_id IS NULL AND unit_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_property_titles_parcel ON property_titles(parcel_id);
CREATE INDEX IF NOT EXISTS idx_property_titles_unit ON property_titles(unit_id);

CREATE TABLE IF NOT EXISTS project_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_snapshot_id UUID REFERENCES project_snapshots(id),
    revision_number INT NOT NULL,
    commit_message TEXT NOT NULL,
    author_id UUID REFERENCES users(id),
    state_tree_hash CHAR(64) NOT NULL,
    parcels_snapshot_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parcel_mutations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    mutation_type VARCHAR(64) NOT NULL,
    sanction_order_number VARCHAR(128) NOT NULL,
    sanction_date DATE NOT NULL,
    parent_parcel_ids UUID[] NOT NULL,
    derived_parcel_ids UUID[] NOT NULL,
    approving_officer_id UUID REFERENCES users(id),
    mutation_deed_s3_key VARCHAR(1024),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TRIGGER FOR REAL-TIME GIS AREA RECONCILIATION
CREATE OR REPLACE FUNCTION trg_calculate_parcel_gis_area()
RETURNS TRIGGER AS $$
BEGIN
    NEW.gis_computed_area_sqm := ST_Area(NEW.geom::geography);
    IF NEW.legal_recorded_area_sqm > 0 THEN
        NEW.area_delta_percentage := ROUND(
            (ABS(NEW.gis_computed_area_sqm - NEW.legal_recorded_area_sqm) / NEW.legal_recorded_area_sqm * 100.0),
            3
        );
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parcels_area_calc ON parcels;
CREATE TRIGGER trg_parcels_area_calc
BEFORE INSERT OR UPDATE ON parcels
FOR EACH ROW
EXECUTE FUNCTION trg_calculate_parcel_gis_area();

-- ============================================================================
-- PHASE 23 — OPERATION LOG TABLE
-- Every operation produces a structured, timestamped log entry.
-- ============================================================================

CREATE TYPE log_level_enum AS ENUM (
    'INFO',
    'SUCCESS',
    'WARNING',
    'ERROR',
    'DEBUG'
);

CREATE TABLE IF NOT EXISTS operation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    category VARCHAR(64) NOT NULL,          -- PROJECT, LIDAR, PHOTOGRAMMETRY, FUSION, BUILDING, RECORD, VALIDATION, PACKAGE, SYSTEM
    level log_level_enum NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,                  -- e.g. "LiDAR validation started"
    detail TEXT,                            -- e.g. "CRS: EPSG:32643"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oplogs_project    ON operation_logs(project_id);
CREATE INDEX idx_oplogs_category   ON operation_logs(category);
CREATE INDEX idx_oplogs_level      ON operation_logs(level);
CREATE INDEX idx_oplogs_created_at ON operation_logs(created_at DESC);

COMMENT ON TABLE operation_logs IS
  'Phase 23: Structured operational audit log. Every pipeline action, file upload, CRS detection, validation result and package generation is recorded here. Never silently discarded.';
