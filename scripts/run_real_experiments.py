"""Run real ML experiments — replaces fake seeded data with trained models.

Usage:
    # Local (with docker-compose DB running):
    python scripts/run_real_experiments.py

    # Railway:
    railway run python scripts/run_real_experiments.py

Runs 3 experiments:
  1. SPY direction prediction — all 6 model types × 2 hyperparameter configs
  2. Multi-asset comparison — top 3 models on SPY, AAPL, QQQ
  3. Feature ablation — best model with different feature subsets
"""

import logging
import os
import subprocess
import sys
import time
from datetime import date, datetime, timezone
from uuid import UUID

# Prevent OpenMP thread collision between torch, xgboost, and wandb C extensions.
# Without this, the combination causes SIGSEGV on macOS (and some Linux configs).
os.environ.setdefault("OMP_NUM_THREADS", "1")

import numpy as np
import pandas as pd

# Ensure project root is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session

from forge.api.models.database import (
    Dataset,
    Experiment,
    Run,
    SessionLocal,
    engine,
)

# NOTE: We do NOT import data_ingestion here. yfinance's curl_cffi C extensions
# cause segfaults when combined with torch + xgboost in the same process.
# Data ingestion runs in a subprocess instead (see ensure_dataset).
from forge.api.services.training import (
    DEFAULT_CONFIGS,
    SEQUENCE_MODEL_TYPES,
    _make_trainers,
    create_target,
    evaluate_model,
    extract_xy,
    time_series_split,
)
from forge.api.services.profiler import profile_model
from forge.api.services.wandb_tracker import WandbTracker

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Hyperparameter configs — 2 variations per model type
# ---------------------------------------------------------------------------

EXPERIMENT_1_CONFIGS: dict[str, list[dict]] = {
    "xgboost": [
        {"n_estimators": 500, "max_depth": 3, "learning_rate": 0.1, "early_stopping_rounds": 20},
        {"n_estimators": 500, "max_depth": 6, "learning_rate": 0.05, "early_stopping_rounds": 20},
    ],
    "random_forest": [
        {"n_estimators": 200, "max_depth": 8, "min_samples_split": 5},
        {"n_estimators": 300, "max_depth": 12, "min_samples_split": 3},
    ],
    "lstm": [
        {"window_size": 20, "hidden_size": 64, "num_layers": 2, "dropout": 0.2, "learning_rate": 0.001, "epochs": 30, "batch_size": 32},
        {"window_size": 30, "hidden_size": 128, "num_layers": 2, "dropout": 0.3, "learning_rate": 0.0005, "epochs": 30, "batch_size": 32},
    ],
    "tcn": [
        {"window_size": 20, "num_channels": 32, "num_layers": 3, "kernel_size": 3, "dropout": 0.2, "learning_rate": 0.001, "epochs": 30, "batch_size": 32},
        {"window_size": 30, "num_channels": 64, "num_layers": 4, "kernel_size": 3, "dropout": 0.2, "learning_rate": 0.0005, "epochs": 30, "batch_size": 32},
    ],
    "cnn_lstm": [
        {"window_size": 20, "cnn_filters": 32, "cnn_kernel_size": 3, "lstm_hidden": 32, "lstm_layers": 1, "dropout": 0.2, "learning_rate": 0.001, "epochs": 30, "batch_size": 32},
        {"window_size": 30, "cnn_filters": 64, "cnn_kernel_size": 3, "lstm_hidden": 64, "lstm_layers": 1, "dropout": 0.2, "learning_rate": 0.0005, "epochs": 30, "batch_size": 32},
    ],
    "transformer": [
        {"window_size": 20, "d_model": 32, "nhead": 4, "num_layers": 1, "dim_feedforward": 64, "dropout": 0.1, "learning_rate": 0.001, "epochs": 30, "batch_size": 32},
        {"window_size": 30, "d_model": 64, "nhead": 4, "num_layers": 2, "dim_feedforward": 128, "dropout": 0.1, "learning_rate": 0.0005, "epochs": 30, "batch_size": 32},
    ],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def ensure_dataset(db: Session, name: str, tickers: list[str], start: date, end: date) -> Dataset:
    """Return existing dataset by name or ingest via a subprocess.

    Data ingestion uses yfinance which imports curl_cffi. That C extension
    conflicts with torch + xgboost in the same process (causes SIGSEGV).
    Running ingestion in a subprocess isolates the incompatible libraries.
    """
    existing = db.query(Dataset).filter(Dataset.name == name).first()
    if existing:
        logger.info("Dataset '%s' already exists (id=%s)", name, existing.id)
        return existing

    logger.info("Ingesting dataset '%s' via subprocess ...", name)
    ticker_str = ",".join(tickers)
    result = subprocess.run(
        [
            sys.executable, "-c",
            f"""
import os, sys
sys.path.insert(0, os.path.abspath('.'))
from forge.api.models.database import SessionLocal
from forge.api.services.data_ingestion import ingest_dataset
from datetime import date
db = SessionLocal()
ds = ingest_dataset(db, '{name}', {tickers!r}, date.fromisoformat('{start.isoformat()}'), date.fromisoformat('{end.isoformat()}'))
print(str(ds.id))
db.close()
""",
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        logger.error("Ingestion subprocess failed:\n%s", result.stderr)
        raise RuntimeError(f"Failed to ingest dataset '{name}'")

    # Refresh DB session to pick up the new dataset
    db.expire_all()
    dataset = db.query(Dataset).filter(Dataset.name == name).first()
    if dataset is None:
        raise RuntimeError(f"Dataset '{name}' not found after ingestion")

    logger.info("  -> %s ingested (id=%s, records=%d)", name, dataset.id, dataset.num_records or 0)
    return dataset


def run_single_training(
    db: Session,
    experiment: Experiment,
    run_name: str,
    model_type: str,
    hyperparams: dict,
    df: pd.DataFrame,
    feature_subset: list[str] | None = None,
) -> Run:
    """Create a Run record, train the model, profile it, and store results.

    Args:
        db: Database session.
        experiment: Parent experiment.
        run_name: Human-readable run name.
        model_type: One of the 6 supported model types.
        hyperparams: Hyperparameter dict for the model.
        df: Full featured DataFrame (already has target column).
        feature_subset: If provided, only use these feature columns.
    """
    run = Run(
        experiment_id=experiment.id,
        run_name=run_name,
        model_type=model_type,
        hyperparameters=hyperparams,
        feature_engineering={"feature_subset": feature_subset} if feature_subset else {"features": "all"},
        status="pending",
    )
    db.add(run)
    db.flush()

    run.status = "running"
    run.started_at = datetime.now(timezone.utc)
    db.commit()

    tracker = WandbTracker()
    tracker.init_run(
        project="forge",
        experiment_name=experiment.name,
        model_type=model_type,
        hyperparameters=hyperparams,
        tags=[model_type, experiment.name],
    )

    try:
        # Prepare data
        work_df = df.copy()
        train_df, val_df, test_df = time_series_split(work_df)

        # Extract features — optionally subset
        exclude = {"Date", "Open", "High", "Low", "Close", "Volume", "ticker", "target"}
        if feature_subset:
            feature_cols = [c for c in feature_subset if c in work_df.columns and c not in exclude]
        else:
            feature_cols = [c for c in work_df.columns if c not in exclude]

        def _extract(split_df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
            x = split_df[feature_cols].values.astype(np.float32)
            y = split_df["target"].values.astype(np.float32)
            x = np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)
            return x, y

        x_train, y_train = _extract(train_df)
        x_val, y_val = _extract(val_df)
        x_test, y_test = _extract(test_df)

        # Train
        trainers = _make_trainers(epoch_callback=tracker.log_epoch_metrics)
        train_start = time.time()
        model = trainers[model_type](x_train, y_train, x_val, y_val, hyperparams)
        training_time = time.time() - train_start

        # Evaluate
        window_size = hyperparams.get("window_size", 30) if model_type in SEQUENCE_MODEL_TYPES else None
        metrics = evaluate_model(model, x_test, y_test, window_size)

        # Profile
        if model_type in SEQUENCE_MODEL_TYPES:
            ws = hyperparams.get("window_size", 30)
            sample = x_test[:ws].reshape(1, ws, x_test.shape[1])
        else:
            sample = x_test[:1]

        profile = profile_model(model, sample, accuracy=metrics["accuracy"])

        # Log to W&B
        profiling_dict = {
            "inference_latency_ms": profile.inference_latency_ms,
            "inference_latency_p95_ms": profile.inference_latency_p95_ms,
            "peak_memory_mb": profile.peak_memory_mb,
            "model_size_mb": profile.model_size_mb,
            "throughput_samples_per_sec": profile.throughput_samples_per_sec,
            "efficiency_score": profile.efficiency_score,
            "training_time_seconds": training_time,
        }
        tracker.log_final_results(metrics, profiling_dict)
        wandb_run_id = tracker.finish()

        # Store results
        run.accuracy = metrics["accuracy"]
        run.precision_score = metrics["precision"]
        run.recall = metrics["recall"]
        run.f1 = metrics["f1"]
        run.training_time_seconds = training_time
        run.inference_latency_ms = profile.inference_latency_ms
        run.inference_latency_p95_ms = profile.inference_latency_p95_ms
        run.peak_memory_mb = profile.peak_memory_mb
        run.model_size_mb = profile.model_size_mb
        run.throughput_samples_per_sec = profile.throughput_samples_per_sec
        run.efficiency_score = profile.efficiency_score
        run.wandb_run_id = wandb_run_id
        run.status = "completed"
        run.completed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(run)
        logger.info(
            "  ✓ %s — accuracy=%.4f  latency=%.2fms  efficiency=%.2f",
            run_name, metrics["accuracy"], profile.inference_latency_ms, profile.efficiency_score,
        )

    except Exception:
        tracker.finish()
        run.status = "failed"
        run.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.exception("  ✗ %s failed", run_name)
        raise

    return run


def finalize_experiment(db: Session, experiment: Experiment) -> None:
    """Update experiment status based on its runs."""
    all_runs = db.query(Run).filter(Run.experiment_id == experiment.id).all()
    statuses = {r.status for r in all_runs}
    if statuses == {"completed"}:
        experiment.status = "completed"
    elif "failed" in statuses:
        experiment.status = "failed"
    else:
        experiment.status = "partial"
    experiment.updated_at = datetime.now(timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Experiment 1: SPY direction prediction — all 6 models × 2 configs
# ---------------------------------------------------------------------------

def run_experiment_1(db: Session, spy_dataset: Dataset) -> Experiment:
    """SPY next-day direction prediction with all 6 model types."""
    logger.info("\n" + "=" * 60)
    logger.info("EXPERIMENT 1: SPY Direction Prediction (all 6 models × 2 configs)")
    logger.info("=" * 60)

    experiment = Experiment(
        name="SPY Direction Prediction",
        description="Binary next-day up/down classification on SPY 2020-2024 using all 6 model architectures with 2 hyperparameter variations each.",
        dataset_id=spy_dataset.id,
        status="running",
    )
    db.add(experiment)
    db.flush()

    df = pd.read_parquet(spy_dataset.s3_path)
    df = create_target(df)

    run_count = 0
    for model_type, configs in EXPERIMENT_1_CONFIGS.items():
        for idx, hp in enumerate(configs):
            variant = "A" if idx == 0 else "B"
            run_name = f"{model_type}-{variant}"
            logger.info("Running %s ...", run_name)
            run_single_training(db, experiment, run_name, model_type, hp, df)
            run_count += 1

    finalize_experiment(db, experiment)
    logger.info("Experiment 1 done: %d runs completed", run_count)
    return experiment


# ---------------------------------------------------------------------------
# Experiment 2: Multi-asset comparison — top 3 models on SPY, AAPL, QQQ
# ---------------------------------------------------------------------------

def run_experiment_2(
    db: Session,
    datasets: dict[str, Dataset],
    best_models: list[str],
) -> Experiment:
    """Compare top 3 models across SPY, AAPL, QQQ."""
    logger.info("\n" + "=" * 60)
    logger.info("EXPERIMENT 2: Multi-Asset Comparison (%s)", ", ".join(best_models))
    logger.info("=" * 60)

    experiment = Experiment(
        name="Multi-Asset Model Comparison",
        description=f"Comparing {', '.join(best_models)} across SPY, AAPL, QQQ to test generalization.",
        dataset_id=datasets["SPY"].id,
        status="running",
    )
    db.add(experiment)
    db.flush()

    run_count = 0
    for ticker, ds in datasets.items():
        df = pd.read_parquet(ds.s3_path)
        df = create_target(df)

        for model_type in best_models:
            hp = DEFAULT_CONFIGS[model_type].copy()
            # Use moderate epochs for speed
            if "epochs" in hp:
                hp["epochs"] = 30
            run_name = f"{model_type}-{ticker}"
            logger.info("Running %s ...", run_name)
            run_single_training(db, experiment, run_name, model_type, hp, df)
            run_count += 1

    finalize_experiment(db, experiment)
    logger.info("Experiment 2 done: %d runs completed", run_count)
    return experiment


# ---------------------------------------------------------------------------
# Experiment 3: Feature ablation — best model with different feature groups
# ---------------------------------------------------------------------------

# Feature groups for ablation study
FEATURE_GROUPS: dict[str, list[str]] = {
    "all": [],  # empty means use all features
    "technical-only": ["rsi", "macd_line", "macd_signal", "macd_histogram", "bb_upper", "bb_middle", "bb_lower"],
    "signal-processing-only": [
        "dominant_freq_1", "dominant_freq_2", "dominant_freq_3",
        "spectral_entropy", "snr", "autocorr_lag_1", "autocorr_lag_5", "autocorr_lag_10", "autocorr_lag_21",
    ],
    "technical-plus-signal": [
        "rsi", "macd_line", "macd_signal", "macd_histogram", "bb_upper", "bb_middle", "bb_lower",
        "dominant_freq_1", "dominant_freq_2", "dominant_freq_3",
        "spectral_entropy", "snr", "autocorr_lag_1", "autocorr_lag_5", "autocorr_lag_10", "autocorr_lag_21",
    ],
}


def run_experiment_3(
    db: Session,
    spy_dataset: Dataset,
    best_model: str,
) -> Experiment:
    """Feature ablation study — which feature groups matter most."""
    logger.info("\n" + "=" * 60)
    logger.info("EXPERIMENT 3: Feature Ablation (%s on SPY)", best_model)
    logger.info("=" * 60)

    experiment = Experiment(
        name="Feature Ablation Study",
        description=f"Testing {best_model} with different feature subsets (all, technical-only, signal-processing-only, price-only) on SPY.",
        dataset_id=spy_dataset.id,
        status="running",
    )
    db.add(experiment)
    db.flush()

    df = pd.read_parquet(spy_dataset.s3_path)
    df = create_target(df)

    hp = DEFAULT_CONFIGS[best_model].copy()
    if "epochs" in hp:
        hp["epochs"] = 30

    # Figure out which feature columns actually exist in the data
    exclude = {"Date", "Open", "High", "Low", "Close", "Volume", "ticker", "target"}
    all_features = [c for c in df.columns if c not in exclude]

    run_count = 0
    for group_name, feature_list in FEATURE_GROUPS.items():
        if group_name == "all":
            subset = None  # use all features
        else:
            # Filter to features that actually exist in the dataset
            subset = [f for f in feature_list if f in all_features]
            if not subset:
                logger.warning("  Skipping '%s' — no matching features in dataset", group_name)
                continue

        run_name = f"{best_model}-{group_name}"
        logger.info("Running %s (%d features) ...", run_name, len(subset) if subset else len(all_features))
        run_single_training(db, experiment, run_name, best_model, hp, df, feature_subset=subset)
        run_count += 1

    finalize_experiment(db, experiment)
    logger.info("Experiment 3 done: %d runs completed", run_count)
    return experiment


# ---------------------------------------------------------------------------
# Pick top models from Experiment 1 results
# ---------------------------------------------------------------------------

def get_top_models(db: Session, experiment_id: UUID, top_n: int = 3) -> list[str]:
    """Return the top N model types by accuracy from a completed experiment."""
    runs = (
        db.query(Run)
        .filter(Run.experiment_id == experiment_id, Run.status == "completed")
        .order_by(Run.accuracy.desc())
        .all()
    )
    # Pick best per model type, take top N distinct types
    seen: set[str] = set()
    best: list[str] = []
    for run in runs:
        if run.model_type not in seen:
            seen.add(run.model_type)
            best.append(run.model_type)
        if len(best) >= top_n:
            break
    return best


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    """Run all 3 experiments sequentially."""
    start_time = time.time()

    logger.info("=" * 60)
    logger.info("Forge — Real Experiments Runner")
    logger.info("=" * 60)
    logger.info("DATABASE_URL: %s", os.getenv("DATABASE_URL", "(default local)"))

    db = SessionLocal()
    try:
        # 1. Ensure datasets exist
        logger.info("\n--- Ensuring Datasets ---")
        spy = ensure_dataset(db, "SPY 2020-2024", ["SPY"], date(2020, 1, 1), date(2024, 12, 31))
        aapl = ensure_dataset(db, "AAPL 2020-2024", ["AAPL"], date(2020, 1, 1), date(2024, 12, 31))
        qqq = ensure_dataset(db, "QQQ 2020-2024", ["QQQ"], date(2020, 1, 1), date(2024, 12, 31))

        datasets = {"SPY": spy, "AAPL": aapl, "QQQ": qqq}

        # 2. Experiment 1: SPY all models
        exp1 = run_experiment_1(db, spy)

        # 3. Pick top 3 models from Experiment 1
        top_models = get_top_models(db, exp1.id, top_n=3)
        logger.info("\nTop 3 models from Experiment 1: %s", top_models)

        # 4. Experiment 2: Multi-asset with top 3
        exp2 = run_experiment_2(db, datasets, top_models)

        # 5. Experiment 3: Feature ablation with best model
        best_model = top_models[0] if top_models else "xgboost"
        exp3 = run_experiment_3(db, spy, best_model)

        # Summary
        elapsed = time.time() - start_time
        total_runs = (
            db.query(Run)
            .filter(Run.experiment_id.in_([exp1.id, exp2.id, exp3.id]))
            .filter(Run.status == "completed")
            .count()
        )

        logger.info("\n" + "=" * 60)
        logger.info("ALL EXPERIMENTS COMPLETE")
        logger.info("  Total runs:    %d", total_runs)
        logger.info("  Total time:    %.1f seconds", elapsed)
        logger.info("  Experiment 1:  %s (id=%s)", exp1.name, exp1.id)
        logger.info("  Experiment 2:  %s (id=%s)", exp2.name, exp2.id)
        logger.info("  Experiment 3:  %s (id=%s)", exp3.name, exp3.id)
        logger.info("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    main()
