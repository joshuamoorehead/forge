"""Pre-startup migration script for Railway deployment.

Handles the case where the database was bootstrapped outside of Alembic
(e.g., via SQLAlchemy create_all) and has base tables but no alembic_version.
"""

import os
import subprocess
import sys

from sqlalchemy import create_engine, inspect

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://forge:forge@localhost:5432/forge")
INITIAL_REVISION = "ac8126d47dcc"


def run_alembic(args: list[str]) -> tuple[int, str, str]:
    """Run an alembic command and return (exit_code, stdout, stderr)."""
    result = subprocess.run(
        ["alembic"] + args,
        capture_output=True,
        text=True,
        timeout=60,
    )
    return result.returncode, result.stdout, result.stderr


def main() -> None:
    """Run Alembic migrations safely, handling pre-existing databases."""
    print("[migrate] Connecting to database...", flush=True)

    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
        engine.dispose()
    except Exception as exc:
        print(f"[migrate] ERROR: Cannot connect to database: {exc}", file=sys.stderr, flush=True)
        return

    has_alembic = "alembic_version" in existing_tables
    has_base_tables = "datasets" in existing_tables and "experiments" in existing_tables

    print(f"[migrate] Tables found: {len(existing_tables)}, alembic_version: {has_alembic}, base_tables: {has_base_tables}", flush=True)

    # If base tables exist but Alembic hasn't been initialized, stamp the initial revision
    if has_base_tables and not has_alembic:
        print(f"[migrate] Stamping initial revision {INITIAL_REVISION}...", flush=True)
        code, out, err = run_alembic(["stamp", INITIAL_REVISION])
        print(f"[migrate] stamp stdout: {out.strip()}", flush=True)
        if code != 0:
            print(f"[migrate] stamp stderr: {err.strip()}", file=sys.stderr, flush=True)
            print("[migrate] WARNING: stamp failed, will attempt upgrade anyway", flush=True)

    # Run migrations
    print("[migrate] Running alembic upgrade head...", flush=True)
    code, out, err = run_alembic(["upgrade", "head"])
    print(f"[migrate] upgrade stdout: {out.strip()}", flush=True)

    if code != 0:
        print(f"[migrate] upgrade stderr: {err.strip()}", file=sys.stderr, flush=True)
        print("[migrate] WARNING: migration failed — app will start but some endpoints may error", flush=True)
    else:
        print("[migrate] Migrations applied successfully", flush=True)


if __name__ == "__main__":
    main()
