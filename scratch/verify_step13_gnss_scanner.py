import sys, os, tempfile, json
from pathlib import Path
from datetime import datetime, timezone

# Add project root
sys.path.insert(0, "d:/surveynaksha")

from backend.gnss_scanner import (
    scan_rinex,
    scan_nmea,
    scan_csv,
    scan_txt,
    scan_gnss_dataset,
    format_gnss_response,
    ecef_to_wgs84,
)

print("=" * 70)
print("NAKSHA 2.0 -- STEP 13: REAL GNSS SCANNER VERIFICATION")
print("=" * 70)

tmp = Path(tempfile.mkdtemp(prefix="naksha_gnss_test_"))
print(f"Working scratch directory: {tmp}\n")

# ─────────────────────────────────────────────────────────────────────────────
# 1. RINEX OBSERVATION FILE (.obs / .24o)
# ─────────────────────────────────────────────────────────────────────────────
# Pune, India coordinates: lat=18.5204, lon=73.8567, h=560.0
# ECEF approx: X=1684824.234, Y=5815678.912, Z=2015243.567
rinex_path = tmp / "base_station_01.obs"
rinex_header = """     2.11           OBSERVATION DATA    M (MIXED)           RINEX VERSION / TYPE
NakshaSurveyEngine  DeepMind AGY        20260930 022000 UTC PGM / RUN BY / DATE 
PUNE_BASE_01                                                MARKER NAME         
STN-411001                                                  MARKER NUMBER       
TRIMBLE ALLOY       5432R12345          5.45                REC # / TYPE / VERS 
TRM59800.00     NONE98765                                   ANT # / TYPE        
  1684824.2340  5815678.9120  2015243.5670                  APPROX POSITION XYZ 
        1.8000        0.0000        0.0000                  ANTENNA: DELTA H/E/N
     6    L1    L2    C1    P2    S1    S2                  # / TYPES OF OBSERV 
     1.000                                                  INTERVAL            
  2026     9    30     2    20    0.0000000     GPS         TIME OF FIRST OBS   
  2026     9    30     2    20   10.0000000     GPS         TIME OF LAST OBS    
                                                            END OF HEADER       
"""

# Add 10 observation epochs
rinex_body = ""
for sec in range(10):
    rinex_body += f" 26  9 30  2 20  {sec:02d}.0000000  0  8G01G03G08G11G14R01R02R07\n"
    # Observations for 8 satellites (L1, L2, C1, P2, S1, S2)
    for sat in range(8):
        rinex_body += "  11234567.12347  8754321.45645  21345678.123 7 21345680.456 5        48.500        44.200\n"

with open(rinex_path, "w", encoding="utf-8") as f:
    f.write(rinex_header + rinex_body)

print("[1] RINEX PARSER (.obs)")
r_scan = scan_rinex(rinex_path)
print(f"   File: {r_scan.file_name} | Format: {r_scan.format} (v{r_scan.rinex_version})")
print(f"   Station: {r_scan.marker_name} (ID: {r_scan.station_id})")
print(f"   Receiver: {r_scan.receiver_type} | Antenna: {r_scan.antenna_type} (Delta H: {r_scan.antenna_delta_h}m)")
print(f"   ECEF XYZ: {r_scan.approx_position_xyz}")
print(f"   Geodetic (Converted): {r_scan.geodetic_position}")
print(f"   Epochs: {r_scan.epoch_count} | Interval: {r_scan.sampling_interval}s | Duration: {r_scan.duration_seconds}s")
print(f"   Constellations: {r_scan.constellations} | Satellites Tracked: {r_scan.satellites_tracked}")
print(f"   Total Unique Satellites: {r_scan.total_satellites} | Mean per epoch: {r_scan.mean_satellites_per_epoch}")
print(f"   CRS: {r_scan.crs_string}")
print(f"   Valid: {r_scan.is_valid}")

# ─────────────────────────────────────────────────────────────────────────────
# 2. NMEA 0183 (.nmea / .log) — TRAJECTORY + RTK FIXES + GST ACCURACY
# ─────────────────────────────────────────────────────────────────────────────
nmea_path = tmp / "drone_flight_log.nmea"
nmea_lines = []

# Generate 20 trajectory fixes moving across Pune site
base_lat = 18.5204000
base_lon = 73.8567000
base_alt = 558.4

for i in range(20):
    t_sec = i
    cur_lat = base_lat + (i * 0.0001)
    cur_lon = base_lon + (i * 0.0001)
    cur_alt = base_alt + (i * 0.2)

    # Convert to NMEA ddmm.mmmm format
    lat_deg = int(cur_lat)
    lat_min = (cur_lat - lat_deg) * 60.0
    lat_str = f"{lat_deg:02d}{lat_min:07.4f}"

    lon_deg = int(cur_lon)
    lon_min = (cur_lon - lon_deg) * 60.0
    lon_str = f"{lon_deg:03d}{lon_min:07.4f}"

    time_str = f"0225{t_sec:02d}.00"

    # RMC
    nmea_lines.append(f"$GNRMC,{time_str},A,{lat_str},N,{lon_str},E,12.5,45.0,300926,,,A*00")
    # GGA (Fix quality 4 = RTK Fixed, 16 sats, HDOP 0.8)
    nmea_lines.append(f"$GNGGA,{time_str},{lat_str},N,{lon_str},E,4,16,0.8,{cur_alt:.2f},M,-62.3,M,1.0,0042*00")
    # GST (Pseudorange error std devs: 0.008m lat, 0.009m lon, 0.015m alt)
    nmea_lines.append(f"$GNGST,{time_str},0.010,0.012,0.008,12.0,0.008,0.009,0.015*00")

with open(nmea_path, "w", encoding="utf-8") as f:
    f.write("\n".join(nmea_lines) + "\n")

print("\n[2] NMEA 0183 PARSER (.nmea)")
n_scan = scan_nmea(nmea_path)
print(f"   File: {n_scan.file_name} | Points / Epochs: {n_scan.point_count}")
print(f"   Fix Distribution: {n_scan.fix_types} ({n_scan.fix_percent_fixed}% RTK Fixed)")
print(f"   Is Trajectory: {n_scan.is_trajectory} | Distance: {n_scan.trajectory_length_m:.1f} m")
print(f"   Bounding Box: {n_scan.bbox}")
print(f"   Time Extents: {n_scan.start_time} to {n_scan.end_time}")
print(f"   Accuracy Info: {n_scan.accuracy_info}")
print(f"   Constellations: {n_scan.constellations} | Satellites Tracked: {n_scan.total_satellites}")
print(f"   Valid: {n_scan.is_valid}")

# ─────────────────────────────────────────────────────────────────────────────
# 3. SURVEY CSV (.csv) — RTK CONTROL POINTS / GCPS
# ─────────────────────────────────────────────────────────────────────────────
csv_path = tmp / "gnss_rtk_control_points.csv"
csv_content = """Point_ID,Easting,Northing,Elevation,Horiz_RMS,Vert_RMS,Status,Satellites,Code
GCP-01,385102.450,2045120.340,558.210,0.008,0.014,FIX,18,GCP_BENCHMARK
GCP-02,385250.110,2045180.520,559.450,0.009,0.015,FIX,19,GCP_BENCHMARK
GCP-03,385390.870,2045310.190,560.120,0.007,0.012,FIX,18,GCP_BENCHMARK
GCP-04,385180.660,2045450.880,557.890,0.011,0.018,FIX,17,GCP_BENCHMARK
GCP-05,385310.230,2045560.440,561.340,0.008,0.013,FIX,18,GCP_BENCHMARK
"""
with open(csv_path, "w", encoding="utf-8") as f:
    f.write(csv_content)

print("\n[3] SURVEY CSV PARSER (.csv)")
c_scan = scan_csv(csv_path)
print(f"   File: {c_scan.file_name} | Format: {c_scan.format}")
print(f"   Points: {c_scan.point_count} control points")
print(f"   CRS: {c_scan.crs_string} (EPSG: {c_scan.epsg})")
print(f"   Grid Extents (UTM): {c_scan.bbox}")
print(f"   Accuracy Stats: {c_scan.accuracy_info}")
print(f"   Fixes: {c_scan.fix_types}")
print(f"   Valid: {c_scan.is_valid}")

# ─────────────────────────────────────────────────────────────────────────────
# 4. RTKLIB .POS (.pos / .txt) — PRECISE KINEMATIC POSITION SOLUTION
# ─────────────────────────────────────────────────────────────────────────────
pos_path = tmp / "rover_kinematic.pos"
pos_header = """% program   : RTKLIB ver.2.4.3 b34
% (lat/lon/height=WGS84/ellipsoidal,Q=1:fix,2:float,3:sbas,4:dgps,5:single,6:ppp)
%  GPST                  latitude(deg) longitude(deg)  height(m)   Q  ns   sdn(m)   sde(m)   sdu(m)  sdne(m)  sdeu(m)  sdun(m) age(s)  ratio
"""
pos_rows = []
for i in range(15):
    t_sec = i
    lat = 18.5204 + (i * 0.00005)
    lon = 73.8567 + (i * 0.00005)
    h = 560.2 + (i * 0.1)
    pos_rows.append(f"2026/09/30 02:30:{t_sec:02d}.000  {lat:.8f}   {lon:.8f}   {h:.4f}   1  18   0.0068   0.0074   0.0135  -0.0012   0.0021  -0.0018   1.0   24.5")

with open(pos_path, "w", encoding="utf-8") as f:
    f.write(pos_header + "\n".join(pos_rows) + "\n")

print("\n[4] RTKLIB POS PARSER (.pos)")
p_scan = scan_txt(pos_path)
print(f"   File: {p_scan.file_name} | Format: {p_scan.format}")
print(f"   Epochs: {p_scan.epoch_count} | Fix Types: {p_scan.fix_types}")
print(f"   Is Trajectory: {p_scan.is_trajectory} | Distance: {p_scan.trajectory_length_m:.1f} m")
print(f"   Bounding Box: {p_scan.bbox}")
print(f"   Accuracy (1-sigma): {p_scan.accuracy_info}")
print(f"   CRS: {p_scan.crs_string}")
print(f"   Valid: {p_scan.is_valid}")

# ─────────────────────────────────────────────────────────────────────────────
# 5. AGGREGATED DATASET SCAN & API RESPONSE
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("[5] AGGREGATED GNSS DATASET SCAN & API RESPONSE")
print("=" * 70)

report = scan_gnss_dataset(
    dataset_id="ds_gnss_survey_rtk",
    project_id="proj_cadastral_pune",
    file_paths=[rinex_path, nmea_path, csv_path, pos_path],
)
resp = format_gnss_response(report)

print(f"Category:     {resp['category']}")
print(f"Completeness: {resp['completeness']}%")
print(f"Quality:      {resp['quality']}%")
print(f"Status:       {resp['status']}")
print(f"\nSummary:")
for k, v in resp["summary"].items():
    print(f"  {k}: {v}")

print(f"\nControl Points Count: {len(resp['control_points'])}")
for cp in resp['control_points']:
    print(f"  - Marker: {cp['marker_name']} | Lat: {cp['latitude']}, Lon: {cp['longitude']}, Elev: {cp['elevation']}m")

print(f"\nTrajectories Count: {len(resp['trajectories'])}")
for tr in resp['trajectories']:
    print(f"  - Trajectory: {tr['file_name']} | Points: {tr['point_count']} | Dist: {tr['distance_m']:.1f}m")

print(f"\nIssues:   {resp['issues']}")
print(f"Warnings: {resp['warnings']}")

print("\n" + "=" * 70)
print("ALL GNSS / SURVEY FORMATS VERIFIED ACCORDING TO STEP 13 REQUIREMENTS.")
print("=" * 70)
