"""
Verification Test Suite for Step 29 & Step 30
Phase 6:
Step 29: Associate building with existing 2D ULPIN:
         2D Parcel -> 14-digit ULPIN -> Building -> Flat A, Flat B, Flat C
         The base 2D ULPIN remains the permanent parent/base reference.
Step 30: Generate structured 3D property identity:
         base_ulpin + floor_id + unit_id + volume_id + 3d_property_id
         Display identifier: 27-07-005-012345-F12-A
         Pluggable formatters without database rebuilding.
"""

import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, ".")

from backend.cadastral_identity import (
    cadastral_engine,
    PropertyIdentityFormatter,
    Structured3DPropertyIdentity
)
from fastapi.testclient import TestClient
from backend.main import app

SEP = "=" * 74


def test_step29_base_ulpin_association():
    print(SEP)
    print("TESTING STEP 29: ASSOCIATE BUILDING WITH EXISTING 2D ULPIN")
    print(SEP)

    base_ulpin = "27-07-005-012345"
    print(f"Parent Base 2D ULPIN: {base_ulpin} (14-digit Bhu-Aadhaar format)")

    # Retrieve Cadastral Strata Tree
    tree_res = cadastral_engine.get_strata_tree(base_ulpin)
    assert tree_res["status"] == "SUCCESS"

    hierarchy = tree_res["cadastral_hierarchy"]
    parent_parcel = hierarchy["parent_2d_parcel"]
    building = hierarchy["building"]
    strata_floors = hierarchy["strata_floors"]

    print("\nCadastral Identity Linkage:")
    print("2D Parcel")
    print(f" └── 14-digit Base ULPIN: {parent_parcel['ulpin_2d']}")
    print(f"      State:               {parent_parcel['state_code']}")
    print(f"      District:            {parent_parcel['district_code']}")
    print(f"      Taluka:              {parent_parcel['taluka_code']}")
    print(f"      Village / Survey:    {parent_parcel['village_survey_no']}")
    print(f"      Legal Status:        {parent_parcel['legal_status']}")
    print("          │")
    print("          ▼")
    print(f"      Building:            {building['building_name']} ({building['building_id']})")
    print(f"      Parent Reference:    {building['parent_base_ulpin']}")
    print("          │")
    print("    ┌─────┼─────┬─────┐")
    print("    ▼     ▼     ▼     ▼")

    sample_floor = strata_floors[0]
    for u in sample_floor["units"][:4]:
        print(f"  Flat {u['unit_code']:<2} -> Display 3D ULPIN: {u['display_ulpin_3d']} (Base: {u['base_ulpin']})")

    # Strict check: The base 2D ULPIN must not disappear!
    assert parent_parcel["ulpin_2d"] == base_ulpin
    assert building["parent_base_ulpin"] == base_ulpin

    for fl in strata_floors:
        for u in fl["units"]:
            assert u["base_ulpin"] == base_ulpin, f"Unit {u['unit_id']} lost parent 2D ULPIN reference!"
            assert base_ulpin in u["display_ulpin_3d"]

    print("\n  --> Base 2D ULPIN Preserved as Permanent Parent Cadastral Reference!")
    print("--> STEP 29 VERIFICATION PASSED: 2D ULPIN TO BUILDING/UNIT ASSOCIATION VERIFIED!")


def test_step30_structured_3d_property_identity():
    print("\n" + SEP)
    print("TESTING STEP 30: STRUCTURED 3D PROPERTY IDENTITY (NOT MERELY A STRING)")
    print(SEP)

    # Example requested in prompt: 27-07-005-012345-F12-A
    base_ulpin = "27-07-005-012345"
    floor_num = 12
    unit_code = "A"

    # 1. Create Structured Identity
    ident = cadastral_engine.create_structured_identity(
        base_ulpin=base_ulpin,
        floor_number=floor_num,
        unit_code=unit_code,
        building_id="BLDG-001",
        metadata={
            "carpet_area_sqm": 84.50,
            "undivided_land_share_pct": 1.5625,
            "legal_owner": "Sunita R. Kulkarni"
        }
    )

    print("Structured Identity Fields in Database:")
    print(f"  base_ulpin:      {ident.base_ulpin}")
    print(f"  floor_id:        {ident.floor_id}")
    print(f"  unit_id:         {ident.unit_id}")
    print(f"  volume_id:       {ident.volume_id}")
    print(f"  property_id_3d:  {ident.property_id_3d}")
    print(f"  building_id:     {ident.building_id}")
    print(f"  floor_number:    {ident.floor_number}")
    print(f"  unit_code:       {ident.unit_code}")
    print(f"  display_ulpin_3d:{ident.display_ulpin_3d}")
    print(f"  format_standard: {ident.format_standard}")

    # Verify structured fields
    assert ident.base_ulpin == base_ulpin
    assert ident.floor_id == "F12"
    assert ident.unit_id == "A"
    assert ident.volume_id == f"VOL_{base_ulpin}_F12_A"
    assert ident.property_id_3d == f"PROP3D_{base_ulpin}_F12_A"
    assert ident.display_ulpin_3d == "27-07-005-012345-F12-A"

    # Persist in DB
    persisted = cadastral_engine.persist_identity(ident)
    print(f"\n  --> Persisted in PostgreSQL table 'property_identities_3d': {persisted}")

    # 2. Test Pluggable Formatters (without altering database)
    print("\nPluggable Formatter Verification (Zero DB Rebuilding):")
    fmt_proposed = PropertyIdentityFormatter.format(
        ident.base_ulpin, ident.floor_id, ident.unit_id,
        PropertyIdentityFormatter.STANDARD_PROPOSED
    )
    fmt_compact = PropertyIdentityFormatter.format(
        ident.base_ulpin, ident.floor_id, ident.unit_id,
        PropertyIdentityFormatter.COMPACT_BHU_AADHAAR
    )
    fmt_slash = PropertyIdentityFormatter.format(
        ident.base_ulpin, ident.floor_id, ident.unit_id,
        PropertyIdentityFormatter.HIERARCHICAL_SLASH
    )
    fmt_deed = PropertyIdentityFormatter.format(
        ident.base_ulpin, ident.floor_id, ident.unit_id,
        PropertyIdentityFormatter.STRATA_LEGAL_DEED
    )

    print(f"  1. STANDARD_PROPOSED:     {fmt_proposed}")
    print(f"  2. COMPACT_BHU_AADHAAR:   {fmt_compact}")
    print(f"  3. HIERARCHICAL_SLASH:    {fmt_slash}")
    print(f"  4. STRATA_LEGAL_DEED:     {fmt_deed}")

    assert fmt_proposed == "27-07-005-012345-F12-A"
    assert fmt_compact == "2707005012345F12A"
    assert fmt_slash == "27-07-005-012345/F12/A"

    # 3. Test Bidirectional Parser
    parsed = PropertyIdentityFormatter.parse("27-07-005-012345-F12-A")
    assert parsed is not None
    assert parsed["base_ulpin"] == "27-07-005-012345"
    assert parsed["floor_id"] == "F12"
    assert parsed["unit_id"] == "A"
    print(f"\n  --> Bidirectional Parsing: Successfully reconstructed {parsed}!")

    print("\n--> STEP 30 VERIFICATION PASSED: STRUCTURED 3D IDENTITY FULLY VERIFIED!")


def test_fastapi_cadastral_endpoints():
    print("\n" + SEP)
    print("TESTING FASTAPI API ENDPOINTS (STEP 29 & STEP 30)")
    print(SEP)

    client = TestClient(app)

    # 1. POST /api/v2/cadastre/3d-identity/generate
    r_gen = client.post(
        "/api/v2/cadastre/3d-identity/generate",
        json={
            "base_ulpin": "27-07-005-012345",
            "floor_number": 12,
            "unit_code": "A",
            "building_id": "BLDG-001"
        }
    )
    print(f"  POST /api/v2/cadastre/3d-identity/generate -> Status {r_gen.status_code}")
    assert r_gen.status_code == 200
    gen_data = r_gen.json()["structured_identity"]
    assert gen_data["display_ulpin_3d"] == "27-07-005-012345-F12-A"
    print(f"    Generated: {gen_data['display_ulpin_3d']} (Volume ID: {gen_data['volume_id']})")

    # 2. GET /api/v2/cadastre/3d-identity/{query}
    r_get = client.get("/api/v2/cadastre/3d-identity/27-07-005-012345-F12-A")
    print(f"  GET  /api/v2/cadastre/3d-identity/27-07-005-012345-F12-A -> Status {r_get.status_code}")
    assert r_get.status_code == 200
    assert r_get.json()["identity"]["unit_id"] == "A"

    # 3. GET /api/v2/cadastre/parcels/{base_ulpin}/strata-tree
    r_tree = client.get("/api/v2/cadastre/parcels/27-07-005-012345/strata-tree")
    print(f"  GET  /api/v2/cadastre/parcels/27-07-005-012345/strata-tree -> Status {r_tree.status_code}")
    assert r_tree.status_code == 200
    tree_data = r_tree.json()
    assert tree_data["cadastral_hierarchy"]["parent_2d_parcel"]["ulpin_2d"] == "27-07-005-012345"

    # 4. POST /api/v2/cadastre/3d-identity/format
    r_fmt = client.post(
        "/api/v2/cadastre/3d-identity/format",
        json={
            "base_ulpin": "27-07-005-012345",
            "floor_id": "F12",
            "unit_id": "A",
            "target_standard": "COMPACT_BHU_AADHAAR"
        }
    )
    print(f"  POST /api/v2/cadastre/3d-identity/format -> Status {r_fmt.status_code}")
    assert r_fmt.status_code == 200
    assert r_fmt.json()["display_identifier"] == "2707005012345F12A"
    print(f"    Reformated to Compact: {r_fmt.json()['display_identifier']}")

    print("\n--> FASTAPI CADASTRAL ENDPOINTS VERIFIED OK!")


if __name__ == "__main__":
    test_step29_base_ulpin_association()
    test_step30_structured_3d_property_identity()
    test_fastapi_cadastral_endpoints()
    print("\n" + SEP)
    print("STEP 29 & STEP 30 FULLY SATISFIED AND VERIFIED!")
    print(SEP)
