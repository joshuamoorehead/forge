"""Pre-startup migration script for Railway deployment.

Handles the case where the database was bootstrapped outside of Alembic
(e.g., via SQLAlchemy create_all) and has base tables but no alembic_version.
Stamps the initial migration to avoid recreating existing tables, then runs
any newer migrations that add new tables/columns.
"""

import os
import sys

from sqlalchemy import create_engine, inspect, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://forge:forge@localhost:5432/forge")
INITIAL_REVISION = "ac8126d47dcc"


def main() -> None:
    """Run Alembic migrations safely, handling pre-existing databases."""
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)

    existing_tables = inspector.get_table_names()
    has_alembic = "alembic_version" in existing_tables
    has_base_tables = "datasets" in existing_tables and "experiments" in existing_tables

    if has_base_tables and not has_alembic:
        print(f"[migrate] Base tables exist but no alembic_version — stamping initial revision {INITIAL_REVISION}")
        os.system(f"alembic stamp {INITIAL_REVISION}")

    print("[migrate] Running alembic upgrade head...")
    exit_code = os.system("alembic upgrade head")

    if exit_code != 0:
        print("[migrate] WARNING: alembic upgrade failed, but continuing startup", file=sys.stderr)
    else:
        # Verify new tables were created
        inspector = inspect(engine)
        new_tables = inspector.get_table_names()
        expected = ["registered_models", "model_versions", "feature_sets", "drift_reports", "run_environments"]
        missing = [t for t in expected if t not in new_tables]
        if missing:
            print(f"[migrate] WARNING: Expected tables still missing: {missing}", file=sys.stderr)
        else:
            print("[migrate] All expected tables present")

    engine.dispose()


if __name__ == "__main__":
    main()
