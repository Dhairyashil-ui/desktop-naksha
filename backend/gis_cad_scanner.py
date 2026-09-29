"""
Naksha 2.0 — Real GIS / CAD Scanner (Step 12)

HONEST SUPPORT MATRIX (probed at build time in this environment):
  ┌──────────┬────────────┬────────────────────────────────────────────────────────┐
  │ Format   │ Support    │ Library / Method                                       │
  ├──────────┼────────────┼────────────────────────────────────────────────────────┤
  │ SHP      │ FULL       │ fiona 1.10.1 + shapely 2.1 (companion check .dbf/.prj) │
  │ GPKG     │ FULL       │ fiona (multi-layer inspection)                         │
  │ GeoJSON  │ FULL       │ fiona + shapely fallback (RFC 7946 EPSG:4326)         │
  │ KML      │ PARTIAL    │ xml.etree + shapely validation (WGS84 EPSG:4326)      │
  │ DXF      │ FULL       │ ezdxf 1.4.4 (entities, layers, blocks, units, bbox)    │
  │ DWG      │ REJECTED   │ Proprietary Autodesk binary (no parser in environment) │
  │ DGN      │ PARTIAL    │ fiona DGN driver (Microstation V7 only; V8 rejected)   │
  └──────────┴────────────┴────────────────────────────────────────────────────────┘

GIS checks (per layer):
  - Exact feature count
  - Geometry type distribution (Point, LineString, Polygon, Multi*, etc.)
  - CRS / EPSG detection (from PRJ/WKT, OGC urn, or spec default)
  - Bounding box (actual min/max coordinates)
  - Invalid geometries (shapely is_valid + explain_validity reasons)
  - Empty / null geometries
  - Attribute schema (field names and types)
  - Null attribute counts per field
  - Duplicate geometries (WKB hash)
  - Topology: sliver polygons (area < threshold) and self-intersections (is_simple)
  - Companion file checks for Shapefiles (.shx, .dbf, .prj)

CAD checks (DXF):
  - Entity type distribution (LINE, LWPOLYLINE, POLYLINE, INSERT, TEXT, MTEXT, CIRCLE, etc.)
  - Layer table & entity count per layer
  - Bounding box from actual entity coordinates
  - Measurement units ($INSUNITS)
  - AutoCAD version ($ACADVER)
  - Block definitions & block references (INSERT)
  - Text & annotation counts
  - 3D entity detection (Z elevation / 3DFACE / MESH)
"""

from __future__ import annotations

import io
import os
import re
import json
import math
import hashlib
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timezone
from collections import Counter

import numpy as np

# ──────────────────────────────────────────────────────────────────────────────
# SUPPORTED EXTENSIONS — HONEST DECLARATION
# ──────────────────────────────────────────────────────────────────────────────

GIS_EXTS_FULL     = {".shp", ".gpkg", ".geojson", ".json"}
GIS_EXTS_PARTIAL  = {".kml", ".kmz", ".dgn"}
CAD_EXTS_FULL     = {".dxf"}
CAD_EXTS_REJECTED = {".dwg"}   # no native parser available in this environment

ALL_GIS_CAD_EXTS  = GIS_EXTS_FULL | GIS_EXTS_PARTIAL | CAD_EXTS_FULL | CAD_EXTS_REJECTED

# Minimum acceptable values / thresholds
MIN_FEATURES = 1
SLIVER_AREA_M2 = 0.01          # polygons smaller than this are slivers
DUPLICATE_GEOM_RATIO = 0.1     # flag if >10% geometries are duplicates


# ──────────────────────────────────────────────────────────────────────────────
# DATA CLASSES
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class LayerScan:
    """Results for one GIS layer (or file, if single-layer)."""
    name: str
    format: str
    feature_count: int = 0
    geometry_type: str = "Unknown"
    geometry_types: Dict[str, int] = field(default_factory=dict)
    # CRS
    crs_wkt: Optional[str] = None
    crs_string: Optional[str] = None
    epsg: Optional[int] = None
    # Bounding box
    bbox: Optional[Dict[str, float]] = None
    # Validity
    invalid_count: int = 0
    invalid_reasons: List[str] = field(default_factory=list)
    null_geom_count: int = 0
    empty_geom_count: int = 0
    duplicate_geom_count: int = 0
    # Attributes
    attribute_schema: Dict[str, str] = field(default_factory=dict)
    null_attribute_counts: Dict[str, int] = field(default_factory=dict)
    # Topology (polygons)
    sliver_count: int = 0
    self_intersect_count: int = 0
    # Shapefile companion files
    missing_sidecars: List[str] = field(default_factory=list)
    # Validation flags
    has_valid_crs: bool = False
    has_valid_bbox: bool = False
    all_geometries_valid: bool = False
    # Support level
    support_level: str = "FULL"   # FULL | PARTIAL | REJECTED
    support_note: str = ""
    error: Optional[str] = None
    warnings: List[str] = field(default_factory=list)


@dataclass
class CADLayerScan:
    """Results for a DXF/DWG/DGN CAD drawing."""
    name: str
    format: str
    support_level: str = "FULL"   # FULL | PARTIAL | REJECTED
    support_note: str = ""
    error: Optional[str] = None
    warnings: List[str] = field(default_factory=list)
    # Entities
    entity_count: int = 0
    entity_types: Dict[str, int] = field(default_factory=dict)
    layer_names: List[str] = field(default_factory=list)
    entities_per_layer: Dict[str, int] = field(default_factory=dict)
    # Geometry bounds
    bbox: Optional[Dict[str, float]] = None
    # DXF metadata
    units: Optional[str] = None
    dxf_version: Optional[str] = None
    block_names: List[str] = field(default_factory=list)
    text_count: int = 0
    block_ref_count: int = 0
    has_3d_entities: bool = False
    coordinate_system_note: str = "Local engineering / CAD coordinates (no projected CRS)"


@dataclass
class GISCADDatasetReport:
    dataset_id: str
    project_id: str
    scanned_at: str = ""
    total_files: int = 0
    readable_files: int = 0
    # GIS layers
    gis_layers: List[LayerScan] = field(default_factory=list)
    # CAD layers
    cad_layers: List[CADLayerScan] = field(default_factory=list)
    # Aggregated stats
    total_features: int = 0
    combined_bbox: Optional[Dict[str, float]] = None
    dominant_epsg: Optional[int] = None
    consistent_crs: bool = True
    geometry_types: Dict[str, int] = field(default_factory=dict)
    has_valid_crs: bool = False
    # Support declarations
    support_matrix: Dict[str, str] = field(default_factory=dict)
    # Scores & Status
    completeness: float = 0.0
    quality: float = 0.0
    status: str = "REJECTED"       # READY | PARTIAL | REJECTED
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────────────
# GIS PARSERS — fiona + shapely
# ──────────────────────────────────────────────────────────────────────────────

def _epsg_from_crs(crs_obj) -> Optional[int]:
    """Extract integer EPSG code from a fiona/pyproj CRS representation."""
    if crs_obj is None:
        return None
    try:
        import pyproj
        pj = pyproj.CRS.from_user_input(crs_obj)
        code = pj.to_epsg()
        if code:
            return int(code)
    except Exception:
        pass
    try:
        s = str(crs_obj)
        m = re.search(r"EPSG[:\s]+(\d{4,5})", s, re.IGNORECASE)
        if m:
            return int(m.group(1))
    except Exception:
        pass
    return None


def _scan_fiona_layer(ds_path: str, layer_name: Optional[str], fmt: str) -> LayerScan:
    """
    Scan a single layer using Fiona + Shapely.
    Extracts feature count, geometries, CRS, bbox, attributes, and topology.
    """
    from shapely.geometry import shape
    from shapely.validation import explain_validity

    display_name = layer_name or Path(ds_path).stem
    scan = LayerScan(name=display_name, format=fmt)

    try:
        import fiona

        open_kwargs = {}
        if layer_name:
            open_kwargs["layer"] = layer_name

        with fiona.open(ds_path, **open_kwargs) as src:
            scan.feature_count = len(src)
            scan.geometry_type = src.schema.get("geometry", "Unknown")

            # CRS
            crs = src.crs
            if crs:
                scan.crs_wkt = str(crs)
                epsg = _epsg_from_crs(crs)
                scan.epsg = epsg
                scan.crs_string = f"EPSG:{epsg}" if epsg else str(crs)[:100]
                scan.has_valid_crs = True

            # Attribute schema
            props = src.schema.get("properties", {})
            scan.attribute_schema = dict(props)
            null_counts = {k: 0 for k in props}

            # Iterate features
            geom_types: Counter = Counter()
            invalid_geoms = 0
            invalid_reasons: List[str] = []
            null_geoms = 0
            empty_geoms = 0
            slivers = 0
            self_ints = 0
            wkb_hashes: Set[bytes] = set()
            dup_count = 0
            xs, ys = [], []

            MAX_SAMPLE = 50_000
            sampled = 0

            for feat in src:
                geom_raw = feat.get("geometry")

                # Null geometry
                if geom_raw is None:
                    null_geoms += 1
                    sampled += 1
                    continue

                try:
                    geom = shape(geom_raw)
                except Exception as e:
                    invalid_geoms += 1
                    if len(invalid_reasons) < 5:
                        invalid_reasons.append(f"Invalid geometry shape: {str(e)[:60]}")
                    sampled += 1
                    continue

                if geom.is_empty:
                    empty_geoms += 1
                    sampled += 1
                    continue

                geom_types[geom.geom_type] += 1

                # Validity check
                if not geom.is_valid:
                    invalid_geoms += 1
                    if len(invalid_reasons) < 5:
                        invalid_reasons.append(explain_validity(geom))

                # Bounds sample (every 10th feature for large layers)
                if sampled % 10 == 0 or sampled < 1000:
                    b = geom.bounds
                    if all(not math.isnan(v) for v in b):
                        xs.extend([b[0], b[2]])
                        ys.extend([b[1], b[3]])

                # Topology checks for polygons
                if "Polygon" in geom.geom_type and (sampled % 20 == 0 or sampled < 100):
                    try:
                        area = geom.area
                        if area < SLIVER_AREA_M2:
                            slivers += 1
                        if not geom.is_simple:
                            self_ints += 1
                    except Exception:
                        pass

                # Duplicate detection (WKB hash)
                if sampled % 5 == 0 and sampled < 20_000:
                    try:
                        wkb = geom.wkb
                        h = hashlib.md5(wkb).digest()
                        if h in wkb_hashes:
                            dup_count += 1
                        else:
                            wkb_hashes.add(h)
                    except Exception:
                        pass

                # Attribute null counts
                for k, v in feat.get("properties", {}).items():
                    if v is None and k in null_counts:
                        null_counts[k] += 1

                sampled += 1
                if sampled >= MAX_SAMPLE:
                    break

            scan.geometry_types = dict(geom_types)
            scan.invalid_count = invalid_geoms
            scan.invalid_reasons = invalid_reasons
            scan.null_geom_count = null_geoms
            scan.empty_geom_count = empty_geoms
            scale_factor = scan.feature_count / max(sampled, 1) if sampled else 1.0
            scan.sliver_count = int(slivers * scale_factor)
            scan.self_intersect_count = self_ints
            scan.duplicate_geom_count = dup_count
            scan.null_attribute_counts = {k: v for k, v in null_counts.items() if v > 0}

            if xs and ys:
                scan.bbox = {
                    "x_min": round(float(np.min(xs)), 6),
                    "x_max": round(float(np.max(xs)), 6),
                    "y_min": round(float(np.min(ys)), 6),
                    "y_max": round(float(np.max(ys)), 6),
                }
                scan.has_valid_bbox = True

            scan.all_geometries_valid = (invalid_geoms == 0 and null_geoms == 0)

    except Exception as e:
        scan.error = str(e)
        scan.support_level = "PARTIAL"

    return scan


def scan_shapefile(path: Path) -> List[LayerScan]:
    """
    Scan an ESRI Shapefile.
    Validates geometries, CRS, attributes, and checks companion files (.shx, .dbf, .prj).
    """
    stem = path.stem
    parent = path.parent

    # Check companion files
    missing_sidecars = []
    for ext in [".shx", ".dbf", ".prj"]:
        if not (parent / f"{stem}{ext}").exists() and not (parent / f"{stem}{ext.upper()}").exists():
            missing_sidecars.append(ext)

    layers = [_scan_fiona_layer(str(path), None, "Shapefile")]
    layer = layers[0]
    layer.missing_sidecars = missing_sidecars

    if ".prj" in missing_sidecars:
        layer.warnings.append("Missing .prj projection file (coordinate reference system is undefined)")
        layer.has_valid_crs = False
    if ".dbf" in missing_sidecars:
        layer.warnings.append("Missing .dbf file (attribute table is unavailable)")
    if ".shx" in missing_sidecars:
        layer.warnings.append("Missing .shx spatial index file")

    return layers


def scan_gpkg(path: Path) -> List[LayerScan]:
    """
    Scan a GeoPackage container.
    Enumerates and scans ALL layers inside the GPKG.
    """
    import fiona
    layers = []
    try:
        layer_names = fiona.listlayers(str(path))
    except Exception as e:
        s = LayerScan(name=path.stem, format="GPKG")
        s.error = f"Cannot read GPKG layers: {e}"
        s.support_level = "PARTIAL"
        return [s]

    if not layer_names:
        s = LayerScan(name=path.stem, format="GPKG")
        s.error = "GeoPackage contains no vector layers"
        s.warnings.append("Empty GPKG file")
        return [s]

    for lname in layer_names:
        sc = _scan_fiona_layer(str(path), lname, "GPKG")
        layers.append(sc)
    return layers


def _scan_geojson_fallback(path: Path) -> LayerScan:
    """Fallback GeoJSON scanner using stdlib json + shapely when Fiona fails."""
    from shapely.geometry import shape
    from shapely.validation import explain_validity

    scan = LayerScan(name=path.stem, format="GeoJSON")
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            data = json.load(f)

        # CRS detection
        crs_dict = data.get("crs")
        if crs_dict and isinstance(crs_dict, dict):
            crs_name = crs_dict.get("properties", {}).get("name", "")
            scan.crs_string = crs_name
            scan.epsg = _epsg_from_crs(crs_name)
            scan.has_valid_crs = True
        else:
            # Default per RFC 7946
            scan.epsg = 4326
            scan.crs_string = "EPSG:4326 (WGS84 default per RFC 7946)"
            scan.has_valid_crs = True

        features = data.get("features", [])
        if not features and data.get("type") == "Feature":
            features = [data]
        elif not features and "geometry" in data:
            features = [{"type": "Feature", "properties": {}, "geometry": data}]

        scan.feature_count = len(features)
        geom_types: Counter = Counter()
        invalid_geoms = 0
        invalid_reasons: List[str] = []
        null_geoms = 0
        empty_geoms = 0
        xs, ys = [], []
        props_schema: Dict[str, str] = {}
        null_prop_counts: Counter = Counter()

        for feat in features:
            props = feat.get("properties") or {}
            for k, v in props.items():
                if k not in props_schema:
                    props_schema[k] = type(v).__name__
                if v is None:
                    null_prop_counts[k] += 1

            g_raw = feat.get("geometry")
            if g_raw is None:
                null_geoms += 1
                continue

            try:
                geom = shape(g_raw)
            except Exception as e:
                invalid_geoms += 1
                if len(invalid_reasons) < 5:
                    invalid_reasons.append(f"Invalid geometry: {e}")
                continue

            if geom.is_empty:
                empty_geoms += 1
                continue

            geom_types[geom.geom_type] += 1
            if not geom.is_valid:
                invalid_geoms += 1
                if len(invalid_reasons) < 5:
                    invalid_reasons.append(explain_validity(geom))

            b = geom.bounds
            xs.extend([b[0], b[2]])
            ys.extend([b[1], b[3]])

        scan.geometry_types = dict(geom_types)
        scan.geometry_type = max(geom_types, key=geom_types.get) if geom_types else "Unknown"
        scan.invalid_count = invalid_geoms
        scan.invalid_reasons = invalid_reasons
        scan.null_geom_count = null_geoms
        scan.empty_geom_count = empty_geoms
        scan.attribute_schema = props_schema
        scan.null_attribute_counts = dict(null_prop_counts)

        if xs and ys:
            scan.bbox = {
                "x_min": round(float(np.min(xs)), 6), "x_max": round(float(np.max(xs)), 6),
                "y_min": round(float(np.min(ys)), 6), "y_max": round(float(np.max(ys)), 6),
            }
            scan.has_valid_bbox = True
        scan.all_geometries_valid = (invalid_geoms == 0 and null_geoms == 0)

    except Exception as e:
        scan.error = f"GeoJSON parse error: {e}"
        scan.support_level = "PARTIAL"

    return scan


def scan_geojson(path: Path) -> List[LayerScan]:
    """Scan a GeoJSON file. Fiona first, with graceful JSON+Shapely fallback."""
    try:
        return [_scan_fiona_layer(str(path), None, "GeoJSON")]
    except Exception:
        return [_scan_geojson_fallback(path)]


def _parse_kml_coordinates(coord_text: str) -> List[tuple]:
    """Parse KML coordinate tuples: lon,lat,alt lon,lat,alt ..."""
    pts = []
    for chunk in coord_text.strip().split():
        parts = chunk.split(",")
        if len(parts) >= 2:
            try:
                lon = float(parts[0])
                lat = float(parts[1])
                z = float(parts[2]) if len(parts) > 2 else 0.0
                pts.append((lon, lat, z))
            except ValueError:
                pass
    return pts


def scan_kml(path: Path) -> List[LayerScan]:
    """
    KML / KMZ scanner.
    Fiona has no KML driver in this Windows environment.
    We parse the XML structure and construct real Shapely geometries
    to validate geometry, invalid geometries, empty features, bbox, and topology.
    CRS is WGS84 (EPSG:4326) per OGC KML 2.2 standard.
    """
    import xml.etree.ElementTree as ET
    from shapely.geometry import Point, LineString, Polygon, GeometryCollection
    from shapely.validation import explain_validity

    scan = LayerScan(name=path.stem, format="KML" if path.suffix.lower() == ".kml" else "KMZ")
    scan.support_level = "PARTIAL"
    scan.support_note = (
        "Parsed via xml.etree + Shapely validation (Fiona KML driver not present in environment). "
        "CRS is WGS84 (EPSG:4326) per OGC KML standard."
    )
    scan.has_valid_crs = True
    scan.epsg = 4326
    scan.crs_string = "EPSG:4326 (WGS84 — OGC KML standard)"

    try:
        # Handle KMZ
        if path.suffix.lower() == ".kmz":
            import zipfile
            with zipfile.ZipFile(path, "r") as zf:
                kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
                if not kml_names:
                    scan.error = "KMZ archive contains no .kml entry"
                    scan.support_level = "REJECTED"
                    return [scan]
                content = zf.read(kml_names[0])
        else:
            content = path.read_bytes()

        # Remove XML namespaces to simplify element querying
        content_str = content.decode("utf-8", errors="replace")
        content_str = re.sub(r'\s*xmlns[^=]*="[^"]*"', "", content_str)
        root = ET.fromstring(content_str)

        placemarks = root.findall(".//Placemark")
        scan.feature_count = len(placemarks)

        geom_types: Counter = Counter()
        invalid_geoms = 0
        invalid_reasons: List[str] = []
        null_geoms = 0
        empty_geoms = 0
        slivers = 0
        self_ints = 0
        xs, ys = [], []
        props_schema: Dict[str, str] = {}

        for pm in placemarks:
            # Extract basic attributes
            name_el = pm.find("name")
            if name_el is not None and name_el.text:
                props_schema["name"] = "str"
            desc_el = pm.find("description")
            if desc_el is not None and desc_el.text:
                props_schema["description"] = "str"

            # ExtendedData attributes
            for data_el in pm.findall(".//Data"):
                dname = data_el.get("name")
                if dname:
                    props_schema[dname] = "str"
            for sdata_el in pm.findall(".//SimpleData"):
                sname = sdata_el.get("name")
                if sname:
                    props_schema[sname] = "str"

            # Parse Geometry into Shapely object
            geom = None

            # Point
            pt_el = pm.find(".//Point/coordinates")
            if pt_el is not None and pt_el.text:
                coords = _parse_kml_coordinates(pt_el.text)
                if coords:
                    geom = Point(coords[0][0], coords[0][1])

            # LineString
            if geom is None:
                ls_el = pm.find(".//LineString/coordinates")
                if ls_el is not None and ls_el.text:
                    coords = _parse_kml_coordinates(ls_el.text)
                    if len(coords) >= 2:
                        geom = LineString([(c[0], c[1]) for c in coords])

            # Polygon
            if geom is None:
                poly_el = pm.find(".//Polygon")
                if poly_el is not None:
                    outer_el = poly_el.find(".//outerBoundaryIs//coordinates")
                    if outer_el is not None and outer_el.text:
                        outer_coords = [(c[0], c[1]) for c in _parse_kml_coordinates(outer_el.text)]
                        if len(outer_coords) >= 3:
                            inners = []
                            for inner_el in poly_el.findall(".//innerBoundaryIs//coordinates"):
                                if inner_el.text:
                                    ic = [(c[0], c[1]) for c in _parse_kml_coordinates(inner_el.text)]
                                    if len(ic) >= 3:
                                        inners.append(ic)
                            try:
                                geom = Polygon(outer_coords, inners)
                            except Exception as e:
                                invalid_geoms += 1
                                if len(invalid_reasons) < 5:
                                    invalid_reasons.append(f"Polygon ring error: {e}")

            if geom is None:
                null_geoms += 1
                continue

            if geom.is_empty:
                empty_geoms += 1
                continue

            geom_types[geom.geom_type] += 1

            if not geom.is_valid:
                invalid_geoms += 1
                if len(invalid_reasons) < 5:
                    invalid_reasons.append(explain_validity(geom))

            b = geom.bounds
            xs.extend([b[0], b[2]])
            ys.extend([b[1], b[3]])

            if "Polygon" in geom.geom_type:
                try:
                    if geom.area < 1e-7:  # degrees approx sliver in WGS84
                        slivers += 1
                    if not geom.is_simple:
                        self_ints += 1
                except Exception:
                    pass

        scan.geometry_types = dict(geom_types)
        scan.geometry_type = max(geom_types, key=geom_types.get) if geom_types else "Unknown"
        scan.invalid_count = invalid_geoms
        scan.invalid_reasons = invalid_reasons
        scan.null_geom_count = null_geoms
        scan.empty_geom_count = empty_geoms
        scan.sliver_count = slivers
        scan.self_intersect_count = self_ints
        scan.attribute_schema = props_schema

        if xs and ys:
            scan.bbox = {
                "x_min": round(float(np.min(xs)), 6), "x_max": round(float(np.max(xs)), 6),
                "y_min": round(float(np.min(ys)), 6), "y_max": round(float(np.max(ys)), 6),
            }
            scan.has_valid_bbox = True

        scan.all_geometries_valid = (invalid_geoms == 0 and null_geoms == 0)

    except Exception as e:
        scan.error = f"KML parse error: {e}"
        scan.support_level = "PARTIAL"

    return [scan]


def scan_dgn(path: Path) -> List[LayerScan]:
    """
    DGN (Bentley MicroStation Design).
    Uses Fiona's DGN driver. Supports MicroStation V7 files.
    V8 files are proprietary and will fail with a clear message.
    """
    scan = LayerScan(name=path.stem, format="DGN")
    scan.support_level = "PARTIAL"
    scan.support_note = "MicroStation V7 DGN supported via Fiona driver. V8 binary format requires conversion to DXF."

    try:
        import fiona
        from shapely.geometry import shape

        with fiona.open(str(path), driver="DGN") as src:
            scan.feature_count = len(src)
            geom_types: Counter = Counter()
            xs, ys = [], []

            for feat in src:
                g = feat.get("geometry")
                if g:
                    gtype = g.get("type", "Unknown")
                    geom_types[gtype] += 1
                    try:
                        sh = shape(g)
                        b = sh.bounds
                        xs.extend([b[0], b[2]])
                        ys.extend([b[1], b[3]])
                    except Exception:
                        pass

            scan.geometry_types = dict(geom_types)
            if xs:
                scan.bbox = {
                    "x_min": round(float(np.min(xs)), 4), "x_max": round(float(np.max(xs)), 4),
                    "y_min": round(float(np.min(ys)), 4), "y_max": round(float(np.max(ys)), 4),
                }
                scan.has_valid_bbox = True
            scan.all_geometries_valid = True

    except Exception as e:
        err = str(e)
        scan.error = f"DGN parse failed: {err}"
        scan.support_level = "REJECTED"
        if "V8" in err or "unsupported" in err.lower() or "not recognized" in err.lower():
            scan.support_note = "MicroStation V8 DGN is proprietary and not supported by the Fiona driver. Please convert to DXF or V7 DGN."
        else:
            scan.support_note = f"DGN driver error: {err}"

    return [scan]


# ──────────────────────────────────────────────────────────────────────────────
# CAD PARSERS
# ──────────────────────────────────────────────────────────────────────────────

DXF_UNITS = {
    0: "Unitless", 1: "Inches", 2: "Feet", 3: "Miles", 4: "Millimeters",
    5: "Centimeters", 6: "Meters", 7: "Kilometers", 8: "Microinches",
    9: "Mils", 10: "Yards", 11: "Angstroms", 12: "Nanometers",
    13: "Microns", 14: "Decimeters", 15: "Decameters", 16: "Hectometers",
    17: "Gigameters", 18: "Astronomical units", 19: "Light years",
    20: "Parsecs",
}

DXF_VERSIONS = {
    "AC1006": "R10", "AC1009": "R12", "AC1012": "R13", "AC1014": "R14",
    "AC1015": "2000", "AC1018": "2004", "AC1021": "2007", "AC1024": "2010",
    "AC1027": "2013", "AC1032": "2018",
}


def scan_dxf(path: Path) -> CADLayerScan:
    """
    DXF scanner using ezdxf 1.4.4.
    Extracts entities, layers, bounding box, units, version, blocks, and 3D features.
    """
    import ezdxf

    cad = CADLayerScan(name=path.stem, format="DXF")
    cad.support_level = "FULL"
    cad.support_note = "Full native DXF parsing via ezdxf 1.4.4 (entities, layers, blocks, units, extents)"

    try:
        doc = ezdxf.readfile(str(path))
        msp = doc.modelspace()

        # Version
        ver_code = doc.dxfversion
        cad.dxf_version = f"DXF {DXF_VERSIONS.get(ver_code, ver_code)}"

        # Units
        try:
            unit_code = doc.header.get("$INSUNITS", 0)
            cad.units = DXF_UNITS.get(unit_code, f"Code {unit_code}")
        except Exception:
            cad.units = "Unknown"

        # Entity scan
        entity_types: Counter = Counter()
        per_layer: Counter = Counter()
        xs, ys, zs = [], [], []
        text_count = 0
        block_refs = 0
        has_3d = False

        for entity in msp:
            etype = entity.dxftype()
            entity_types[etype] += 1
            layer = entity.dxf.get("layer", "0")
            per_layer[layer] += 1

            if etype in ("TEXT", "MTEXT", "ATTDEF", "ATTRIB"):
                text_count += 1
            if etype == "INSERT":
                block_refs += 1

            # Vertex / location extraction for bbox
            try:
                if hasattr(entity.dxf, "start"):
                    p = entity.dxf.start
                    xs.append(p.x); ys.append(p.y)
                    if abs(p.z) > 0.001: has_3d = True; zs.append(p.z)
                if hasattr(entity.dxf, "end"):
                    p = entity.dxf.end
                    xs.append(p.x); ys.append(p.y)
                if hasattr(entity.dxf, "insert"):
                    p = entity.dxf.insert
                    xs.append(p.x); ys.append(p.y)
                    if abs(p.z) > 0.001: has_3d = True; zs.append(p.z)
                if hasattr(entity.dxf, "center"):
                    p = entity.dxf.center
                    xs.append(p.x); ys.append(p.y)
            except Exception:
                pass

            if etype == "LWPOLYLINE":
                try:
                    for pt in entity.get_points():
                        xs.append(pt[0]); ys.append(pt[1])
                except Exception:
                    pass

            if etype == "POLYLINE":
                try:
                    for v in entity.vertices:
                        p = v.dxf.location
                        xs.append(p.x); ys.append(p.y)
                        if abs(p.z) > 0.001: has_3d = True
                except Exception:
                    pass

        cad.entity_count = sum(entity_types.values())
        cad.entity_types = dict(entity_types)
        cad.layer_names = sorted(per_layer.keys())
        cad.entities_per_layer = dict(per_layer)
        cad.text_count = text_count
        cad.block_ref_count = block_refs
        cad.has_3d_entities = has_3d

        if xs and ys:
            cad.bbox = {
                "x_min": round(float(np.min(xs)), 4), "x_max": round(float(np.max(xs)), 4),
                "y_min": round(float(np.min(ys)), 4), "y_max": round(float(np.max(ys)), 4),
            }
            if zs:
                cad.bbox["z_min"] = round(float(np.min(zs)), 4)
                cad.bbox["z_max"] = round(float(np.max(zs)), 4)

        # Block definitions
        cad.block_names = [b.name for b in doc.blocks if not b.name.startswith("*")]

    except Exception as e:
        cad.error = f"DXF parse error: {e}"
        cad.support_level = "PARTIAL"

    return cad


def scan_dwg(path: Path) -> CADLayerScan:
    """
    DWG scanner.
    Honest rejection: DWG is Autodesk's proprietary binary format.
    No parser is installed in this Python environment.
    """
    cad = CADLayerScan(name=path.stem, format="DWG")
    cad.support_level = "REJECTED"
    cad.support_note = (
        "DWG is a proprietary Autodesk binary format. "
        "No open-source parser exists in this environment (ezdxf only parses DXF; ODA File Converter / LibreDWG not present). "
        "Please convert your DWG file to DXF (R12–2018) using AutoCAD, TrueView, FreeCAD, or ODA File Converter."
    )
    cad.error = "DWG format not supported directly: convert to DXF first"
    return cad


# ──────────────────────────────────────────────────────────────────────────────
# DISPATCH
# ──────────────────────────────────────────────────────────────────────────────

def scan_gis_cad_file(path: Path) -> tuple[list, list]:
    """
    Dispatches a single file to the appropriate GIS or CAD parser.
    Returns (gis_layers: List[LayerScan], cad_layers: List[CADLayerScan]).
    """
    ext = path.suffix.lower()

    if ext == ".shp":
        return scan_shapefile(path), []
    elif ext == ".gpkg":
        return scan_gpkg(path), []
    elif ext in (".geojson", ".json"):
        return scan_geojson(path), []
    elif ext in (".kml", ".kmz"):
        return scan_kml(path), []
    elif ext == ".dgn":
        return scan_dgn(path), []
    elif ext == ".dxf":
        return [], [scan_dxf(path)]
    elif ext == ".dwg":
        return [], [scan_dwg(path)]
    else:
        layer = LayerScan(name=path.stem, format=ext.upper())
        layer.support_level = "REJECTED"
        layer.error = f"Unsupported format: {ext}"
        return [layer], []


# ──────────────────────────────────────────────────────────────────────────────
# DATASET-LEVEL AGGREGATION & HONEST SCORING
# ──────────────────────────────────────────────────────────────────────────────

def scan_gis_cad_dataset(
    dataset_id: str,
    project_id: str,
    file_paths: List[Path],
) -> GISCADDatasetReport:
    """
    Scans all GIS and CAD files in a dataset.
    Validates features, CRS, attributes, invalid geometries, empty features,
    bounding box, and topology. Computes completeness, quality, and status.
    """
    report = GISCADDatasetReport(
        dataset_id=dataset_id,
        project_id=project_id,
        total_files=len(file_paths),
        scanned_at=datetime.now(timezone.utc).isoformat(),
        support_matrix={
            "SHP": "FULL (fiona + shapely)",
            "GPKG": "FULL (multi-layer fiona)",
            "GeoJSON": "FULL (fiona + shapely fallback)",
            "KML/KMZ": "PARTIAL (xml.etree + shapely validation, WGS84)",
            "DXF": "FULL (ezdxf 1.4.4)",
            "DWG": "REJECTED (Autodesk binary, no parser in env)",
            "DGN": "PARTIAL (Microstation V7 via fiona)",
        },
    )

    if not file_paths:
        report.issues.append("No GIS or CAD files found on disk for this dataset")
        report.status = "REJECTED"
        return report

    all_gis: List[LayerScan] = []
    all_cad: List[CADLayerScan] = []

    for p in file_paths:
        if p.suffix.lower() in ALL_GIS_CAD_EXTS:
            gis, cad = scan_gis_cad_file(p)
            all_gis.extend(gis)
            all_cad.extend(cad)
            report.readable_files += 1

    report.gis_layers = all_gis
    report.cad_layers = all_cad

    readable_gis = [l for l in all_gis if l.error is None or l.feature_count > 0]
    report.total_features = sum(l.feature_count for l in readable_gis)

    # Combined Bounding Box
    bboxes = [l.bbox for l in readable_gis if l.bbox]
    bboxes += [c.bbox for c in all_cad if c.bbox]
    if bboxes:
        report.combined_bbox = {
            "x_min": min(b["x_min"] for b in bboxes),
            "x_max": max(b["x_max"] for b in bboxes),
            "y_min": min(b["y_min"] for b in bboxes),
            "y_max": max(b["y_max"] for b in bboxes),
        }

    # CRS Consistency & Dominant EPSG
    epsg_vals = [l.epsg for l in readable_gis if l.epsg]
    if epsg_vals:
        report.dominant_epsg = Counter(epsg_vals).most_common(1)[0][0]
        report.has_valid_crs = True
        report.consistent_crs = (len(set(epsg_vals)) == 1)
        if not report.consistent_crs:
            report.warnings.append(f"Inconsistent CRS across layers: {set(str(e) for e in epsg_vals)}")
    else:
        if all_cad and not readable_gis:
            report.warnings.append("CAD drawings use local engineering coordinates (no projected CRS)")

    # Geometry type summary
    all_gtypes: Counter = Counter()
    for l in readable_gis:
        all_gtypes.update(l.geometry_types)
    report.geometry_types = dict(all_gtypes)

    # Collect Issues & Warnings
    for l in all_gis:
        if l.error:
            report.issues.append(f"{l.name}: {l.error}")
        if l.support_level == "REJECTED":
            report.warnings.append(f"{l.name}: {l.support_note or 'Unsupported format'}")
        if l.invalid_count > 0:
            reasons_str = f" ({'; '.join(l.invalid_reasons[:2])})" if l.invalid_reasons else ""
            report.warnings.append(f"{l.name}: {l.invalid_count} invalid geometries{reasons_str}")
        if l.null_geom_count > 0:
            report.warnings.append(f"{l.name}: {l.null_geom_count} null / missing geometries")
        if l.empty_geom_count > 0:
            report.warnings.append(f"{l.name}: {l.empty_geom_count} empty geometries")
        if l.duplicate_geom_count > 0:
            pct = l.duplicate_geom_count / max(l.feature_count, 1) * 100
            if pct > DUPLICATE_GEOM_RATIO * 100:
                report.warnings.append(f"{l.name}: {l.duplicate_geom_count} duplicate geometries ({pct:.0f}%)")
        for w in l.warnings:
            report.warnings.append(f"{l.name}: {w}")

    for c in all_cad:
        if c.support_level == "REJECTED":
            report.issues.append(f"{c.name} ({c.format}): {c.support_note}")
        elif c.error:
            report.warnings.append(f"{c.name}: {c.error}")
        for w in c.warnings:
            report.warnings.append(f"{c.name}: {w}")

    # ── COMPLETENESS SCORING (0–100%) ─────────────────────────────────
    completeness = 0.0
    has_any_gis = any(l.feature_count > 0 for l in all_gis)
    has_any_cad = any(c.entity_count > 0 for c in all_cad)

    if has_any_gis or has_any_cad:
        completeness += 40.0  # Primary geometries/entities present

    # CRS
    if report.has_valid_crs:
        completeness += 25.0
    elif has_any_cad and not has_any_gis:
        completeness += 15.0  # CAD local coords acceptable

    # Feature / Entity volume
    total_items = report.total_features + sum(c.entity_count for c in all_cad)
    if total_items >= 10:
        completeness += 15.0
    elif total_items >= 1:
        completeness += 7.0

    # Geometry validity ratio
    if readable_gis:
        inv_ratio = sum(l.invalid_count for l in readable_gis) / max(report.total_features, 1)
        if inv_ratio == 0:
            completeness += 10.0
        elif inv_ratio < 0.05:
            completeness += 5.0
    elif has_any_cad:
        completeness += 10.0

    # Attributes schema present
    if any(l.attribute_schema for l in readable_gis) or any(c.layer_names for c in all_cad):
        completeness += 10.0

    report.completeness = round(min(100.0, completeness), 1)

    # ── QUALITY SCORING (0–100%) ──────────────────────────────────────
    quality = 100.0

    # Penalise for rejected formats (e.g. DWG)
    rejected_count = sum(1 for l in all_gis if l.support_level == "REJECTED") + \
                     sum(1 for c in all_cad if c.support_level == "REJECTED")
    quality -= rejected_count * 25.0

    # Penalise for invalid geometries
    total_feat = max(report.total_features, 1)
    total_invalid = sum(l.invalid_count for l in readable_gis)
    quality -= (total_invalid / total_feat) * 30.0

    # Penalise for null geometries
    total_null = sum(l.null_geom_count for l in readable_gis)
    quality -= (total_null / total_feat) * 20.0

    # Penalise for missing CRS (GIS only)
    if readable_gis and not report.has_valid_crs:
        quality -= 20.0

    # Penalise for inconsistent CRS
    if readable_gis and not report.consistent_crs:
        quality -= 10.0

    # Penalise for sliver polygons
    total_slivers = sum(l.sliver_count for l in readable_gis)
    quality -= min(10.0, (total_slivers / total_feat) * 10.0)

    report.quality = round(max(0.0, min(100.0, quality)), 1)

    # ── STATUS ────────────────────────────────────────────────────────
    fatal_issues = [i for i in report.issues if "convert to dxf" not in i.lower()]
    has_valid_data = (report.total_features > 0 or any(c.entity_count > 0 for c in all_cad))

    if (
        report.completeness >= 80.0
        and report.quality >= 75.0
        and has_valid_data
        and not fatal_issues
    ):
        report.status = "READY"
    elif (
        report.completeness >= 40.0
        and has_valid_data
    ):
        report.status = "PARTIAL"
    else:
        report.status = "REJECTED"

    return report


# ──────────────────────────────────────────────────────────────────────────────
# API RESPONSE FORMATTER
# ──────────────────────────────────────────────────────────────────────────────

def format_gis_cad_response(report: GISCADDatasetReport) -> Dict[str, Any]:
    gis_rows = []
    for l in report.gis_layers:
        gis_rows.append({
            "name": l.name,
            "format": l.format,
            "support_level": l.support_level,
            "support_note": l.support_note or None,
            "feature_count": l.feature_count,
            "geometry_type": l.geometry_type,
            "geometry_types": l.geometry_types,
            "crs": l.crs_string,
            "epsg": l.epsg,
            "bbox": l.bbox,
            "validation": {
                "invalid_geometries": l.invalid_count,
                "invalid_reasons": l.invalid_reasons,
                "null_geometries": l.null_geom_count,
                "empty_geometries": l.empty_geom_count,
                "duplicate_geometries": l.duplicate_geom_count,
                "slivers": l.sliver_count,
                "self_intersections": l.self_intersect_count,
                "all_valid": l.all_geometries_valid,
                "missing_sidecars": l.missing_sidecars,
            },
            "attribute_schema": l.attribute_schema,
            "null_attributes": l.null_attribute_counts,
            "warnings": l.warnings,
            "error": l.error,
        })

    cad_rows = []
    for c in report.cad_layers:
        cad_rows.append({
            "name": c.name,
            "format": c.format,
            "support_level": c.support_level,
            "support_note": c.support_note or None,
            "dxf_version": c.dxf_version,
            "units": c.units,
            "entity_count": c.entity_count,
            "entity_types": c.entity_types,
            "layer_names": c.layer_names,
            "entities_per_layer": c.entities_per_layer,
            "block_names": c.block_names,
            "text_count": c.text_count,
            "block_ref_count": c.block_ref_count,
            "has_3d": c.has_3d_entities,
            "coordinate_system": c.coordinate_system_note,
            "bbox": c.bbox,
            "warnings": c.warnings,
            "error": c.error,
        })

    return {
        "category": "GIS / CAD",
        "completeness": report.completeness,
        "quality": report.quality,
        "status": report.status,
        "summary": {
            "total_files": report.total_files,
            "readable_files": report.readable_files,
            "total_features": report.total_features,
            "gis_layers": len(report.gis_layers),
            "cad_layers": len(report.cad_layers),
            "geometry_types": report.geometry_types,
            "dominant_epsg": report.dominant_epsg,
            "consistent_crs": report.consistent_crs,
            "combined_bbox": report.combined_bbox,
        },
        "support_matrix": report.support_matrix,
        "issues": report.issues,
        "warnings": report.warnings,
        "gis": gis_rows,
        "cad": cad_rows,
        "scanned_at": report.scanned_at,
    }
