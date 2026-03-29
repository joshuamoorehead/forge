"""Model training service — trains XGBoost, Random Forest, and LSTM models.

Handles time-series aware splitting, model training, evaluation,
hardware profiling, and storing results in the database.
"""

import logging
import time
from collections.abc import Callable
from datetime import datetime, timezone
from uuid import UUID

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sqlalchemy.orm import Session
from xgboost import XGBClassifier

from forge.api.models.database import Dataset, Experiment, Run
from forge.api.services.embeddings import embed_run
from forge.api.services.profiler import profile_model
from forge.api.services.s3_client import upload_model_artifact
from forge.api.services.wandb_tracker import WandbTracker

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Time-series split — chronological, no future leakage
# ---------------------------------------------------------------------------


def time_series_split(
    df: pd.DataFrame,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split a DataFrame chronologically into train / val / test sets.

    The data must already be sorted by time (oldest first). This function
    simply slices — no shuffling — to prevent future data leakage.

    Args:
        df: Time-ordered DataFrame.
        train_ratio: Fraction for training (default 0.70).
        val_ratio: Fraction for validation (default 0.15).

    Returns:
        Tuple of (train_df, val_df, test_df).
    """
    n = len(df)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    train_df = df.iloc[:train_end].copy()
    val_df = df.iloc[train_end:val_end].copy()
    test_df = df.iloc[val_end:].copy()

    return train_df, val_df, test_df


# ---------------------------------------------------------------------------
# Target engineering — binary classification: price goes up (1) or down (0)
# ---------------------------------------------------------------------------


def create_target(df: pd.DataFrame, column: str = "Close") -> pd.DataFrame:
    """Add a binary target column: 1 if next-day close > today's close, else 0.

    Drops the last row (which has no future to predict).
    """
    df = df.copy()
    df["target"] = (df[column].shift(-1) > df[column]).astype(int)
    df = df.iloc[:-1]  # last row has no target
    return df


# ---------------------------------------------------------------------------
# Feature / target extraction helpers
# ---------------------------------------------------------------------------

EXCLUDE_COLS = {"Date", "Open", "High", "Low", "Close", "Volume", "ticker", "target"}


def extract_xy(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Extract feature matrix X and target vector y from a prepared DataFrame."""
    feature_cols = [c for c in df.columns if c not in EXCLUDE_COLS]
    x = df[feature_cols].values.astype(np.float32)
    y = df["target"].values.astype(np.float32)
    # Replace NaN/Inf with 0 for model safety
    x = np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)
    return x, y


# ---------------------------------------------------------------------------
# LSTM model definition
# ---------------------------------------------------------------------------


class TimeSeriesLSTM(nn.Module):
    """2-layer LSTM for binary classification on financial time-series."""

    def __init__(
        self,
        input_size: int,
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout,
            batch_first=True
        )
        self.fc = nn.Linear(hidden_size, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass: x shape (batch, seq_len, input_size) → (batch, 1)."""
        lstm_out, (hidden, cell) = self.lstm(x)
        last_hidden = hidden[-1]
        output = self.sigmoid(self.fc(last_hidden))
        return output


# ---------------------------------------------------------------------------
# Model trainers
# ---------------------------------------------------------------------------


def train_xgboost(
    x_train: np.ndarray,
    y_train: np.ndarray,
    x_val: np.ndarray,
    y_val: np.ndarray,
    hyperparams: dict,
) -> XGBClassifier:
    """Train an XGBoost classifier with early stopping on validation set."""
    params = {
        "n_estimators": hyperparams.get("n_estimators", 500),
        "max_depth": hyperparams.get("max_depth", 6),
        "learning_rate": hyperparams.get("learning_rate", 0.1),
        "eval_metric": "logloss",
        "early_stopping_rounds": hyperparams.get("early_stopping_rounds", 20),
        "verbosity": 0,
    }
    model = XGBClassifier(**params)
    model.fit(x_train, y_train, eval_set=[(x_val, y_val)], verbose=False)
    return model


def train_random_forest(
    x_train: np.ndarray,
    y_train: np.ndarray,
    hyperparams: dict,
) -> RandomForestClassifier:
    """Train a Random Forest classifier."""
    params = {
        "n_estimators": hyperparams.get("n_estimators", 200),
        "max_depth": hyperparams.get("max_depth", 10),
        "min_samples_split": hyperparams.get("min_samples_split", 5),
        "n_jobs": -1,
        "random_state": 42,
    }
    model = RandomForestClassifier(**params)
    model.fit(x_train, y_train)
    return model


def _build_lstm_sequences(
    x: np.ndarray, y: np.ndarray, window_size: int
) -> tuple[np.ndarray, np.ndarray]:
    """Convert flat feature arrays into overlapping sequences for LSTM input.

    Produces arrays of shape (n_samples - window_size, window_size, n_features)
    and (n_samples - window_size,).
    """
    sequences, targets = [], []
    for i in range(window_size, len(x)):
        sequences.append(x[i - window_size : i])
        targets.append(y[i])
    return np.array(sequences), np.array(targets)


def train_lstm(
    x_train: np.ndarray,
    y_train: np.ndarray,
    x_val: np.ndarray,
    y_val: np.ndarray,
    hyperparams: dict,
    epoch_callback: Callable[[int, float, float], None] | None = None,
) -> TimeSeriesLSTM:
    """Train a 2-layer LSTM for binary classification.

    Converts flat features into windowed sequences, trains with BCE loss,
    and uses early stopping based on validation loss.
    """
    window_size = hyperparams.get("window_size", 30)
    hidden_size = hyperparams.get("hidden_size", 128)
    num_layers = hyperparams.get("num_layers", 2)
    dropout = hyperparams.get("dropout", 0.2)
    lr = hyperparams.get("learning_rate", 0.001)
    epochs = hyperparams.get("epochs", 50)
    batch_size = hyperparams.get("batch_size", 32)

    x_train_seq, y_train_seq = _build_lstm_sequences(x_train, y_train, window_size)
    x_val_seq, y_val_seq = _build_lstm_sequences(x_val, y_val, window_size)

    input_size = x_train_seq.shape[2]
    model = TimeSeriesLSTM(input_size, hidden_size, num_layers, dropout)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.BCELoss()

    x_train_t = torch.tensor(x_train_seq, dtype=torch.float32)
    y_train_t = torch.tensor(y_train_seq, dtype=torch.float32).unsqueeze(1)
    x_val_t = torch.tensor(x_val_seq, dtype=torch.float32)
    y_val_t = torch.tensor(y_val_seq, dtype=torch.float32).unsqueeze(1)

    best_val_loss = float("inf")
    patience = 5
    patience_counter = 0

    model.train()
    for epoch in range(epochs):
        # Mini-batch training
        indices = torch.randperm(len(x_train_t))
        epoch_loss = 0.0
        n_batches = 0

        for start in range(0, len(x_train_t), batch_size):
            batch_idx = indices[start : start + batch_size]
            x_batch = x_train_t[batch_idx]
            y_batch = y_train_t[batch_idx]

            optimizer.zero_grad()
            predictions = model(x_batch)
            loss = criterion(predictions, y_batch)
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            n_batches += 1

        # Validation
        model.eval()
        with torch.no_grad():
            val_preds = model(x_val_t)
            val_loss = criterion(val_preds, y_val_t).item()
        model.train()

        avg_train_loss = epoch_loss / max(n_batches, 1)
        logger.info(
            "Epoch %d/%d — train_loss=%.4f val_loss=%.4f",
            epoch + 1, epochs, avg_train_loss, val_loss,
        )

        if epoch_callback is not None:
            epoch_callback(epoch + 1, avg_train_loss, val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= patience:
                logger.info("Early stopping at epoch %d", epoch + 1)
                break

    model.eval()
    return model


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------


def evaluate_model(
    model: object,
    x_test: np.ndarray,
    y_test: np.ndarray,
    window_size: int | None = None,
) -> dict:
    """Compute classification metrics on the test set.

    Returns dict with accuracy, precision, recall, and f1.
    """
    if isinstance(model, torch.nn.Module):
        x_seq, y_seq = _build_lstm_sequences(x_test, y_test, window_size or 30)
        with torch.no_grad():
            preds_prob = model(torch.tensor(x_seq, dtype=torch.float32))
            preds = (preds_prob.squeeze().numpy() >= 0.5).astype(int)
        y_true = y_seq.astype(int)
    else:
        preds = model.predict(x_test).astype(int)
        y_true = y_test.astype(int)

    return {
        "accuracy": float(accuracy_score(y_true, preds)),
        "precision": float(precision_score(y_true, preds, zero_division=0)),
        "recall": float(recall_score(y_true, preds, zero_division=0)),
        "f1": float(f1_score(y_true, preds, zero_division=0)),
    }


# ---------------------------------------------------------------------------
# Run orchestrator
# ---------------------------------------------------------------------------

def _make_trainers(
    epoch_callback: Callable[[int, float, float], None] | None = None,
) -> dict:
    """Build trainer dispatch dict, threading epoch_callback to LSTM."""
    return {
        "xgboost": lambda xt, yt, xv, yv, hp: train_xgboost(xt, yt, xv, yv, hp),
        "random_forest": lambda xt, yt, xv, yv, hp: train_random_forest(xt, yt, hp),
        "lstm": lambda xt, yt, xv, yv, hp: train_lstm(xt, yt, xv, yv, hp, epoch_callback),
    }


def run_experiment_run(run_id: UUID, db: Session) -> Run:
    """Execute a single training run: load data → split → train → profile → log → store.

    Integrates W&B tracking and S3 artifact upload. Both are optional —
    if credentials are missing, training still completes normally.

    Args:
        run_id: The UUID of the Run record to execute.
        db: Active database session.

    Returns:
        The updated Run record with metrics and profiling results.
    """
    run = db.query(Run).filter(Run.id == run_id).first()
    if run is None:
        raise ValueError(f"Run {run_id} not found")

    experiment = db.query(Experiment).filter(Experiment.id == run.experiment_id).first()
    if experiment is None:
        raise ValueError(f"Experiment {run.experiment_id} not found")

    dataset = db.query(Dataset).filter(Dataset.id == experiment.dataset_id).first()
    if dataset is None:
        raise ValueError(f"Dataset {experiment.dataset_id} not found")

    # Mark run as started
    run.status = "running"
    run.started_at = datetime.now(timezone.utc)
    db.commit()

    # Initialize W&B tracker (no-op if disabled)
    tracker = WandbTracker()
    hyperparams = run.hyperparameters or {}
    tracker.init_run(
        project="forge",
        experiment_name=experiment.name,
        model_type=run.model_type,
        hyperparameters=hyperparams,
        tags=[run.model_type, dataset.name],
    )

    try:
        # Load data from parquet
        df = pd.read_parquet(dataset.s3_path)
        df = create_target(df)

        # Time-series split
        train_df, val_df, test_df = time_series_split(df)
        x_train, y_train = extract_xy(train_df)
        x_val, y_val = extract_xy(val_df)
        x_test, y_test = extract_xy(test_df)

        # Train — pass epoch callback for W&B logging
        model_type = run.model_type
        trainers = _make_trainers(epoch_callback=tracker.log_epoch_metrics)
        if model_type not in trainers:
            raise ValueError(f"Unsupported model type: {model_type}")

        train_start = time.time()
        model = trainers[model_type](x_train, y_train, x_val, y_val, hyperparams)
        training_time = time.time() - train_start

        # Evaluate
        window_size = hyperparams.get("window_size", 30) if model_type == "lstm" else None
        metrics = evaluate_model(model, x_test, y_test, window_size)

        # Profile
        if model_type == "lstm":
            sample = x_test[:window_size].reshape(1, window_size, x_test.shape[1])
        else:
            sample = x_test[:1]

        profile = profile_model(model, sample, accuracy=metrics["accuracy"])

        # Log final results to W&B
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

        # Upload model artifact to S3
        s3_path = upload_model_artifact(model, run_id, model_type)

        # Finish W&B run and capture run ID
        wandb_run_id = tracker.finish()

        # Store results
        run.train_loss = None  # only tracked per-epoch for LSTM
        run.val_loss = None
        run.test_loss = None
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
        run.s3_artifact_path = s3_path
        run.status = "completed"
        run.completed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(run)
        logger.info("Run %s completed — accuracy=%.4f", run_id, metrics["accuracy"])

        # Generate and store embedding for semantic search (best-effort)
        try:
            embed_run(run_id, db)
        except Exception:
            logger.warning("Failed to generate embedding for run %s", run_id, exc_info=True)

    except Exception:
        tracker.finish()  # clean up W&B run on failure
        run.status = "failed"
        run.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.exception("Run %s failed", run_id)
        raise

    return run
