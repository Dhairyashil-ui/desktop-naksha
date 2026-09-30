import sys, os, tempfile, json
from pathlib import Path

# Add project root
sys.path.insert(0, "d:/surveynaksha")

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

tmp_dir = Path(tempfile.mkdtemp(prefix="naksha_gis_cad_test_"))
print("Temp directory:", tmp_dir)

# 1. GeoJSON test (with valid + invalid geometry + attributes)
gj_path = tmp_dir / "parcels.geojson"
gj_data = {
    "type": "FeatureCollection",
    "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::4326"}},
    "features": [
        {
            "type": "Feature",
            "properties": {"parcel_id": "P-101", "owner": "Govt", "area_sqm": 1250.5},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[73.85, 18.52], [73.86, 18.52], [73.86, 18.53], [73.85, 18.53], [73.85, 18.52]]]
            }
        },
        {
            "type": "Feature",
            "properties": {"parcel_id": "P-102", "owner": "Private", "area_sqm": 450.0},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[73.86, 18.52], [73.87, 18.52], [73.87, 18.53], [73.86, 18.53], [73.86, 18.52]]]
            }
        },
        {
            # Self-intersecting bowtie polygon (invalid)
            "type": "Feature",
            "properties": {"parcel_id": "P-103", "owner": None, "area_sqm": 0.0},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[73.87, 18.52], [73.88, 18.53], [73.88, 18.52], [73.87, 18.53], [73.87, 18.52]]]
            }
        },
        {
            # Empty / null geometry
            "type": "Feature",
            "properties": {"parcel_id": "P-104", "owner": "Unknown", "area_sqm": None},
            "geometry": None
        }
    ]
}
with open(gj_path, "w", encoding="utf-8") as f:
    json.dump(gj_data, f)

print("\n--- Testing GeoJSON Scanner ---")
layers = scan_geojson(gj_path)
for l in layers:
    print(f"Layer: {l.name} | Features: {l.feature_count} | Invalid: {l.invalid_count} | Null: {l.null_geom_count} | EPSG: {l.epsg}")
    print(f"Bbox: {l.bbox}")
    print(f"Attribute Schema: {l.attribute_schema}")
    print(f"Null Attributes: {l.null_attribute_counts}")

# 2. Shapefile test (via Fiona creation)
import fiona
from fiona.crs import from_epsg
shp_path = tmp_dir / "roads.shp"
schema = {
    "geometry": "LineString",
    "properties": {"road_id": "int", "name": "str", "width": "float"}
}
with fiona.open(str(shp_path), "w", driver="ESRI Shapefile", crs=from_epsg(32643), schema=schema) as shp:
    shp.write({
        "geometry": {"type": "LineString", "coordinates": [(380000, 2048000), (380500, 2048200), (381000, 2048500)]},
        "properties": {"road_id": 1, "name": "Ring Road", "width": 24.0}
    })
    shp.write({
        "geometry": {"type": "LineString", "coordinates": [(381000, 2048500), (381200, 2049000)]},
        "properties": {"road_id": 2, "name": "Link Road", "width": 12.0}
    })

print("\n--- Testing Shapefile Scanner ---")
shp_layers = scan_shapefile(shp_path)
for l in shp_layers:
    print(f"Layer: {l.name} | Features: {l.feature_count} | EPSG: {l.epsg} | CRS: {l.crs_string}")
    print(f"Bbox: {l.bbox}")
    print(f"Attributes: {l.attribute_schema}")

# 3. KML test
kml_path = tmp_dir / "landmarks.kml"
kml_content = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>City Landmarks</name>
    <Placemark>
      <name>Survey Marker 1</name>
      <description>Benchmark A-102</description>
      <Point>
        <coordinates>73.8567,18.5204,560.0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Survey Boundary</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              73.850,18.520,0 73.860,18.520,0 73.860,18.530,0 73.850,18.530,0 73.850,18.520,0
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

print("\n--- Testing KML Scanner ---")
kml_layers = scan_kml(kml_path)
for l in kml_layers:
    print(f"Layer: {l.name} | Features: {l.feature_count} | Level: {l.support_level} | EPSG: {l.epsg}")
    print(f"Geom types: {l.geometry_types} | Bbox: {l.bbox}")
    print(f"Note: {l.support_note}")

# 4. DXF test (via ezdxf)
import ezdxf
dxf_path = tmp_dir / "cadastral_plan.dxf"
doc = ezdxf.new("R2010")
doc.header["$INSUNITS"] = 6  # Meters
msp = doc.modelspace()
doc.layers.add(name="SURVEY_BOUNDARY", color=1)
doc.layers.add(name="BUILDING_PLINTH", color=3)
doc.layers.add(name="TEXT_ANNOTATIONS", color=7)

msp.add_lwpolyline([(0, 0), (100, 0), (100, 80), (0, 80), (0, 0)], dxfattribs={"layer": "SURVEY_BOUNDARY"})
msp.add_lwpolyline([(20, 20), (60, 20), (60, 50), (20, 50), (20, 20)], dxfattribs={"layer": "BUILDING_PLINTH"})
msp.add_text("Plot 42", dxfattribs={"layer": "TEXT_ANNOTATIONS", "height": 2.5}).set_placement((30, 35))
doc.saveas(str(dxf_path))

print("\n--- Testing DXF Scanner ---")
dxf_scan = scan_dxf(dxf_path)
print(f"CAD File: {dxf_scan.name} | Version: {dxf_scan.dxf_version} | Units: {dxf_scan.units}")
print(f"Entities: {dxf_scan.entity_count} | Types: {dxf_scan.entity_types}")
print(f"Layers: {dxf_scan.layer_names} | Per layer: {dxf_scan.entities_per_layer}")
print(f"Bbox: {dxf_scan.bbox}")

# 5. DWG test (honest rejection)
dwg_path = tmp_dir / "sample_drawing.dwg"
with open(dwg_path, "wb") as f:
    f.write(b"AC1032 fake dwg header")

print("\n--- Testing DWG Scanner (Honest rejection) ---")
dwg_scan = scan_dwg(dwg_path)
print(f"CAD File: {dwg_scan.name} | Support Level: {dwg_scan.support_level}")
print(f"Support Note: {dwg_scan.support_note}")
print(f"Error: {dwg_scan.error}")

# 6. Combined Dataset Scan
print("\n--- Testing Dataset Aggregate Scan ---")
report = scan_gis_cad_dataset(
    dataset_id="ds_test_gis_cad",
    project_id="proj_alpha",
    file_paths=[gj_path, shp_path, kml_path, dxf_path, dwg_path],
)
resp = format_gis_cad_response(report)
print(f"Status: {resp['status']} | Completeness: {resp['completeness']}% | Quality: {resp['quality']}%")
print(f"Total features: {resp['summary']['total_features']} | Dominant EPSG: {resp['summary']['dominant_epsg']}")
print(f"Issues: {resp['issues']}")
print(f"Warnings: {resp['warnings']}")
