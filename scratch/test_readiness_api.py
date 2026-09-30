import sys
import uuid
from datetime import datetime, timezone
sys.path.insert(0, "d:/surveynaksha")

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import engine
from sqlalchemy import text as sql_text

client = TestClient(app)

# Create a temporary project
proj_id = str(uuid.uuid4())
org_id = str(uuid.uuid4())
code = f"API-{uuid.uuid4().hex[:6]}"

with engine.connect() as conn:
    org_row = conn.execute(sql_text("SELECT id FROM organizations LIMIT 1")).fetchone()
    if org_row:
        org_id = str(org_row[0])
    else:
        conn.execute(sql_text("INSERT INTO organizations (id, name, slug) VALUES (:id, 'API Org', 'api-org')"), {"id": org_id})
    conn.execute(sql_text("""
        INSERT INTO projects (id, organization_id, code, title, accuracy_tier, target_crs_epsg, status)
        VALUES (:id, :org_id, :code, 'API Readiness Test', 'TIER_1_CADASTRAL_LEGAL'::accuracy_tier_enum, 32643, 'ACTIVE')
    """), {"id": proj_id, "org_id": org_id, "code": code})
    conn.commit()

try:
    resp = client.get(f"/api/v2/projects/{proj_id}/readiness")
    print(f"GET /readiness status: {resp.status_code}")
    data = resp.json()
    print("Response JSON summary:")
    print("  overallReadiness:", data.get("overallReadiness"))
    print("  requiredData:", data.get("requiredData"))
    print("  processingStatus:", data.get("processingStatus"))
    print("  categories count:", len(data.get("categories", [])))
    first_cat = data["categories"][0]
    print(f"  First category ({first_cat['name']}):")
    print(f"    Required: {first_cat['Required']}")
    print(f"    Completeness: {first_cat['Completeness']}%")
    print(f"    Quality: {first_cat['Quality']}%")
    print(f"    Valid: {first_cat['Valid']}")
    assert resp.status_code == 200
    assert data["processingStatus"] == "BLOCKED"
    print("\n--> FASTAPI ENDPOINT /api/v2/projects/{project_id}/readiness VERIFIED OK!")
finally:
    with engine.connect() as conn:
        conn.execute(sql_text("DELETE FROM projects WHERE id = :id"), {"id": proj_id})
        conn.commit()
