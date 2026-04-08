"""Seed script — populates the Forge database with demo ops/git data and real datasets.

Usage:
    # Local (with docker-compose DB running):
    python scripts/seed_demo.py

    # Railway:
    railway run python scripts/seed_demo.py

Inserts datasets (with real yfinance data), ops logs, and git events so
dashboard pages have data. Experiments are NOT seeded here — use
scripts/run_real_experiments.py for real trained models with real metrics.
"""

import logging
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

# Ensure project root is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from sqlalchemy.orm import Session

from forge.api.models.database import (
    Dataset,
    GitEvent,
    OpsLog,
    SessionLocal,
    engine,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helper: ensure pgvector extension
# ---------------------------------------------------------------------------

def ensure_pgvector() -> None:
    """Create pgvector extension if it doesn't exist."""
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    logger.info("pgvector extension ready")


# ---------------------------------------------------------------------------
# 1. Seed Datasets — real market data via yfinance
# ---------------------------------------------------------------------------

TICKER_CONFIGS = [
    {"name": "SPY 2024", "tickers": ["SPY"], "start": date(2024, 1, 1), "end": date(2024, 12, 31)},
    {"name": "AAPL 2024", "tickers": ["AAPL"], "start": date(2024, 1, 1), "end": date(2024, 12, 31)},
    {"name": "QQQ 2024", "tickers": ["QQQ"], "start": date(2024, 1, 1), "end": date(2024, 12, 31)},
]


def seed_datasets(db: Session) -> list[Dataset]:
    """Ingest real financial data for SPY, AAPL, QQQ via the existing ingestion service."""
    from forge.api.services.data_ingestion import ingest_dataset

    datasets = []
    for cfg in TICKER_CONFIGS:
        logger.info("Ingesting %s ...", cfg["name"])
        try:
            ds = ingest_dataset(
                session=db,
                name=cfg["name"],
                tickers=cfg["tickers"],
                start_date=cfg["start"],
                end_date=cfg["end"],
                source="yfinance",
            )
            datasets.append(ds)
            logger.info("  -> %s: %d records, %d features", ds.name, ds.num_records, len(ds.feature_columns or []))
        except Exception:
            logger.exception("  Failed to ingest %s — skipping", cfg["name"])
    return datasets




# ---------------------------------------------------------------------------
# 3. Seed Ops Logs
# ---------------------------------------------------------------------------

LOG_TEMPLATES = [
    ("marcus", "INFO", "Agent completed task: summarize weekly report", 0.03),
    ("marcus", "INFO", "Agent completed task: draft email response", 0.02),
    ("marcus", "INFO", "LLM call: gpt-4o — token usage 1,245", 0.04),
    ("marcus", "INFO", "LLM call: claude-3.5-sonnet — token usage 892", 0.02),
    ("marcus", "WARN", "Agent retry: tool call timed out, retrying (1/3)", 0.01),
    ("marcus", "INFO", "RAG pipeline: retrieved 8 documents, relevance 0.87", 0.01),
    ("marcus", "INFO", "Agent completed task: code review PR #47", 0.05),
    ("marcus", "ERROR", "LLM API rate limit exceeded — backing off 30s", 0.00),
    ("marcus", "INFO", "Agent completed task: generate unit tests", 0.06),
    ("marcus", "INFO", "LLM call: gpt-4o — token usage 3,100", 0.09),
    ("forge", "INFO", "Experiment run completed: xgb-baseline on SPY 2024", 0.00),
    ("forge", "INFO", "Data ingestion: SPY — 252 records fetched", 0.00),
    ("forge", "INFO", "Feature engineering: computed 15 features for AAPL", 0.00),
    ("forge", "WARN", "W&B upload slow — 12s for 2.3MB artifact", 0.00),
    ("forge", "INFO", "Model profiling complete: lstm-small — 2.31ms latency", 0.00),
    ("forge", "INFO", "Data ingestion: QQQ — 251 records fetched", 0.00),
    ("forge", "ERROR", "S3 upload failed: connection timeout to us-east-1", 0.00),
    ("forge", "INFO", "Experiment run completed: rf-baseline on AAPL 2024", 0.00),
    ("forge", "INFO", "Embedding generated for run lstm-large", 0.01),
    ("forge", "INFO", "Airflow DAG ingest_market_data triggered manually", 0.00),
    ("marcus", "INFO", "Agent completed task: analyze support ticket #312", 0.04),
    ("marcus", "INFO", "LLM call: claude-3.5-sonnet — token usage 2,450", 0.07),
    ("forge", "INFO", "Alembic migration applied: head revision abc123", 0.00),
    ("marcus", "WARN", "Tool output exceeded 4096 token limit — truncated", 0.01),
    ("marcus", "INFO", "Agent session started — user: josh", 0.00),
]


def seed_ops_logs(db: Session) -> None:
    """Insert ops log entries with timestamps spread over the past 7 days."""
    now = datetime.now(timezone.utc)

    for i, (project, level, message, cost) in enumerate(LOG_TEMPLATES):
        log = OpsLog(
            project_name=project,
            log_level=level,
            message=message,
            source="seed_demo",
            cost_usd=cost if cost > 0 else None,
            created_at=now - timedelta(hours=random.randint(1, 168), minutes=random.randint(0, 59)),
        )
        db.add(log)

    # Insert the anomalous cost spike — a single expensive LLM call
    anomaly_log = OpsLog(
        project_name="marcus",
        log_level="WARN",
        message="LLM call: gpt-4o — token usage 48,200 (large context window)",
        source="seed_demo",
        cost_usd=2.85,  # Way above normal (~$0.03-0.09)
        created_at=now - timedelta(hours=3),
    )
    db.add(anomaly_log)

    db.commit()
    logger.info("  %d ops log entries (including 1 anomaly)", len(LOG_TEMPLATES) + 1)


# ---------------------------------------------------------------------------
# 4. Seed Git Events
# ---------------------------------------------------------------------------

GIT_EVENTS = [
    {"repo": "marcus", "branch": "main", "message": "feat: add multi-tool agent routing", "author": "joshuamoorehead", "files": 5, "add": 142, "del": 23},
    {"repo": "marcus", "branch": "main", "message": "fix: handle empty RAG results gracefully", "author": "joshuamoorehead", "files": 2, "add": 18, "del": 4},
    {"repo": "marcus", "branch": "main", "message": "refactor: extract LLM client into service layer", "author": "joshuamoorehead", "files": 4, "add": 87, "del": 63},
    {"repo": "marcus", "branch": "dev", "message": "feat: add cost tracking per agent session", "author": "joshuamoorehead", "files": 3, "add": 56, "del": 8},
    {"repo": "marcus", "branch": "main", "message": "docs: update README with architecture diagram", "author": "joshuamoorehead", "files": 1, "add": 34, "del": 5},
    {"repo": "forge", "branch": "main", "message": "feat: add efficiency frontier chart component", "author": "joshuamoorehead", "files": 3, "add": 198, "del": 12},
    {"repo": "forge", "branch": "main", "message": "fix: anomaly z-score calculation for sparse data", "author": "joshuamoorehead", "files": 2, "add": 25, "del": 11},
    {"repo": "forge", "branch": "main", "message": "feat: add LangGraph agent with 5 tools", "author": "joshuamoorehead", "files": 4, "add": 312, "del": 0},
    {"repo": "forge", "branch": "dev", "message": "chore: add K8s manifests for deployment", "author": "joshuamoorehead", "files": 5, "add": 145, "del": 0},
    {"repo": "forge", "branch": "main", "message": "feat: hardware-aware profiler with efficiency scoring", "author": "joshuamoorehead", "files": 2, "add": 167, "del": 34},
]


def seed_git_events(db: Session) -> None:
    """Insert fake git commit events spread over the past 7 days."""
    now = datetime.now(timezone.utc)

    for i, evt in enumerate(GIT_EVENTS):
        sha = uuid.uuid4().hex[:40]
        event = GitEvent(
            repo=evt["repo"],
            event_type="push",
            branch=evt["branch"],
            commit_sha=sha,
            commit_message=evt["message"],
            author=evt["author"],
            files_changed=evt["files"],
            additions=evt["add"],
            deletions=evt["del"],
            payload={},
            created_at=now - timedelta(hours=random.randint(2, 168), minutes=random.randint(0, 59)),
        )
        db.add(event)

    db.commit()
    logger.info("  %d git events", len(GIT_EVENTS))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    """Run all seed functions in order."""
    logger.info("=" * 60)
    logger.info("Forge Demo Seed Script")
    logger.info("=" * 60)
    logger.info("DATABASE_URL: %s", os.getenv("DATABASE_URL", "(default local)"))

    ensure_pgvector()

    db = SessionLocal()
    try:
        # Check if data already exists
        existing_datasets = db.query(Dataset).count()
        if existing_datasets > 0:
            logger.warning("Database already has %d datasets — seeding will add more.", existing_datasets)
            response = input("Continue? [y/N] ").strip().lower()
            if response != "y":
                logger.info("Aborted.")
                return

        logger.info("\n--- Seeding Datasets (real yfinance data) ---")
        datasets = seed_datasets(db)
        if not datasets:
            logger.error("No datasets were ingested.")

        logger.info("\n--- Seeding Ops Logs ---")
        seed_ops_logs(db)

        logger.info("\n--- Seeding Git Events ---")
        seed_git_events(db)

        logger.info("\n" + "=" * 60)
        logger.info("Seed complete!")
        logger.info("  Datasets:    %d", len(datasets))
        logger.info("  Ops logs:    %d", len(LOG_TEMPLATES) + 1)
        logger.info("  Git events:  %d", len(GIT_EVENTS))
        logger.info("NOTE: Run scripts/run_real_experiments.py for real experiment data.")
        logger.info("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    main()
