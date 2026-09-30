mods = ['rasterio', 'tifffile', 'PIL', 'ifcopenshell', 'openpyxl', 'pandas', 'pypdf', 'fitz', 'docx', 'xlrd', 'ezdxf']
for m in mods:
    try:
        mod = __import__(m)
        ver = getattr(mod, '__version__', 'present')
        print(f'{m}: {ver}')
    except ImportError:
        print(f'{m}: NOT INSTALLED')
