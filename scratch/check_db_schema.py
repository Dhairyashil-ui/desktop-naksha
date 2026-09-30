from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("Columns for dataset_files:")
    cols = conn.execute(text("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'dataset_files' ORDER BY ordinal_position;")).fetchall()
    for c in cols:
        print(f"  {c[0]}: {c[1]} (nullable: {c[2]})")

    print("\nColumns for input_datasets:")
    cols2 = conn.execute(text("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'input_datasets' ORDER BY ordinal_position;")).fetchall()
    for c in cols2:
        print(f"  {c[0]}: {c[1]} (nullable: {c[2]})")

    print("\nColumns for validation_results:")
    cols3 = conn.execute(text("SELECT column_name, data_type, is_nullable, udt_name FROM information_schema.columns WHERE table_name = 'validation_results' ORDER BY ordinal_position;")).fetchall()
    for c in cols3:
        print(f"  {c[0]}: {c[1]} ({c[3]}) (nullable: {c[2]})")
