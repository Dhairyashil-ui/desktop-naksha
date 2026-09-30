import sys
sys.path.insert(0, ".")
from pathlib import Path
import tempfile
from scratch.verify_step25_step26 import create_surveyed_building_cloud
from backend.apartment_geometry import apartment_engine

tmp = Path(tempfile.mkdtemp(prefix="naksha_apt_test_"))
cloud = tmp / "survey_bldg.las"
create_surveyed_building_cloud(cloud)

manifest = apartment_engine.build_apartments_from_survey(cloud)
print("Total floors:", manifest["total_floors"])
print("Total units:", manifest["total_units"])

for fl in manifest["floors"]:
    print(f"\nFloor {fl['floor_number']} ({fl['floor_label']}): Slab Z = {fl['slab_elevation_m']:.3f}m .. {fl['ceiling_elevation_m']:.3f}m, Height = {fl['clear_height_m']:.3f}m")
    for u in fl["units"]:
        print(f"   - {u['unit_alias']:<7} ({u['unit_id']}): Area={u['area']:>6.2f}m2, Vol={u['volume']:>7.2f}m3, Centroid={u['centroid_xyz']}, Watertight={u['geometry_3d']['is_watertight']}")
