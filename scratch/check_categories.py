from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    rows = conn.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'input_category_enum' ORDER BY enumsortorder;")).fetchall()
    print("Categories in DB:")
    for r in rows:
        print(" -", r[0])
