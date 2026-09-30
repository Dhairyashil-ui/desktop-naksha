from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # 1. Add columns completeness, quality, validation_status if not present
    conn.execute(text("""
        ALTER TABLE input_datasets ADD COLUMN IF NOT EXISTS completeness NUMERIC(5, 2) DEFAULT 0.00;
        ALTER TABLE input_datasets ADD COLUMN IF NOT EXISTS quality NUMERIC(5, 2) DEFAULT 0.00;
        ALTER TABLE input_datasets ADD COLUMN IF NOT EXISTS validation_status VARCHAR(64) DEFAULT 'PENDING';
    """))
    conn.commit()

    # 2. Check columns again
    cols = conn.execute(text("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'input_datasets' ORDER BY ordinal_position;")).fetchall()
    print("Updated input_datasets columns:")
    for c in cols:
        print(f"  - {c[0]}: {c[1]} (default: {c[2]})")
