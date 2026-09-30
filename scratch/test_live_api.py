import sys
sys.path.insert(0, '.')
import requests

BASE = "http://127.0.0.1:8000"

print("1. Testing GET /api/v2/database/parcels:")
r1 = requests.get(f"{BASE}/api/v2/database/parcels", timeout=5)
print(" Status:", r1.status_code)
parcels = r1.json().get("parcels", [])
print(f" Parcels found ({len(parcels)}):")
for p in parcels:
    print(f"   Survey {p.get('survey_number')}/{p.get('sub_division_number')} - ULPIN {p.get('ulpin')} - Area {p.get('legal_area_sqm')} m2")

print("\n2. Testing GET /api/v2/projects/c0000000-0000-0000-0000-000000000204/inputs/live:")
r2 = requests.get(f"{BASE}/api/v2/projects/c0000000-0000-0000-0000-000000000204/inputs/live", timeout=5)
print(" Status:", r2.status_code)
channels = r2.json().get("channels", [])
print(f" Channels found ({len(channels)}):")
for c in channels:
    print(f"   {c.get('channelNumber'):02d} {c.get('displayName')}: {c.get('status')} ({c.get('completeness')}%) - {c.get('primaryMetric')}")

print("\n3. Testing GET /api/v2/database/units:")
r3 = requests.get(f"{BASE}/api/v2/database/units", timeout=5)
print(" Status:", r3.status_code)
units = r3.json().get("units", [])
print(f" Units found ({len(units)}):")
for u in units[:5]:
    print(f"   Unit {u.get('unit_number')} (Floor {u.get('floor')}): {u.get('carpet_area_sqm')} m2 - {u.get('unit_type')}")
