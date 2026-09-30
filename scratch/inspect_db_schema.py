from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("=== PROJECTS ===")
    p_cols = [c[0] for c in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'projects'")).fetchall()]
    print("Cols:", p_cols)
    for p in conn.execute(text("SELECT * FROM projects")).fetchall():
        print(dict(zip(p_cols, p)))

    print("\n=== PARCELS ===")
    r_cols = [c[0] for c in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'parcels'")).fetchall()]
    print("Cols:", r_cols)
    for r in conn.execute(text("SELECT * FROM parcels")).fetchall():
        print(dict(zip(r_cols, r)))
