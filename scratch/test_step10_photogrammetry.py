"""
Integration test for Step 10 — Real Photogrammetry Scanner.

Creates synthetic JPEG images with embedded EXIF (including GPS),
runs the full photogrammetry scanner, and verifies real non-fake scores.
"""
import sys
import os
import io
import struct
import math
import tempfile
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
os.environ.setdefault("PYTHONPATH", str(Path(__file__).parents[1]))

# ─── Minimal JPEG with EXIF builder ───────────────────────────────────────────

def make_rational(n: int, d: int) -> bytes:
    return struct.pack("<II", n, d)

def make_gps_dms(decimal: float) -> bytes:
    """Encode decimal degrees as 3 rationals (deg, min, sec)."""
    deg = int(abs(decimal))
    mn = int((abs(decimal) - deg) * 60)
    sec = ((abs(decimal) - deg) * 60 - mn) * 60
    sec_num = int(sec * 1000)
    return make_rational(deg, 1) + make_rational(mn, 1) + make_rational(sec_num, 1000)


def build_ifd_entry(tag: int, type_: int, count: int, value_or_offset: bytes) -> bytes:
    """One 12-byte IFD entry."""
    return struct.pack("<HHI", tag, type_, count) + value_or_offset


def build_minimal_exif(
    camera_make: str = "DJI",
    camera_model: str = "Phantom 4 Pro",
    focal_mm: float = 8.8,
    f_number: float = 2.8,
    shutter: float = 1 / 800,
    iso: int = 100,
    gps_lat: float = 20.5,
    gps_lon: float = 77.5,
    gps_alt: float = 120.0,
    img_w: int = 4000,
    img_h: int = 3000,
) -> bytes:
    """
    Build a real EXIF APP1 block (TIFF IFD structure).
    This produces bytes that parse_exif() can read.
    """
    endian = b"II"  # little-endian TIFF
    E = "<"

    # All variable-length data goes into a heap buffer
    heap = bytearray()
    heap_base = 0  # will be fixed up after IFD size is known

    def heap_put(data: bytes) -> int:
        """Append data to heap, return offset relative to TIFF start."""
        nonlocal heap_base
        off = heap_base + len(heap)
        heap.extend(data)
        return off

    # Encode strings
    make_bytes  = (camera_make.encode("ascii") + b"\x00")
    model_bytes = (camera_model.encode("ascii") + b"\x00")

    # Rational values (8 bytes each)
    fl_rational    = make_rational(int(focal_mm * 10), 10)   # focal length
    fn_rational    = make_rational(int(f_number * 10), 10)   # f-number
    # shutter as rational: e.g. 1/800 → numerator=1, denominator=800
    shutter_num = 1
    shutter_den = int(round(1.0 / shutter))
    shutter_rational = make_rational(shutter_num, shutter_den)

    # GPS data (3 rationals = 24 bytes for lat/lon)
    lat_dms = make_gps_dms(gps_lat)
    lon_dms = make_gps_dms(gps_lon)
    alt_rational = make_rational(int(gps_alt * 100), 100)

    # ─── GPS IFD ─────────────────────────────────────────────────────
    # GPS entries:
    # 0x0001 GPSLatitudeRef  ASCII "N\0"  (type 2, count 2)
    # 0x0002 GPSLatitude     RATIONAL×3  (type 5, count 3)
    # 0x0003 GPSLongitudeRef ASCII "E\0"  (type 2, count 2)
    # 0x0004 GPSLongitude    RATIONAL×3  (type 5, count 3)
    # 0x0005 GPSAltitudeRef  BYTE×1      (type 1, count 1) — 0 = above sea level
    # 0x0006 GPSAltitude     RATIONAL×1  (type 5, count 1)

    # We'll build GPS IFD as a standalone block and record its TIFF offset
    gps_ifd_entries = []

    # LatRef "N\0"  — fits in 4-byte value field
    gps_ifd_entries.append((0x0001, 2, 2, b"N\x00\x00\x00"))

    # Lat 3 rationals (24 bytes) — goes to heap
    # LonRef "E\0"
    gps_ifd_entries.append((0x0003, 2, 2, b"E\x00\x00\x00"))

    # AltRef  — 0 byte — fits in value field
    gps_ifd_entries.append((0x0005, 1, 1, b"\x00\x00\x00\x00"))

    # For lat/lon/alt we need heap offsets; we'll fix them up after computing IFD size
    # GPS IFD size: 2 (num_entries) + 6*12 (entries) + 4 (next IFD = 0)
    gps_num = 6
    gps_ifd_size = 2 + gps_num * 12 + 4

    # Main IFD0 entries (we'll inline small values, heap-offset large ones)
    # We need to fix up heap_base = offset from TIFF start to where heap begins
    # TIFF header = 8 bytes
    # IFD0 size: 2 + N*12 + 4   (N = number of entries in IFD0)
    ifd0_tags = [
        0x010F,  # Make
        0x0110,  # Model
        0x8769,  # ExifIFD ptr
        0x8825,  # GPSIFD ptr
    ]
    ifd0_num = len(ifd0_tags)
    ifd0_size = 2 + ifd0_num * 12 + 4

    # ExifIFD entries:
    exif_tags = [
        0x9003,  # DateTimeOriginal
        0x920A,  # FocalLength
        0x829D,  # FNumber
        0x829A,  # ExposureTime
        0x8827,  # ISOSpeedRatings
        0xA002,  # PixelXDimension
        0xA003,  # PixelYDimension
    ]
    exif_num = len(exif_tags)
    exif_ifd_size = 2 + exif_num * 12 + 4

    # Compute offsets from TIFF start (offset 0):
    tiff_hdr_size = 8
    # IFD0 starts at offset 8 (immediately after TIFF header)
    ifd0_off = tiff_hdr_size
    # ExifIFD starts after IFD0
    exif_ifd_off = ifd0_off + ifd0_size
    # GPS IFD starts after ExifIFD
    gps_ifd_off = exif_ifd_off + exif_ifd_size
    # Heap (variable data) starts after GPS IFD
    heap_base = gps_ifd_off + gps_ifd_size

    # ─ Place variable data into heap ─
    make_off  = heap_put(make_bytes)
    model_off = heap_put(model_bytes)
    dt_str    = b"2024:01:15 10:30:00\x00"
    dt_off    = heap_put(dt_str)
    fl_off    = heap_put(fl_rational)
    fn_off    = heap_put(fn_rational)
    sh_off    = heap_put(shutter_rational)
    lat_off   = heap_put(lat_dms)
    lon_off   = heap_put(lon_dms)
    alt_off   = heap_put(alt_rational)

    # ─── Build ExifIFD ────────────────────────────────────────────────
    exif_ifd = bytearray()
    exif_ifd += struct.pack(E + "H", exif_num)

    def entry(tag, type_, count, val_bytes):
        """val_bytes is the 4-byte value field."""
        return struct.pack(E + "HHI", tag, type_, count) + val_bytes

    exif_ifd += entry(0x9003, 2, len(dt_str), struct.pack(E + "I", dt_off))           # DateTimeOriginal
    exif_ifd += entry(0x920A, 5, 1, struct.pack(E + "I", fl_off))                      # FocalLength
    exif_ifd += entry(0x829D, 5, 1, struct.pack(E + "I", fn_off))                      # FNumber
    exif_ifd += entry(0x829A, 5, 1, struct.pack(E + "I", sh_off))                      # ExposureTime
    exif_ifd += entry(0x8827, 3, 1, struct.pack(E + "HH", iso, 0))                     # ISOSpeedRatings
    exif_ifd += entry(0xA002, 4, 1, struct.pack(E + "I", img_w))                       # PixelXDimension
    exif_ifd += entry(0xA003, 4, 1, struct.pack(E + "I", img_h))                       # PixelYDimension
    exif_ifd += struct.pack(E + "I", 0)   # next IFD = 0

    # ─── Build GPS IFD ────────────────────────────────────────────────
    gps_ifd = bytearray()
    gps_ifd += struct.pack(E + "H", gps_num)
    gps_ifd += entry(0x0001, 2, 2, b"N\x00\x00\x00")
    gps_ifd += entry(0x0002, 5, 3, struct.pack(E + "I", lat_off))
    gps_ifd += entry(0x0003, 2, 2, b"E\x00\x00\x00")
    gps_ifd += entry(0x0004, 5, 3, struct.pack(E + "I", lon_off))
    gps_ifd += entry(0x0005, 1, 1, b"\x00\x00\x00\x00")
    gps_ifd += entry(0x0006, 5, 1, struct.pack(E + "I", alt_off))
    gps_ifd += struct.pack(E + "I", 0)

    # ─── Build IFD0 ───────────────────────────────────────────────────
    ifd0 = bytearray()
    ifd0 += struct.pack(E + "H", ifd0_num)
    ifd0 += entry(0x010F, 2, len(make_bytes), struct.pack(E + "I", make_off))
    ifd0 += entry(0x0110, 2, len(model_bytes), struct.pack(E + "I", model_off))
    ifd0 += entry(0x8769, 4, 1, struct.pack(E + "I", exif_ifd_off))
    ifd0 += entry(0x8825, 4, 1, struct.pack(E + "I", gps_ifd_off))
    ifd0 += struct.pack(E + "I", 0)   # next IFD = 0

    # ─── TIFF header ──────────────────────────────────────────────────
    tiff_hdr  = endian
    tiff_hdr += struct.pack(E + "H", 42)       # TIFF magic
    tiff_hdr += struct.pack(E + "I", ifd0_off) # offset to IFD0

    tiff_block = tiff_hdr + bytes(ifd0) + bytes(exif_ifd) + bytes(gps_ifd) + bytes(heap)

    # ─── Wrap in JFIF/EXIF APP1 ───────────────────────────────────────
    app1_data = b"Exif\x00\x00" + tiff_block
    app1_len  = len(app1_data) + 2
    app1      = b"\xff\xe1" + struct.pack(">H", app1_len) + app1_data

    # SOF0 marker: defines 4000×3000, 3 channels
    sof0 = b"\xff\xc0" + struct.pack(">HBHH", 17, 8, img_h, img_w) + b"\x03\x01\x11\x00\x02\x11\x01\x03\x11\x01"

    # Minimal JPEG: SOI + APP1 + SOF0 + EOI
    jpeg = b"\xff\xd8" + app1 + sof0 + b"\xff\xd9"
    return jpeg


def create_test_images(tmpdir: Path, n: int = 5, blur_one: bool = True) -> list:
    """Create n JPEG images with slightly different GPS positions."""
    paths = []
    base_lat, base_lon = 20.50, 77.50

    for i in range(n):
        lat = base_lat + i * 0.001   # ~111m spacing
        lon = base_lon + i * 0.0005
        alt = 120.0

        jpeg_data = build_minimal_exif(
            camera_make="DJI",
            camera_model="Phantom 4 Pro",
            focal_mm=8.8,
            f_number=2.8,
            shutter=1/800 if not (blur_one and i == n - 1) else 1/20,  # last image = slow shutter
            iso=100,
            gps_lat=lat,
            gps_lon=lon,
            gps_alt=alt,
            img_w=4000,
            img_h=3000,
        )

        p = tmpdir / f"IMG_{i+1:04d}.jpg"
        p.write_bytes(jpeg_data)
        paths.append(p)

    return paths


# ─── TEST RUNNER ──────────────────────────────────────────────────────────────

def test_photogrammetry_scanner():
    """Run the scanner on synthetic images and check all fields."""
    from backend.photogrammetry_scanner import (
        scan_photogrammetry_dataset,
        format_photogrammetry_response,
        scan_single_image,
        parse_exif,
    )

    print("\n" + "=" * 60)
    print("  STEP 10 — Real Photogrammetry Scanner Integration Test")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        n_imgs = 10
        image_paths = create_test_images(tmp, n=n_imgs, blur_one=True)

        print(f"\n[Setup] Created {len(image_paths)} synthetic JPEG images in {tmpdir}")

        # ── Test parse_exif on first image ────────────────────────────
        print("\n[Test 1] EXIF parser on IMG_0001.jpg")
        raw = image_paths[0].read_bytes()
        exif = parse_exif(raw)
        print(f"  Make:         {exif.get('Make')}")
        print(f"  Model:        {exif.get('Model')}")
        print(f"  FocalLength:  {exif.get('FocalLength')}")
        print(f"  FNumber:      {exif.get('FNumber')}")
        print(f"  ExposureTime: {exif.get('ExposureTime')}")
        print(f"  ISO:          {exif.get('ISOSpeedRatings')}")
        print(f"  GPS lat:      {exif.get('gps_lat')}")
        print(f"  GPS lon:      {exif.get('gps_lon')}")
        print(f"  GPS alt:      {exif.get('gps_alt')}")

        assert exif.get("Make") == "DJI", f"Expected DJI, got {exif.get('Make')}"
        assert exif.get("gps_lat") is not None, "GPS lat should be present"
        assert abs(exif.get("gps_lat", 0) - 20.50) < 0.01, f"lat off: {exif.get('gps_lat')}"
        print("  [OK] EXIF parsed correctly")

        # ── Test scan_single_image ─────────────────────────────────────
        print("\n[Test 2] scan_single_image on IMG_0001.jpg")
        chk = scan_single_image(image_paths[0])
        print(f"  Readable:    {chk.readable}")
        print(f"  Format:      {chk.format}")
        print(f"  Dimensions:  {chk.width}×{chk.height}")
        print(f"  Megapixels:  {chk.megapixels}")
        print(f"  Has EXIF:    {chk.has_exif}")
        print(f"  Has GPS:     {chk.has_gps}")
        print(f"  Camera:      {chk.camera_make} {chk.camera_model}")
        print(f"  Focal:       {chk.focal_length_mm} mm")
        print(f"  ISO:         {chk.iso}")
        print(f"  Shutter:     {chk.shutter_speed}")
        print(f"  EV:          {chk.exposure_value}")
        print(f"  Blur score:  {chk.blur_score}")
        print(f"  dHash:       {chk.dhash}")
        print(f"  GPS lat:     {chk.gps_lat}")
        print(f"  GPS lon:     {chk.gps_lon}")

        assert chk.readable, f"Image should be readable: {chk.error}"
        assert chk.width == 4000 or chk.width > 0, f"Width not detected: {chk.width}"
        assert chk.has_exif, "EXIF should be present"
        assert chk.has_gps, "GPS should be present"
        assert chk.camera_make == "DJI", f"Camera make: {chk.camera_make}"
        assert chk.gps_lat is not None
        assert chk.dhash is not None
        assert chk.sha256 is not None
        print("  [OK] Single image scan passed")

        # ── Test full dataset scan ─────────────────────────────────────
        print(f"\n[Test 3] scan_photogrammetry_dataset ({n_imgs} images)")
        report = scan_photogrammetry_dataset(
            dataset_id="test-dataset-001",
            project_id="test-project-001",
            image_paths=image_paths,
        )

        print(f"\n  ── RESULTS ───────────────────────────────────")
        print(f"  Category:        Photogrammetry")
        print(f"  Total images:    {report.total_images}")
        print(f"  Readable images: {report.readable_images}")
        print(f"  With EXIF:       {report.images_with_exif}")
        print(f"  With GPS:        {report.images_with_gps}")
        print(f"  Blurry:          {report.blurry_count}")
        print(f"  Duplicates:      {report.duplicate_count}")
        print(f"  Overexposed:     {report.overexposed_count}")
        print(f"  Underexposed:    {report.underexposed_count}")
        print(f"  Dominant camera: {report.dominant_camera}")
        print(f"  Mixed cameras:   {report.mixed_cameras}")
        print(f"  Overlap est:     {report.estimated_overlap_pct:.1f}%")
        print(f"  Coverage area:   {report.coverage_area_m2:.1f} m²")
        print(f"  ── SCORES ────────────────────────────────────")
        print(f"  Completeness:    {report.completeness:.1f}%")
        print(f"  Quality:         {report.quality:.1f}%")
        print(f"  Status:          {report.status}")
        if report.issues:
            print(f"  Issues:          {report.issues}")
        if report.warnings:
            print(f"  Warnings:        {report.warnings}")

        # Assertions — no fake values
        assert report.readable_images == n_imgs, f"All {n_imgs} should be readable"
        assert report.images_with_exif == n_imgs, "All should have EXIF"
        assert report.images_with_gps == n_imgs, "All should have GPS"
        assert report.dominant_camera is not None
        assert "DJI" in report.dominant_camera or "Phantom" in report.dominant_camera
        assert report.completeness > 0, "Completeness must be > 0"
        assert report.quality > 0, "Quality must be > 0"
        assert report.completeness <= 100, "Completeness <= 100"
        assert report.quality <= 100, "Quality <= 100"
        assert report.status in ("READY", "PARTIAL", "REJECTED")
        # GPS positions collected
        assert len(report.gps_positions) == n_imgs
        assert report.coverage_area_m2 > 0
        print("  [OK] All assertions passed")

        # ── Test format_photogrammetry_response ───────────────────────
        print("\n[Test 4] format_photogrammetry_response()")
        resp = format_photogrammetry_response(report)
        assert resp["category"] == "Photogrammetry"
        assert "completeness" in resp
        assert "quality" in resp
        assert "status" in resp
        assert "images" in resp
        assert len(resp["images"]) == n_imgs
        # Verify each image row has expected fields
        for img_row in resp["images"]:
            assert "filename" in img_row
            assert "readable" in img_row
            assert "dimensions" in img_row
            assert "has_gps" in img_row
        print("  [OK] Response format correct")

        print(f"\n{'=' * 60}")
        print(f"  STEP 10 PASSED")
        print(f"  Photogrammetry:  {report.completeness:.1f}% complete  |  {report.quality:.1f}% quality  |  {report.status}")
        print(f"{'=' * 60}\n")

        return report


if __name__ == "__main__":
    test_photogrammetry_scanner()
