import sys
sys.path.insert(0, '.')
from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    res = conn.execute(text("SELECT udt_name FROM information_schema.columns WHERE table_name = 'input_datasets' AND column_name = 'category'")).fetchone()
    print("category udt_name:", res[0])

    res = conn.execute(text(f"""
        SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = '{res[0]}'
        ORDER BY e.enumsortorder;
    """)).fetchall()
    print(f"Enum {res[0]} values:", [r[0] for r in res])
