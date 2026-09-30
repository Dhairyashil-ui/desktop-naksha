import sys
sys.path.insert(0, '.')
from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    for t in ['organizations', 'property_titles']:
        cols = conn.execute(text(f"SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '{t}'")).fetchall()
        print(f"*** {t} ***")
        for c in cols:
            print(f"  {c[0]}: {c[1]} (nullable={c[2]})")
    orgs = conn.execute(text("SELECT * FROM organizations")).fetchall()
    print("existing orgs:", orgs)
