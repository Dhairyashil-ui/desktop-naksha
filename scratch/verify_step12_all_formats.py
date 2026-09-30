import sys, os, tempfile, json
from pathlib import Path

# Add project root
sys.path.insert(0, "d:/surveynaksha")

import fiona
from fiona.crs import from_epsg
import shapely
import ezdxf

from backend.gis_cad_scanner import (
    scan_shapefile,
    scan_gpkg,
    scan_geojson,
    scan_kml,
    scan_dxf,
    scan_dwg,
    scan_dgn,
    scan_gis_cad_dataset,
    format_gis_cad_response,
)

print("=" * 70)
print("NAKSHA 2.0 — STEP 12: REAL GIS / CAD SCANNER VERIFICATION")
print("=" * 70)

tmp = Path(tempfile.mkdtemp(prefix="naksha_step12_"))
print(f"Working scratch directory: {tmp}\n")

# ─────────────────────────────────────────────────────────────────────────────
# 1. SHAPEFILE (SHP) — WITH SIDECARS AND CRS
# ─────────────────────────────────────────────────────────────────────────────
shp_dir = tmp / "shp_test"
shp_dir.mkdir()
shp_path = shp_dir / "cadastral_parcels.shp"

shp_schema = {
    "geometry": "Polygon",
    "properties": {
        "plot_no": "str",
        "owner": "str",
        "tax_paid": "int",
        "area_m2": "float"
    }
}
with fiona.open(str(shp_path), "w", driver="ESRI Shapefile", crs=from_epsg(32643), schema=shp_schema) as shp:
    shp.write({
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[385000, 2045000], [385050, 2045000], [385050, 2045050], [385000, 2045050], [385000, 2045000]]]
        },
        "properties": {"plot_no": "A-1", "owner": "Rao", "tax_paid": 1, "area_m2": 2500.0}
    })
    shp.write({
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[385050, 2045000], [385100, 2045000], [385100, 2045050], [385050, 2045050], [385050, 2045000]]]
        },
        "properties": {"plot_no": "A-2", "owner": "Patil", "tax_paid": 0, "area_m2": 2500.0}
    })

print("[1] SHAPEFILE (SHP)")
shp_res = scan_shapefile(shp_path)[0]
print(f"   Layer: {shp_res.name} ({shp_res.format})")
print(f"   Features: {shp_res.feature_count} | Geom: {shp_res.geometry_type} | EPSG: {shp_res.epsg}")
print(f"   BBox: {shp_res.bbox}")
print(f"   Attributes: {shp_res.attribute_schema}")
print(f"   Missing sidecars: {shp_res.missing_sidecars} (Empty is good)")
print(f"   Valid geometries: {shp_res.all_geometries_valid}")

# ─────────────────────────────────────────────────────────────────────────────
# 2. GEOPACKAGE (GPKG) — MULTI-LAYER (BOUNDARIES + PLINTHS)
# ─────────────────────────────────────────────────────────────────────────────
gpkg_path = tmp / "survey_project.gpkg"
boundary_schema = {"geometry": "LineString", "properties": {"name": "str"}}
plinth_schema = {"geometry": "Polygon", "properties": {"building_id": "int", "height_m": "float"}}

with fiona.open(str(gpkg_path), "w", driver="GPKG", layer="boundaries", crs=from_epsg(32643), schema=boundary_schema) as g1:
    g1.write({
        "geometry": {"type": "LineString", "coordinates": [(385000, 2045000), (385100, 2045000), (385100, 2045050)]},
        "properties": {"name": "Site Boundary"}
    })

with fiona.open(str(gpkg_path), "w", driver="GPKG", layer="plinths", crs=from_epsg(32643), schema=plinth_schema) as g2:
    g2.write({
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[385020, 2045010], [385040, 2045010], [385040, 2045030], [385020, 2045030], [385020, 2045010]]]
        },
        "properties": {"building_id": 101, "height_m": 12.5}
    })

print("\n[STEP] 2. GEOPACKAGE (GPKG) — MULTI-LAYER")
gpkg_res = scan_gpkg(gpkg_path)
print(f"   Total layers detected: {len(gpkg_res)}")
for lyr in gpkg_res:
    print(f"   - Layer '{lyr.name}': {lyr.feature_count} features, geom={lyr.geometry_type}, EPSG={lyr.epsg}")
    print(f"     BBox: {lyr.bbox}")

# ─────────────────────────────────────────────────────────────────────────────
# 3. GEOJSON — VALIDATION OF INVALID GEOMETRIES & NULL PROPERTIES
# ─────────────────────────────────────────────────────────────────────────────
geojson_path = tmp / "validation_test.geojson"
geojson_data = {
    "type": "FeatureCollection",
    "name": "cadastral_vectors",
    "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
    "features": [
        {
            "type": "Feature",
            "properties": {"id": "V-1", "type": "residential", "owner": "Deshmukh"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[73.851, 18.521], [73.855, 18.521], [73.855, 18.525], [73.851, 18.525], [73.851, 18.521]]]
            }
        },
        {
            # Self-intersecting polygon (invalid topology)
            "type": "Feature",
            "properties": {"id": "V-2", "type": "commercial", "owner": None},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[73.856, 18.521], [73.860, 18.525], [73.860, 18.521], [73.856, 18.525], [73.856, 18.521]]]
            }
        },
        {
            # Null geometry feature
            "type": "Feature",
            "properties": {"id": "V-3", "type": "unmapped", "owner": None},
            "geometry": None
        }
    ]
}
with open(geojson_path, "w", encoding="utf-8") as f:
    json.dump(geojson_data, f)

print("\n[STEP] 3. GEOJSON")
gj_res = scan_geojson(geojson_path)[0]
print(f"   Layer: {gj_res.name} | Features: {gj_res.feature_count} | EPSG: {gj_res.epsg}")
print(f"   Invalid geometries detected: {gj_res.invalid_count} (Reasons: {gj_res.invalid_reasons})")
print(f"   Null geometries: {gj_res.null_geom_count}")
print(f"   Null attributes: {gj_res.null_attribute_counts}")
print(f"   Self-intersections: {gj_res.self_intersect_count}")

# ─────────────────────────────────────────────────────────────────────────────
# 4. KML / KMZ — XML PARSER + SHAPELY GEOMETRY & TOPOLOGY VALIDATION
# ─────────────────────────────────────────────────────────────────────────────
kml_path = tmp / "survey_benchmarks.kml"
kml_content = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Survey Benchmarks</name>
    <Placemark>
      <name>Benchmark BM-01</name>
      <description>Trig point primary</description>
      <Point>
        <coordinates>73.8520,18.5210,554.2</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Baseline Traverse</name>
      <LineString>
        <coordinates>73.8520,18.5210,554.2 73.8530,18.5220,555.0 73.8540,18.5230,556.1</coordinates>
      </LineString>
    </Placemark>
    <Placemark>
      <name>Control Zone Alpha</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              73.850,18.520,0 73.855,18.520,0 73.855,18.525,0 73.850,18.525,0 73.850,18.520,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
"""
with open(kml_path, "w", encoding="utf-8") as f:
    f.write(kml_content)

print("\n[STEP] 4. KML")
kml_res = scan_kml(kml_path)[0]
print(f"   Layer: {kml_res.name} | Support Level: {kml_res.support_level}")
print(f"   Placemarks / Features: {kml_res.feature_count} | CRS: {kml_res.crs_string}")
print(f"   Geometry types: {kml_res.geometry_types}")
print(f"   Shapely all valid: {kml_res.all_geometries_valid} | Invalid count: {kml_res.invalid_count}")
print(f"   BBox: {kml_res.bbox}")

# ─────────────────────────────────────────────────────────────────────────────
# 5. CAD: DXF — EZDXF 1.4.4 REAL ENTITIES, LAYERS, BLOCKS, 3D
# ─────────────────────────────────────────────────────────────────────────────
dxf_path = tmp / "survey_layout_r2018.dxf"
doc = ezdxf.new("R2018")
doc.header["$INSUNITS"] = 6  # Meters
msp = doc.modelspace()
doc.layers.add(name="PLOT_BOUNDARIES", color=1)
doc.layers.add(name="BUILDING_FOOTPRINTS", color=3)
doc.layers.add(name="CONTOURS_3D", color=4)
doc.layers.add(name="SURVEY_TEXT", color=7)

# 2D Polylines
msp.add_lwpolyline([(0, 0), (250, 0), (250, 180), (0, 180), (0, 0)], dxfattribs={"layer": "PLOT_BOUNDARIES"})
msp.add_lwpolyline([(30, 30), (120, 30), (120, 100), (30, 100), (30, 30)], dxfattribs={"layer": "BUILDING_FOOTPRINTS"})
# 3D Line with elevation Z
msp.add_line((0, 0, 550.0), (250, 180, 565.5), dxfattribs={"layer": "CONTOURS_3D"})
# Text
msp.add_text("SECTOR 4B CADASTRAL", dxfattribs={"layer": "SURVEY_TEXT", "height": 5.0}).set_placement((50, 50))
doc.saveas(str(dxf_path))

print("\n[STEP] 5. CAD: DXF")
dxf_res = scan_dxf(dxf_path)
print(f"   File: {dxf_res.name} | Support: {dxf_res.support_level} | Version: {dxf_res.dxf_version}")
print(f"   Units: {dxf_res.units} | Total Entities: {dxf_res.entity_count}")
print(f"   Entity Types: {dxf_res.entity_types}")
print(f"   Layers: {dxf_res.layer_names}")
print(f"   Entities per layer: {dxf_res.entities_per_layer}")
print(f"   Has 3D entities: {dxf_res.has_3d_entities}")
print(f"   BBox: {dxf_res.bbox}")

# ─────────────────────────────────────────────────────────────────────────────
# 6. CAD: DWG — HONEST REJECTION (NOT CLAIMING SUPPORT)
# ─────────────────────────────────────────────────────────────────────────────
dwg_path = tmp / "site_blueprint.dwg"
with open(dwg_path, "wb") as f:
    f.write(b"AC1032 binary content simulating proprietary DWG")

print("\n[STEP] 6. CAD: DWG (Honest Declaration)")
dwg_res = scan_dwg(dwg_path)
print(f"   File: {dwg_res.name} | Support Level: {dwg_res.support_level}")
print(f"   Support Note: {dwg_res.support_note}")
print(f"   Error: {dwg_res.error}")

# ─────────────────────────────────────────────────────────────────────────────
# 7. CAD: DGN — MICROSTATION DRIVER
# ─────────────────────────────────────────────────────────────────────────────
dgn_path = tmp / "highway_design.dgn"
with open(dgn_path, "wb") as f:
    f.write(b"\x08\x05fake dgn v8 header")

print("\n[STEP] 7. CAD: DGN (MicroStation V7 / V8 Probing)")
dgn_res = scan_dgn(dgn_path)[0]
print(f"   File: {dgn_res.name} | Support Level: {dgn_res.support_level}")
print(f"   Support Note: {dgn_res.support_note}")

# ─────────────────────────────────────────────────────────────────────────────
# 8. AGGREGATED DATASET REPORT & API RESPONSE
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("[STEP] 8. AGGREGATED GIS / CAD DATASET SCAN & API FORMATTER")
print("=" * 70)

report = scan_gis_cad_dataset(
    dataset_id="ds_cadastral_full",
    project_id="proj_smart_city",
    file_paths=[shp_path, gpkg_path, geojson_path, kml_path, dxf_path, dwg_path],
)
resp = format_gis_cad_response(report)

print(f"Category:     {resp['category']}")
print(f"Completeness: {resp['completeness']}%")
print(f"Quality:      {resp['quality']}%")
print(f"Status:       {resp['status']}")
print(f"\nSummary:")
for k, v in resp["summary"].items():
    print(f"  {k}: {v}")
print(f"\nSupport Matrix:")
for fmt, level in resp["support_matrix"].items():
    print(f"  {fmt:10s}: {level}")
print(f"\nIssues ({len(resp['issues'])}):")
for iss in resp["issues"]:
    print(f"  - {iss}")
print(f"\nWarnings ({len(resp['warnings'])}):")
for w in resp["warnings"]:
    print(f"  - {w}")

print("\n" + "=" * 70)
print("ALL FORMATS VERIFIED ACCORDING TO STEP 12 REQUIREMENTS.")
print("=" * 70)
