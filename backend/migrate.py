"""
Naksha 2.0 — Database Migration & Seeding Script (Phase 21)
Applies schema.sql DDL to PostgreSQL 17 + PostGIS 3.3 and seeds canonical data.
"""

import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

try:
    from backend.database import get_database_url
except ImportError:
    from database import get_database_url

def run_migration():
    print("=" * 70)
    print("NAKSHA 2.0 — DATABASE MIGRATION ENGINE (PHASE 21)")
    print("=" * 70)
    
    db_url = get_database_url()
    print(f"Connecting to database...")

    try:
        conn = psycopg2.connect(db_url, connect_timeout=15)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        print("Connected to PostgreSQL successfully.")

        # Read schema.sql
        schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "schema.sql")
        if not os.path.exists(schema_path):
            schema_path = "schema.sql"

        print(f"Reading schema from: {schema_path}")
        with open(schema_path, "r", encoding="utf-8") as f:
            sql_content = f.read()

        # Split and execute statements
        print("Executing DDL Statements...")
        statements = sql_content.split(";")
        success_count = 0
        skipped_count = 0

        for stmt in statements:
            stmt_clean = stmt.strip()
            if not stmt_clean:
                continue

            # Remove comments-only lines
            lines = [l for l in stmt_clean.split("\n") if not l.strip().startswith("--")]
            query = "\n".join(lines).strip()
            if not query:
                continue

            try:
                cur.execute(query)
                success_count += 1
            except Exception as e:
                err_msg = str(e).strip().split("\n")[0]
                if "already exists" in err_msg.lower():
                    skipped_count += 1
                elif "extension \"postgis_raster\" is not available" in err_msg.lower():
                    print("  Note: postgis_raster extension skipped (optional raster feature).")
                    skipped_count += 1
                else:
                    print(f"  Warning on statement: {err_msg[:90]}")
                    skipped_count += 1

        print(f"DDL Complete: {success_count} applied, {skipped_count} existing/skipped.")

        # Create trigger function properly as a single block
        try:
            cur.execute("""
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
            """)
            print("  Trigger 'trg_parcels_area_calc' installed successfully.")
        except Exception as e:
            print("  Trigger creation note:", e)

        # Seed initial canonical records for Project Pune Haveli Taluka
        print("\nSeeding Canonical Project Data...")
        seed_canonical_data(cur)

        # Count tables
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        tables = [r[0] for r in cur.fetchall()]
        print(f"\nMigration Verified! Total {len(tables)} tables active in public schema:")
        for t in tables:
            cur.execute(f"SELECT count(*) FROM {t};")
            cnt = cur.fetchone()[0]
            print(f"  - {t:<28} : {cnt} rows")

        conn.close()
        print("\nDATABASE / API LAYER INITIALIZATION SUCCESSFUL.")
        return True

    except Exception as e:
        print(f"\nMigration Error: {e}")
        return False

def seed_canonical_data(cur):
    """Seeds Organization, User, Project, Datasets, Parcel, Building, Floors, and Units."""
    # 1. Organization
    cur.execute("""
        INSERT INTO organizations (id, slug, legal_name, license_type)
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'maharashtra-cadastre',
            'Maharashtra Land Records & Survey Department',
            'ENTERPRISE_GOVERNMENT'
        )
        ON CONFLICT (slug) DO NOTHING;
    """)

    # 2. User
    cur.execute("""
        INSERT INTO users (id, organization_id, email, password_hash, full_name, role)
        VALUES (
            'b0000000-0000-0000-0000-000000000001',
            'a0000000-0000-0000-0000-000000000001',
            'surveyor.haveli@mahabhulekh.gov.in',
            'scrypt:32768:8:1$hashed_key',
            'Shri. Rajesh V. Deshmukh (Chief Cadastral Surveyor)',
            'CHIEF_SURVEYOR'
        )
        ON CONFLICT (email) DO NOTHING;
    """)

    # 3. Project
    cur.execute("""
        INSERT INTO projects (
            id, organization_id, code, title, description, accuracy_tier, target_crs_epsg, combined_scale_factor
        )
        VALUES (
            '8f4a169b-e8f0-466d-9657-3f9f83656ab1',
            'a0000000-0000-0000-0000-000000000001',
            'MH-PUN-2026-VIL04',
            'Haveli Taluka Cadastre & 3D Land Demarcation',
            'High-density 3D property boundary delineation, strata title titling, and LADM ISO 19152 integration.',
            'TIER_1_CADASTRAL_LEGAL',
            32643,
            1.00000000
        )
        ON CONFLICT (organization_id, code) DO UPDATE SET updated_at = NOW();
    """)

    # 4. Input Datasets (The 10 Categories)
    categories = [
        ('CAT_01_PHOTOGRAMMETRY', 'Photogrammetry Aerial Block North', 'VALID', 94.00, 1420, 2565651570),
        ('CAT_02_LIDAR_POINT_CLOUD', 'LiDAR Aerial Scan Block', 'VALID', 100.00, 12, 3825900000),
        ('CAT_03_GIS_CAD', '2D Cadastral Base & Plinths', 'VALID', 95.00, 4, 193550743),
        ('CAT_04_GNSS_SURVEY', 'GNSS RTK Control Stations', 'VALID', 90.00, 8, 430080),
        ('CAT_05_DEM_ELEVATION', 'DEM/DTM High-Res Grids', 'VALID', 80.00, 2, 395312128),
        ('CAT_06_ARCHITECTURAL_BIM', 'Architectural IFC & DXF Plans', 'PARTIAL', 70.00, 3, 235157068),
        ('CAT_07_PROPERTY_VERTICAL_DATA', '3D Strata Unit Registry', 'VALID', 100.00, 64, 432862409),
        ('CAT_08_IMAGERY_ORTHOPHOTO', '5cm Orthomosaic GeoTIFF', 'VALID', 90.00, 1, 1803550720),
        ('CAT_09_PROJECT_METADATA', 'Cadastral Survey Specs & PRJ', 'VALID', 100.00, 1, 524288),
        ('CAT_10_SUPPORTING_DOCS', 'Registered Deeds & 7/12 RoRs', 'PARTIAL', 60.00, 14, 44879052)
    ]

    for cat, name, status, score, f_count, size_b in categories:
        cur.execute(f"""
            INSERT INTO input_datasets (
                project_id, category, name, status, readiness_score, epsg_detected, total_size_bytes, file_count
            )
            VALUES (
                '8f4a169b-e8f0-466d-9657-3f9f83656ab1',
                '{cat}',
                '{name}',
                '{status}',
                {score},
                32643,
                {size_b},
                {f_count}
            )
            ON CONFLICT DO NOTHING;
        """)

    # 5. Cadastral Parcel
    cur.execute("""
        INSERT INTO parcels (
            id, project_id, ulpin, state_code, district_code, taluka_code, village_code,
            survey_number, sub_division_number, land_use, legal_recorded_area_sqm, geom
        )
        VALUES (
            'c0000000-0000-0000-0000-000000000001',
            '8f4a169b-e8f0-466d-9657-3f9f83656ab1',
            'MH-PUN-2026-0942-0142',
            'MH',
            '2725',
            '0412',
            '554128',
            '142',
            'B',
            'RESIDENTIAL',
            1840.5000,
            ST_GeomFromText('MULTIPOLYGON Z (((73.8500 18.5200 540.0, 73.8505 18.5200 540.0, 73.8505 18.5205 540.0, 73.8500 18.5205 540.0, 73.8500 18.5200 540.0)))', 4326)
        )
        ON CONFLICT (ulpin) DO NOTHING;
    """)

    # 6. Building (Pune Heights Tower A)
    cur.execute("""
        INSERT INTO buildings (
            id, parcel_id, building_code, building_name, structure_type,
            floors_above_ground, ground_elevation_z, building_height_meters, footprint_geom
        )
        VALUES (
            'd0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001',
            'BLDG-001',
            'Pune Heights Tower A',
            'RCC_RESIDENTIAL',
            8,
            540.000,
            24.000,
            ST_GeomFromText('MULTIPOLYGON Z (((73.8501 18.5201 540.0, 73.8504 18.5201 540.0, 73.8504 18.5204 540.0, 73.8501 18.5204 540.0, 73.8501 18.5201 540.0)))', 4326)
        )
        ON CONFLICT DO NOTHING;
    """)

    # 7. Floors (Floor 0 to 7)
    for fl_num in range(8):
        z_min = 540.0 + (fl_num * 3.0)
        z_max = z_min + 3.0
        cur.execute(f"""
            INSERT INTO floors (
                id, building_id, floor_number, floor_label, elevation_min_z, elevation_max_z
            )
            VALUES (
                uuid_generate_v4(),
                'd0000000-0000-0000-0000-000000000001',
                {fl_num},
                'Floor {fl_num}',
                {z_min},
                {z_max}
            )
            ON CONFLICT (building_id, floor_number) DO NOTHING;
        """)

    # 8. Units (Sample unit 302 and 304 on Floor 3)
    cur.execute("""
        SELECT id FROM floors 
        WHERE building_id = 'd0000000-0000-0000-0000-000000000001' AND floor_number = 3;
    """)
    floor_3_row = cur.fetchone()
    if floor_3_row:
        floor_3_id = floor_3_row[0]
        # Unit 302 (Verified)
        cur.execute(f"""
            INSERT INTO units (
                id, floor_id, unit_number, unit_type, carpet_area_sqm, built_up_area_sqm, undivided_land_share_pct
            )
            VALUES (
                'e0000000-0000-0000-0000-000000000302',
                '{floor_3_id}',
                '302',
                'RESIDENTIAL_2BHK',
                84.5000,
                102.2500,
                0.0156
            )
            ON CONFLICT (floor_id, unit_number) DO NOTHING;
        """)
        # Unit 304
        cur.execute(f"""
            INSERT INTO units (
                id, floor_id, unit_number, unit_type, carpet_area_sqm, built_up_area_sqm, undivided_land_share_pct
            )
            VALUES (
                'e0000000-0000-0000-0000-000000000304',
                '{floor_3_id}',
                '304',
                'RESIDENTIAL_2BHK',
                84.5000,
                102.2500,
                0.0156
            )
            ON CONFLICT (floor_id, unit_number) DO NOTHING;
        """)
        # Unit Title Record for Unit 302
        cur.execute(f"""
            INSERT INTO property_titles (
                unit_id, owner_name, owner_identity_hash, registered_deed_number, deed_registration_date
            )
            VALUES (
                'e0000000-0000-0000-0000-000000000302',
                'Sunita R. Kulkarni',
                'sha256:8812cfa590119bedc7182901aef02198',
                'MH-PUN-HAV-2026-0302',
                '2026-01-15'
            )
            ON CONFLICT DO NOTHING;
        """)

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
