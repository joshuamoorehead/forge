"""Seed script — populates the Forge database with realistic demo data.

Usage:
    # Local (with docker-compose DB running):
    python scripts/seed_demo.py

    # Railway:
    railway run python scripts/seed_demo.py

Inserts datasets (with real yfinance data), experiments with pre-computed
run metrics, ops logs, and git events so every dashboard page has data.
"""

import logging
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# Ensure project root is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from sqlalchemy.orm import Session

from forge.api.models.database import (
    Dataset,
    Experiment,
    GitEvent,
    OpsLog,
    Run,
    SessionLocal,
    engine,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(os.getenv("FORGE_DATA_DIR", "data/datasets"))


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
# 2. Seed Experiments + Runs — pre-computed metrics (no actual training)
# ---------------------------------------------------------------------------

RUN_TEMPLATES = [
    {
        "run_name": "xgb-baseline",
        "model_type": "xgboost",
        "hyperparameters": {"n_estimators": 500, "max_depth": 6, "learning_rate": 0.1, "early_stopping_rounds": 20},
        "accuracy": 0.5714, "precision": 0.5842, "recall": 0.6103, "f1": 0.5970,
        "inference_latency_ms": 0.42, "inference_latency_p95_ms": 0.58,
        "peak_memory_mb": 12.3, "model_size_mb": 1.8, "throughput": 238000, "training_time": 4.2,
    },
    {
        "run_name": "xgb-deep",
        "model_type": "xgboost",
        "hyperparameters": {"n_estimators": 1000, "max_depth": 10, "learning_rate": 0.05, "early_stopping_rounds": 30},
        "accuracy": 0.5536, "precision": 0.5691, "recall": 0.5882, "f1": 0.5785,
        "inference_latency_ms": 0.67, "inference_latency_p95_ms": 0.89,
        "peak_memory_mb": 24.1, "model_size_mb": 4.5, "throughput": 149000, "training_time": 8.7,
    },
    {
        "run_name": "rf-baseline",
        "model_type": "random_forest",
        "hyperparameters": {"n_estimators": 200, "max_depth": 10, "min_samples_split": 5},
        "accuracy": 0.5357, "precision": 0.5500, "recall": 0.5735, "f1": 0.5615,
        "inference_latency_ms": 1.85, "inference_latency_p95_ms": 2.41,
        "peak_memory_mb": 45.6, "model_size_mb": 18.2, "throughput": 54000, "training_time": 2.1,
    },
    {
        "run_name": "rf-large",
        "model_type": "random_forest",
        "hyperparameters": {"n_estimators": 500, "max_depth": 15, "min_samples_split": 3},
        "accuracy": 0.5179, "precision": 0.5312, "recall": 0.5588, "f1": 0.5447,
        "inference_latency_ms": 4.12, "inference_latency_p95_ms": 5.67,
        "peak_memory_mb": 98.3, "model_size_mb": 42.7, "throughput": 24300, "training_time": 5.4,
    },
    {
        "run_name": "lstm-small",
        "model_type": "lstm",
        "hyperparameters": {"window_size": 30, "hidden_size": 64, "num_layers": 2, "dropout": 0.2, "epochs": 50, "learning_rate": 0.001},
        "accuracy": 0.5446, "precision": 0.5571, "recall": 0.5662, "f1": 0.5616,
        "inference_latency_ms": 2.31, "inference_latency_p95_ms": 3.18,
        "peak_memory_mb": 34.5, "model_size_mb": 0.8, "throughput": 43300, "training_time": 38.6,
    },
    {
        "run_name": "lstm-large",
        "model_type": "lstm",
        "hyperparameters": {"window_size": 60, "hidden_size": 256, "num_layers": 2, "dropout": 0.3, "epochs": 100, "learning_rate": 0.0005},
        "accuracy": 0.5625, "precision": 0.5753, "recall": 0.5809, "f1": 0.5781,
        "inference_latency_ms": 5.87, "inference_latency_p95_ms": 7.42,
        "peak_memory_mb": 78.9, "model_size_mb": 3.2, "throughput": 17000, "training_time": 124.3,
    },
]


def _compute_efficiency(accuracy: float, latency_ms: float, memory_mb: float) -> float:
    """Efficiency score: accuracy / (normalized_latency * normalized_memory).

    Uses simple normalization relative to fixed baselines.
    """
    norm_latency = max(latency_ms / 10.0, 0.01)
    norm_memory = max(memory_mb / 100.0, 0.01)
    return round(accuracy / (norm_latency * norm_memory), 4)


def seed_experiments(db: Session, datasets: list[Dataset]) -> list[Experiment]:
    """Create experiments with pre-computed run metrics for each dataset."""
    experiments = []
    now = datetime.now(timezone.utc)

    for idx, ds in enumerate(datasets):
        exp = Experiment(
            name=f"{ds.tickers[0]} Model Comparison" if ds.tickers else f"Experiment {idx}",
            description=f"Comparing XGBoost, Random Forest, and LSTM on {ds.name} features",
            dataset_id=ds.id,
            status="completed",
            created_at=now - timedelta(hours=random.randint(12, 72)),
            updated_at=now - timedelta(hours=random.randint(1, 6)),
        )
        db.add(exp)
        db.flush()

        # Add a subset of runs per experiment to vary the data
        if idx == 0:
            templates = RUN_TEMPLATES  # SPY gets all 6 runs
        elif idx == 1:
            templates = RUN_TEMPLATES[:4]  # AAPL gets 4 runs
        else:
            templates = [RUN_TEMPLATES[0], RUN_TEMPLATES[2], RUN_TEMPLATES[4]]  # QQQ gets 3

        for tmpl in templates:
            # Add slight random variation so each experiment looks different
            jitter = lambda v: round(v * random.uniform(0.95, 1.05), 4)  # noqa: E731

            efficiency = _compute_efficiency(tmpl["accuracy"], tmpl["inference_latency_ms"], tmpl["peak_memory_mb"])

            run = Run(
                experiment_id=exp.id,
                run_name=tmpl["run_name"],
                model_type=tmpl["model_type"],
                hyperparameters=tmpl["hyperparameters"],
                feature_engineering={"features": "fft,autocorr,rsi,macd,bbands"},
                accuracy=jitter(tmpl["accuracy"]),
                precision_score=jitter(tmpl["precision"]),
                recall=jitter(tmpl["recall"]),
                f1=jitter(tmpl["f1"]),
                inference_latency_ms=jitter(tmpl["inference_latency_ms"]),
                inference_latency_p95_ms=jitter(tmpl["inference_latency_p95_ms"]),
                peak_memory_mb=jitter(tmpl["peak_memory_mb"]),
                model_size_mb=jitter(tmpl["model_size_mb"]),
                throughput_samples_per_sec=jitter(tmpl["throughput"]),
                training_time_seconds=jitter(tmpl["training_time"]),
                efficiency_score=jitter(efficiency),
                status="completed",
                started_at=now - timedelta(hours=random.randint(2, 48)),
                completed_at=now - timedelta(hours=random.randint(0, 2)),
            )
            db.add(run)

        experiments.append(exp)
        logger.info("  Experiment: %s (%d runs)", exp.name, len(templates))

    db.commit()
    return experiments


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
    {"repo": "joshuamoorehead/marcus", "branch": "main", "message": "feat: add multi-tool agent routing", "author": "joshuamoorehead", "files": 5, "add": 142, "del": 23},
    {"repo": "joshuamoorehead/marcus", "branch": "main", "message": "fix: handle empty RAG results gracefully", "author": "joshuamoorehead", "files": 2, "add": 18, "del": 4},
    {"repo": "joshuamoorehead/marcus", "branch": "main", "message": "refactor: extract LLM client into service layer", "author": "joshuamoorehead", "files": 4, "add": 87, "del": 63},
    {"repo": "joshuamoorehead/marcus", "branch": "dev", "message": "feat: add cost tracking per agent session", "author": "joshuamoorehead", "files": 3, "add": 56, "del": 8},
    {"repo": "joshuamoorehead/marcus", "branch": "main", "message": "docs: update README with architecture diagram", "author": "joshuamoorehead", "files": 1, "add": 34, "del": 5},
    {"repo": "joshuamoorehead/forge", "branch": "main", "message": "feat: add efficiency frontier chart component", "author": "joshuamoorehead", "files": 3, "add": 198, "del": 12},
    {"repo": "joshuamoorehead/forge", "branch": "main", "message": "fix: anomaly z-score calculation for sparse data", "author": "joshuamoorehead", "files": 2, "add": 25, "del": 11},
    {"repo": "joshuamoorehead/forge", "branch": "main", "message": "feat: add LangGraph agent with 5 tools", "author": "joshuamoorehead", "files": 4, "add": 312, "del": 0},
    {"repo": "joshuamoorehead/forge", "branch": "dev", "message": "chore: add K8s manifests for deployment", "author": "joshuamoorehead", "files": 5, "add": 145, "del": 0},
    {"repo": "joshuamoorehead/forge", "branch": "main", "message": "feat: hardware-aware profiler with efficiency scoring", "author": "joshuamoorehead", "files": 2, "add": 167, "del": 34},
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
            logger.error("No datasets were ingested. Cannot seed experiments.")
            return

        logger.info("\n--- Seeding Experiments + Runs ---")
        experiments = seed_experiments(db, datasets)

        logger.info("\n--- Seeding Ops Logs ---")
        seed_ops_logs(db)

        logger.info("\n--- Seeding Git Events ---")
        seed_git_events(db)

        logger.info("\n" + "=" * 60)
        logger.info("Seed complete!")
        logger.info("  Datasets:    %d", len(datasets))
        logger.info("  Experiments: %d", len(experiments))
        logger.info("  Ops logs:    %d", len(LOG_TEMPLATES) + 1)
        logger.info("  Git events:  %d", len(GIT_EVENTS))
        logger.info("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    main()
