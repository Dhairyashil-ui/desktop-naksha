"""
Fast photogrammetry scan for PPCRC building images.
Uses EXIF-only parse + lightweight blur detection (no full rasterio decode per image).
Blur is estimated from JPEG quantization table entropy — fast and no GPU needed.
"""
import sys, io, os, struct, math, hashlib, json, itertools
sys.path.insert(0, 'd:/surveynaksha')

from pathlib import Path
from collections import Counter
from backend.photogrammetry_scanner import (
    parse_exif, compute_exposure_value, DHASH_THRESHOLD,
    _haversine_m, estimate_overlap, convex_hull_area_m2,
    ImageCheck, PhotogrammetryReport,
    MIN_IMAGES_PARTIAL, MIN_IMAGES_READY, MIN_OVERLAP_READY,
    BLUR_THRESHOLD,
)
import numpy as np

# ── Fast blur estimate from JPEG quantization table (no full decode) ──────────
def fast_blur_from_jpeg(data: bytes) -> float:
    """
    Estimate sharpness from JPEG quantization tables (DQT markers).
    Higher sum of AC coefficients in luma table = sharper / less compressed.
    Falls back to file-size proxy if no DQT found.
    Fast: only reads first 4KB of JPEG.
    """
    # Scan for DQT marker (0xFFDB)
    head = data[:4096]
    idx = 2
    while idx < len(head) - 4:
        if head[idx] == 0xFF and head[idx+1] == 0xDB:
            length = struct.unpack(">H", head[idx+2:idx+4])[0]
            tbl_start = idx + 4
            tbl_end = min(idx + 2 + length, len(head))
            tbl = head[tbl_start+1:tbl_end]  # skip precision/id byte
            if len(tbl) >= 64:
                # Sum AC coefficients (indices 1-63 in zigzag order)
                ac_sum = sum(tbl[1:64])
                # High ac_sum → high quantization → more lossy/blurry
                # Low ac_sum  → fine detail preserved → sharp
                # Invert: score = 10000 / ac_sum
                return 10000.0 / max(ac_sum, 1)
            break
        elif head[idx] == 0xFF:
            if idx + 3 < len(head):
                ln = struct.unpack(">H", head[idx+2:idx+4])[0]
                idx += 2 + ln
            else:
                break
        else:
            idx += 1
    # Fallback: file size / 10 as proxy (larger JPEG = more detail = sharper)
    return len(data) / 10000.0


def fast_dhash(data: bytes, hash_size: int = 8) -> str | None:
    """dHash via rasterio thumbnail decode — skipped here for speed."""
    return None  # will fill for sample images only


def scan_image_fast(path: Path) -> ImageCheck:
    chk = ImageCheck(filename=path.name, path=str(path))
    try:
        chk.size_bytes = path.stat().st_size
        raw = path.read_bytes()
        ext = path.suffix.lower()

        # 1. Readability
        if ext in ('.jpg', '.jpeg'):
            if raw[:3] != b'\xff\xd8\xff':
                chk.error = "Invalid JPEG magic"
                return chk
            chk.format = "JPEG"
        else:
            chk.error = f"Unsupported: {ext}"
            return chk
        chk.readable = True

        # 2. Dimensions from JPEG SOF marker
        idx = 2
        while idx < min(len(raw), 65536) - 9:
            if raw[idx] == 0xFF:
                m = raw[idx+1]
                if m in (0xC0, 0xC1, 0xC2, 0xC3):
                    h, w, ch = struct.unpack(">HHB", raw[idx+5:idx+10])
                    chk.width, chk.height, chk.channels = w, h, ch
                    break
                else:
                    ln = struct.unpack(">H", raw[idx+2:idx+4])[0]
                    idx += 2 + ln
            else:
                idx += 1
        if chk.width and chk.height:
            chk.megapixels = round(chk.width * chk.height / 1_000_000, 2)

        # 3+4. EXIF + Camera
        exif = parse_exif(raw)
        if exif:
            chk.has_exif = True
            chk.exif_tags = {k: v for k, v in exif.items() if not k.startswith('_')}
            chk.camera_make  = exif.get('Make')
            chk.camera_model = exif.get('Model')
            fl = exif.get('FocalLength')
            if isinstance(fl, list): fl = fl[0]
            chk.focal_length_mm = float(fl) if fl else None
            fn = exif.get('FNumber')
            if isinstance(fn, list): fn = fn[0]
            chk.f_number = float(fn) if fn else None

            # 5. GPS
            if 'gps_lat' in exif and 'gps_lon' in exif:
                chk.has_gps = True
                chk.gps_lat = exif['gps_lat']
                chk.gps_lon = exif['gps_lon']
                chk.gps_alt = exif.get('gps_alt')
                chk.gps_direction = exif.get('gps_direction')

            # 7. Exposure
            iso = exif.get('ISOSpeedRatings')
            if isinstance(iso, list): iso = iso[0]
            chk.iso = int(iso) if iso else None
            shutter = exif.get('ExposureTime')
            if isinstance(shutter, list): shutter = shutter[0]
            chk.shutter_speed = float(shutter) if shutter else None
            ev, ok, _ = compute_exposure_value(exif)
            chk.exposure_value = ev
            chk.exposure_ok = ok

        # 6. Blur (fast — JPEG quantization table)
        chk.blur_score = fast_blur_from_jpeg(raw)
        chk.is_blurry  = (chk.blur_score < BLUR_THRESHOLD)

        # 8. SHA256
        chk.sha256 = hashlib.sha256(raw).hexdigest()

    except Exception as e:
        chk.error = str(e)
        chk.readable = False
    return chk


# ── Main scan ─────────────────────────────────────────────────────────────────
input_dir = Path('d:/surveynaksha/input')
image_paths = sorted(input_dir.glob('*.jpg'))
n_total = len(image_paths)
print(f"Scanning {n_total} JPEG images from input/ ...\n")

checks = []
for i, p in enumerate(image_paths, 1):
    chk = scan_image_fast(p)
    checks.append(chk)
    print(f"  [{i:3d}/{n_total}] {chk.filename:<40} "
          f"{'OK' if chk.readable else 'ERR'} "
          f"{chk.width}x{chk.height}  "
          f"EXIF={'Y' if chk.has_exif else 'N'}  "
          f"GPS={'Y' if chk.has_gps else 'N'}  "
          f"EV={f'{chk.exposure_value:.1f}' if chk.exposure_value else 'N/A':>5}  "
          f"blur={f'{chk.blur_score:.0f}' if chk.blur_score else 'N/A':>7}  "
          f"{'BLURRY' if chk.is_blurry else 'sharp'}")

# ── Aggregate ─────────────────────────────────────────────────────────────────
readable   = [c for c in checks if c.readable]
with_exif  = [c for c in readable if c.has_exif]
with_gps   = [c for c in readable if c.has_gps]
with_cam   = [c for c in readable if c.camera_make or c.camera_model]
blurry     = [c for c in readable if c.is_blurry]
overexp    = [c for c in readable if c.exposure_value and c.exposure_value > 18]
underexp   = [c for c in readable if c.exposure_value and c.exposure_value < 10]

# Camera
camera_ids = [f"{c.camera_make or ''}|{c.camera_model or ''}" for c in with_cam]
dominant_camera = None
mixed_cameras   = False
if camera_ids:
    top = Counter(camera_ids).most_common(1)[0][0]
    make, model = top.split('|', 1)
    dominant_camera = f"{make} {model}".strip()
    mixed_cameras = len(set(camera_ids)) > 1

# Duplicate detection (SHA256-based — exact dupes)
sha_counts = Counter(c.sha256 for c in readable if c.sha256)
exact_dups = sum(v - 1 for v in sha_counts.values() if v > 1)

# GPS positions + coverage
positions = [(c.gps_lat, c.gps_lon, c.gps_alt or 0.0)
             for c in with_gps if c.gps_lat is not None]
coverage_m2 = 0.0
overlap_pct = 0.0
if len(positions) >= 3:
    coverage_m2 = convex_hull_area_m2(positions)
if len(positions) >= 2:
    fl_vals = [c.focal_length_mm for c in readable if c.focal_length_mm]
    avg_fl = float(np.mean(fl_vals)) if fl_vals else 25.0
    avg_w  = int(np.mean([c.width  for c in readable if c.width])  or 4000)
    avg_h  = int(np.mean([c.height for c in readable if c.height]) or 3000)
    overlap_pct = estimate_overlap(positions, avg_fl, avg_w, avg_h) * 100

# ── Scoring ───────────────────────────────────────────────────────────────────
n = len(readable)
gps_ratio  = len(with_gps)  / max(n, 1)
exif_ratio = len(with_exif) / max(n, 1)

completeness = 0.0
if n >= MIN_IMAGES_READY:    completeness += 50.0
elif n >= MIN_IMAGES_PARTIAL: completeness += 25.0
completeness += min(20.0, gps_ratio  * 20.0)
completeness += min(15.0, exif_ratio * 15.0)
overlap_feasible = overlap_pct >= (MIN_OVERLAP_READY * 100)
if overlap_feasible:         completeness += 10.0
elif overlap_pct > 0:        completeness += 5.0
if dominant_camera:          completeness += 5.0
completeness = round(min(100.0, completeness), 1)

quality = 100.0
quality -= ((n - len(readable)) / max(n_total, 1)) * 30.0
quality -= (len(blurry) / max(n, 1)) * 20.0
quality -= ((len(overexp) + len(underexp)) / max(n, 1)) * 15.0
quality -= (exact_dups / max(n, 1)) * 10.0
if mixed_cameras: quality -= 5.0
quality += gps_ratio * 5.0
quality = round(max(0.0, min(100.0, quality)), 1)

if completeness >= 80.0 and quality >= 75.0 and n >= MIN_IMAGES_READY:
    status = "READY"
elif completeness >= 40.0 and n >= MIN_IMAGES_PARTIAL:
    status = "PARTIAL"
else:
    status = "REJECTED"

# ── Print report ──────────────────────────────────────────────────────────────
SEP  = "=" * 66
THIN = "-" * 66

print()
print(SEP)
print("  PHOTOGRAMMETRY SCANNER  --  PPCRC Building Dataset")
print(SEP)
print(f"  Total images      : {n_total}")
print(f"  Readable          : {len(readable)}  ({len(readable)/max(n_total,1)*100:.0f}%)")
print(f"  With EXIF         : {len(with_exif)}")
print(f"  With GPS          : {len(with_gps)}")
print(f"  Dominant camera   : {dominant_camera or 'Unknown'}")
print(f"  Mixed cameras     : {mixed_cameras}")
print()
print("  --- Quality Indicators ---")
print(f"  Blurry images     : {len(blurry)}"
      f"  ({len(blurry)/max(n,1)*100:.0f}%)")
print(f"  Exact duplicates  : {exact_dups}")
print(f"  Overexposed       : {len(overexp)}")
print(f"  Underexposed      : {len(underexp)}")
print()
print("  --- Spatial Coverage ---")
print(f"  GPS positions     : {len(positions)}")
if coverage_m2 > 0:
    print(f"  Coverage area     : {coverage_m2:.1f} m2  ({coverage_m2/10000:.4f} ha)")
else:
    print(f"  Coverage area     : N/A (no GPS)")
print(f"  Overlap estimate  : {overlap_pct:.1f}%")
print()
print("  --- SCORES ---")
print(f"  Completeness      : {completeness:.1f}%")
print(f"  Quality           : {quality:.1f}%")
print(f"  STATUS            : {status}")

# Issues + warnings
issues, warnings = [], []
if n < MIN_IMAGES_PARTIAL:
    issues.append(f"Only {n} readable images (min {MIN_IMAGES_PARTIAL} required)")
blur_pct = len(blurry) / max(n, 1)
if blur_pct > 0.3:
    issues.append(f"{len(blurry)} blurry images ({blur_pct*100:.0f}%) exceeds 30% threshold")
elif len(blurry) > 0:
    warnings.append(f"{len(blurry)} blurry images detected ({blur_pct*100:.0f}%)")
if len(overexp) > 0: warnings.append(f"{len(overexp)} overexposed images")
if len(underexp) > 0: warnings.append(f"{len(underexp)} underexposed images")
if exact_dups > 0:   warnings.append(f"{exact_dups} exact duplicate images")
if mixed_cameras:    warnings.append(f"Mixed cameras detected")
if not with_gps:     issues.append("No GPS data found — overlap/coverage unavailable")

print()
if issues:
    print("  ISSUES:")
    for i in issues: print(f"    [!] {i}")
if warnings:
    print("  WARNINGS:")
    for w in warnings: print(f"    [-] {w}")

# Camera breakdown
if camera_ids:
    print()
    print("  --- Camera Models Found ---")
    for cam, cnt in Counter(camera_ids).most_common():
        make, model = cam.split('|', 1)
        print(f"    {(make + ' ' + model).strip():<40} : {cnt} images")

# EV distribution
evs = [c.exposure_value for c in readable if c.exposure_value]
if evs:
    print()
    print("  --- Exposure Distribution ---")
    buckets = {'Under (<10 EV)': 0, 'Good (10-18 EV)': 0, 'Over (>18 EV)': 0}
    for ev in evs:
        if ev < 10: buckets['Under (<10 EV)'] += 1
        elif ev > 18: buckets['Over (>18 EV)'] += 1
        else: buckets['Good (10-18 EV)'] += 1
    for k, v in buckets.items():
        bar = '#' * (v // 2)
        print(f"    {k:<18} : {v:3d}  {bar}")
    print(f"    EV range: {min(evs):.1f} - {max(evs):.1f}  (mean {sum(evs)/len(evs):.1f})")

print()
print(SEP)
print(f"  FINAL RESULT")
print(f"  STATUS        : {status}")
print(f"  Completeness  : {completeness:.1f}%")
print(f"  Quality       : {quality:.1f}%")
print(SEP)
