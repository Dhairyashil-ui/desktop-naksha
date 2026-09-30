import fiona
print("FIONA VERSION:", fiona.__version__)
print("FIONA DRIVERS:", sorted(fiona.supported_drivers.keys()))

try:
    import ezdxf
    print("EZDXF VERSION:", ezdxf.__version__)
except Exception as e:
    print("EZDXF ERROR:", e)

try:
    from osgeo import ogr, gdal
    print("GDAL VERSION:", gdal.__version__)
    ogr_drivers = [ogr.GetDriver(i).GetName() for i in range(ogr.GetDriverCount())]
    print("OGR DRIVERS containing CAD/DWG/DXF/DGN/KML:")
    for d in ogr_drivers:
        if any(k in d.lower() for k in ['dwg', 'dxf', 'dgn', 'kml', 'shape', 'gpkg', 'geojson']):
            print(" ", d)
except Exception as e:
    print("GDAL/OGR NOT AVAILABLE or ERROR:", e)
