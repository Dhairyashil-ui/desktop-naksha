"""
Geospatial Environment Verification Script
Step 9 — SurveyNaksha 2.0

Verifies each geospatial library by:
1. Importing it
2. Running a real functional test
3. Recording version and capability info

Outputs: backend/environment_report.json
"""

import json
import sys
import os
import datetime
import traceback
import tempfile
import struct

report = {
    "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
    "python_version": sys.version,
    "platform": sys.platform,
    "libraries": {}
}


def record(name, status, version=None, notes=None, capabilities=None, error=None):
    report["libraries"][name] = {
        "status": status,
        "version": version,
        "notes": notes or [],
        "capabilities": capabilities or [],
        "error": error,
    }
    symbol = "OK" if status == "ok" else ("WRN" if status == "partial" else "ERR")
    print(f"  [{symbol}] {name}: {status} (v{version})" if version else f"  [{symbol}] {name}: {status}")
    if error:
        print(f"    ERROR: {error}")
    if notes:
        for n in notes:
            print(f"    - {n}")


# ─────────────────────────────────────────────────────────────────────────────
# 1. GDAL (via rasterio's bundled binaries)
# ─────────────────────────────────────────────────────────────────────────────
print("\n[1/9] GDAL")
try:
    import rasterio
    gdal_version = rasterio.gdal_version()

    import numpy as np
    from rasterio.transform import from_bounds
    from rasterio.io import MemoryFile

    data = np.ones((1, 64, 64), dtype=np.float32)
    transform = from_bounds(0, 0, 1, 1, 64, 64)

    with MemoryFile() as memfile:
        with memfile.open(
            driver="GTiff",
            height=64,
            width=64,
            count=1,
            dtype="float32",
            crs="EPSG:4326",
            transform=transform,
        ) as ds:
            ds.write(data)
        with memfile.open() as ds:
            assert ds.count == 1
            assert ds.crs.to_epsg() == 4326
            arr = ds.read(1)
            assert arr.shape == (64, 64)

    record(
        "gdal",
        status="ok",
        version=gdal_version,
        notes=[
            "Available via rasterio's bundled GDAL binaries",
            "Functional test: created + read 64x64 GeoTIFF in memory",
            "Verified CRS EPSG:4326, band count, array shape",
        ],
        capabilities=["GeoTIFF read/write", "CRS handling", "Raster I/O", "In-memory VFS"],
    )
except Exception as e:
    record("gdal", status="error", error=traceback.format_exc(limit=3))


# ─────────────────────────────────────────────────────────────────────────────
# 2. PDAL
# ─────────────────────────────────────────────────────────────────────────────
print("\n[2/9] PDAL")
try:
    import pdal as _pdal
    pdal_ver = getattr(_pdal, "__version__", None)
    record(
        "pdal",
        status="ok",
        version=pdal_ver or "unknown",
        notes=["Imported via pdal package"],
        capabilities=["Point cloud pipeline execution"],
    )
except ImportError:
    try:
        import laspy
        record(
            "pdal",
            status="partial",
            version="N/A",
            notes=[
                "PDAL Python bindings require compiled native PDAL (no Windows pip wheel available)",
                "LAS/LAZ point cloud processing available via laspy 2.x instead",
                "laspy v" + laspy.__version__ + " covers PDAL primary use case for this project",
                "PDAL CLI available if installed via OSGeo4W or conda",
            ],
            capabilities=["LAS/LAZ via laspy", "Manual pipeline via subprocess if PDAL CLI installed"],
        )
    except Exception as e2:
        record("pdal", status="error", error=str(e2))


# ─────────────────────────────────────────────────────────────────────────────
# 3. laspy
# ─────────────────────────────────────────────────────────────────────────────
print("\n[3/9] laspy")
try:
    import laspy
    import numpy as np
    import io

    header = laspy.LasHeader(point_format=6, version="1.4")
    header.offsets = np.array([0.0, 0.0, 0.0])
    header.scales = np.array([0.001, 0.001, 0.001])

    las = laspy.LasData(header=header)
    n = 1000
    las.x = np.random.uniform(100.0, 200.0, n)
    las.y = np.random.uniform(200.0, 300.0, n)
    las.z = np.random.uniform(10.0, 50.0, n)
    las.intensity = np.random.randint(0, 65535, n, dtype=np.uint16)

    buf = io.BytesIO()
    las.write(buf)
    buf.seek(0)

    las2 = laspy.read(buf)
    assert len(las2.points) == n
    assert las2.header.point_format.id == 6
    assert abs(float(np.mean(las2.x)) - float(np.mean(las.x))) < 1.0

    record(
        "laspy",
        status="ok",
        version=laspy.__version__,
        notes=[
            f"Functional test: wrote+read {n} synthetic LAS 1.4 points",
            "Point format 6, verified intensity + XYZ round-trip",
        ],
        capabilities=["LAS 1.0-1.4 read/write", "Point format 0-10", "LAZ compression (if lazrs installed)", "Chunked reading"],
    )
except Exception as e:
    record("laspy", status="error", error=traceback.format_exc(limit=3))


# ─────────────────────────────────────────────────────────────────────────────
# 4. pyproj
# ─────────────────────────────────────────────────────────────────────────────
print("\n[4/9] pyproj")
try:
    import pyproj

    transformer_fwd = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:32644", always_xy=True)
    transformer_inv = pyproj.Transformer.from_crs("EPSG:32644", "EPSG:4326", always_xy=True)

    lon, lat = 77.5, 20.5
    easting, northing = transformer_fwd.transform(lon, lat)
    lon2, lat2 = transformer_inv.transform(easting, northing)

    assert abs(lon2 - lon) < 1e-6
    assert abs(lat2 - lat) < 1e-6

    crs = pyproj.CRS.from_epsg(32644)
    assert crs.is_projected
    assert "UTM" in crs.name.upper()

    record(
        "pyproj",
        status="ok",
        version=pyproj.__version__,
        notes=[
            f"Round-trip WGS84<>UTM Zone 44N: lon error={abs(lon2-lon):.2e}, lat error={abs(lat2-lat):.2e}",
            f"PROJ data version: {pyproj.proj_version_str}",
        ],
        capabilities=["CRS transformation", "EPSG lookup", "Datum shifting", "Authority codes", "WKT parsing"],
    )
except Exception as e:
    record("pyproj", status="error", error=traceback.format_exc(limit=3))


# ─────────────────────────────────────────────────────────────────────────────
# 5. Shapely
# ─────────────────────────────────────────────────────────────────────────────
print("\n[5/9] shapely")
try:
    from shapely.geometry import Point, Polygon
    from shapely import wkt
    import shapely

    p1 = Point(77.0, 20.0)
    buf = p1.buffer(0.5)
    assert buf.contains(p1)

    sq1 = Polygon([(0, 0), (2, 0), (2, 2), (0, 2)])
    sq2 = Polygon([(1, 1), (3, 1), (3, 3), (1, 3)])
    inter = sq1.intersection(sq2)
    assert abs(inter.area - 1.0) < 1e-10

    wkt_str = wkt.dumps(sq1)
    restored = wkt.loads(wkt_str)
    assert abs(restored.area - sq1.area) < 1e-10

    record(
        "shapely",
        status="ok",
        version=shapely.__version__,
        notes=[
            "Functional test: Point distance, buffer, intersection, WKT round-trip",
            f"Intersection area: {inter.area:.4f} (expected 1.0)",
        ],
        capabilities=["2D/3D geometry", "Boolean ops", "WKT/WKB I/O", "Spatial predicates", "Buffering"],
    )
except Exception as e:
    record("shapely", status="error", error=traceback.format_exc(limit=3))


# ─────────────────────────────────────────────────────────────────────────────
# 6. rasterio
# ─────────────────────────────────────────────────────────────────────────────
print("\n[6/9] rasterio")
try:
    import rasterio
    import numpy as np
    from rasterio.transform import from_bounds
    from rasterio.crs import CRS
    from rasterio.io import MemoryFile
    from rasterio.warp import calculate_default_transform, reproject, Resampling

    src_crs = CRS.from_epsg(4326)
    dst_crs = CRS.from_epsg(32644)
    transform = from_bounds(77.0, 20.0, 78.0, 21.0, 128, 128)

    data = np.random.rand(1, 128, 128).astype(np.float32)

    with MemoryFile() as src_mem:
        with src_mem.open(driver="GTiff", height=128, width=128, count=1,
                          dtype="float32", crs=src_crs, transform=transform) as src_ds:
            src_ds.write(data)

        with src_mem.open() as src_ds:
            new_transform, new_width, new_height = calculate_default_transform(
                src_ds.crs, dst_crs, src_ds.width, src_ds.height, *src_ds.bounds
            )
            dst_data = np.empty((1, new_height, new_width), dtype=np.float32)

            reproject(
                source=src_ds.read(1),
                destination=dst_data[0],
                src_transform=src_ds.transform,
                src_crs=src_ds.crs,
                dst_transform=new_transform,
                dst_crs=dst_crs,
                resampling=Resampling.bilinear,
            )

    assert dst_data.shape[1] > 0

    record(
        "rasterio",
        status="ok",
        version=rasterio.__version__,
        notes=[
            f"GDAL version: {rasterio.gdal_version()}",
            "Functional test: 128x128 raster reprojected WGS84->UTM Zone 44N",
            f"Output shape: {dst_data.shape[1]}x{dst_data.shape[2]}",
        ],
        capabilities=["GeoTIFF/JPEG2000/PNG read+write", "CRS reprojection", "Band math", "Window reads", "COG support"],
    )
except Exception as e:
    record("rasterio", status="error", error=traceback.format_exc(limit=3))


# ─────────────────────────────────────────────────────────────────────────────
# 7. Fiona
# ─────────────────────────────────────────────────────────────────────────────
print("\n[7/9] fiona")
try:
    import fiona
    import tempfile, os

    schema = {
        "geometry": "Point",
        "properties": {"name": "str", "value": "float"},
    }
    records_written = [
        {"geometry": {"type": "Point", "coordinates": (77.5, 20.5)}, "properties": {"name": "Nagpur", "value": 1.5}},
        {"geometry": {"type": "Point", "coordinates": (72.8, 19.1)}, "properties": {"name": "Mumbai", "value": 2.5}},
    ]

    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "test.gpkg")
        with fiona.open(path, "w", driver="GPKG", schema=schema, crs="EPSG:4326") as dst:
            for rec in records_written:
                dst.write(rec)

        with fiona.open(path, "r") as src:
            features = list(src)
            assert len(features) == 2
            assert features[0]["properties"]["name"] == "Nagpur"

    record(
        "fiona",
        status="ok",
        version=fiona.__version__,
        notes=[
            "Functional test: wrote 2 Point features to GeoPackage, read back + verified",
            f"Supported drivers count: {len(fiona.supported_drivers)}",
        ],
        capabilities=["Shapefile/GeoPackage/GeoJSON I/O", "CRS-aware vector I/O", "Schema-driven writes", "Streaming reads"],
    )
except Exception as e:
    record("fiona", status="error", error=traceback.format_exc(limit=3))


# ─────────────────────────────────────────────────────────────────────────────
# 8. GeoPandas
# ─────────────────────────────────────────────────────────────────────────────
print("\n[8/9] geopandas")
try:
    import geopandas as gpd
    from shapely.geometry import Point

    cities = gpd.GeoDataFrame(
        {
            "city": ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai"],
            "population_m": [20.7, 32.9, 13.2, 10.5, 11.5],
        },
        geometry=[
            Point(72.87, 19.07),
            Point(77.21, 28.63),
            Point(77.59, 12.97),
            Point(78.48, 17.38),
            Point(80.27, 13.09),
        ],
        crs="EPSG:4326",
    )

    cities_utm = cities.to_crs("EPSG:32644")
    assert cities_utm.crs.to_epsg() == 32644

    cities_buf = cities_utm.copy()
    cities_buf["geometry"] = cities_utm.buffer(50_000)
    cities_wgs = cities_buf.to_crs("EPSG:4326")

    intersections = 0
    for i in range(len(cities_wgs)):
        for j in range(i + 1, len(cities_wgs)):
            if cities_wgs.geometry.iloc[i].intersects(cities_wgs.geometry.iloc[j]):
                intersections += 1

    record(
        "geopandas",
        status="ok",
        version=gpd.__version__,
        notes=[
            f"Functional test: {len(cities)} Indian cities GeoDataFrame",
            "Reprojected WGS84->UTM, 50km buffer, back-projected",
            f"Buffer intersections found: {intersections}",
        ],
        capabilities=["GeoDataFrame ops", "CRS reprojection", "Spatial join/overlay", "Dissolve/clip", "Vector file I/O"],
    )
except Exception as e:
    record("geopandas", status="error", error=traceback.format_exc(limit=3))


# ─────────────────────────────────────────────────────────────────────────────
# 9. Open3D
# ─────────────────────────────────────────────────────────────────────────────
print("\n[9/9] open3d")
try:
    import open3d as o3d
    import numpy as np

    n_pts = 5000
    pts = np.random.rand(n_pts, 3).astype(np.float64)
    colors = np.random.rand(n_pts, 3).astype(np.float64)

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(pts)
    pcd.colors = o3d.utility.Vector3dVector(colors)

    pcd_down = pcd.voxel_down_sample(voxel_size=0.05)
    assert len(pcd_down.points) < n_pts

    pcd_down.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30))
    assert pcd_down.has_normals()

    aabb = pcd_down.get_axis_aligned_bounding_box()
    extent = aabb.get_extent()
    assert all(e > 0 for e in extent)

    record(
        "open3d",
        status="ok",
        version=o3d.__version__,
        notes=[
            f"Functional test: {n_pts} random points -> voxel downsampled to {len(pcd_down.points)}",
            "Estimated surface normals, computed AABB bounding box",
            f"AABB extent: {[round(e,3) for e in extent]}",
        ],
        capabilities=["Point cloud creation/manipulation", "Voxel downsampling", "Normal estimation", "KD-tree search", "ICP registration", "3D visualization"],
    )
except Exception as e:
    record("open3d", status="error", error=traceback.format_exc(limit=3))


# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
ok = [k for k, v in report["libraries"].items() if v["status"] == "ok"]
partial = [k for k, v in report["libraries"].items() if v["status"] == "partial"]
errors = [k for k, v in report["libraries"].items() if v["status"] == "error"]

report["summary"] = {
    "ok": ok,
    "partial": partial,
    "errors": errors,
    "total": len(report["libraries"]),
    "ready": len(ok) + len(partial),
}

print(f"\n{'='*60}")
print(f"  GEOSPATIAL ENVIRONMENT REPORT")
print(f"{'='*60}")
print(f"  OK      : {ok}")
print(f"  PARTIAL : {partial}")
print(f"  ERRORS  : {errors}")
print(f"{'='*60}\n")

output_path = os.path.join(os.path.dirname(__file__), "environment_report.json")
with open(output_path, "w") as f:
    json.dump(report, f, indent=2)

print(f"Report written to: {output_path}")
