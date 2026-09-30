from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    for t in ['parcels', 'buildings', 'floors', 'units', 'property_titles', 'property_identities_3d', 'validation_results']:
        res = conn.execute(
            text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = :t ORDER BY ordinal_position"),
            {'t': t}
        ).fetchall()
        print(f"=== {t} ===")
        for c in res:
            print(f"  {c[0]}: {c[1]}")
