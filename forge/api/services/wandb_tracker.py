"""Weights & Biases experiment tracking service.

Wraps W&B logging with graceful degradation — if WANDB_API_KEY is not set
or the wandb package is unavailable, all operations become no-ops.
"""

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Check availability at import time
# ---------------------------------------------------------------------------

_WANDB_AVAILABLE = False
_wandb = None

try:
    import wandb as _wandb_module

    if os.getenv("WANDB_API_KEY"):
        _WANDB_AVAILABLE = True
        _wandb = _wandb_module
    else:
        logger.info("WANDB_API_KEY not set — W&B tracking disabled")
except ImportError:
    logger.info("wandb package not installed — W&B tracking disabled")


def is_enabled() -> bool:
    """Return True if W&B tracking is available and configured."""
    return _WANDB_AVAILABLE


# ---------------------------------------------------------------------------
# Tracker class — real or no-op depending on availability
# ---------------------------------------------------------------------------


class WandbTracker:
    """Manages a single W&B run lifecycle: init → log → finish.

    If W&B is disabled, every method is a silent no-op.
    """

    def __init__(self) -> None:
        self._run: Any = None

    def init_run(
        self,
        project: str,
        experiment_name: str,
        model_type: str,
        hyperparameters: dict,
        tags: list[str] | None = None,
    ) -> None:
        """Initialize a W&B run with experiment metadata.

        Args:
            project: W&B project name (e.g. "forge").
            experiment_name: Human-readable experiment name.
            model_type: Model architecture identifier.
            hyperparameters: Full hyperparameter dict logged as W&B config.
            tags: Optional tags for filtering runs in the dashboard.
        """
        if not _WANDB_AVAILABLE:
            return

        self._run = _wandb.init(
            project=project,
            name=f"{experiment_name}/{model_type}",
            config=hyperparameters,
            tags=tags or [model_type],
            reinit=True,
        )
        logger.info("W&B run initialized: %s", self._run.id)

    def log_epoch_metrics(
        self, epoch: int, train_loss: float, val_loss: float
    ) -> None:
        """Log per-epoch training and validation loss.

        Called during LSTM training to track the loss curve in W&B.

        Args:
            epoch: Current epoch number (1-indexed).
            train_loss: Average training loss for this epoch.
            val_loss: Validation loss for this epoch.
        """
        if self._run is None:
            return

        self._run.log({
            "epoch": epoch,
            "train_loss": train_loss,
            "val_loss": val_loss,
        })

    def log_final_results(
        self, metrics: dict, profiling: dict
    ) -> None:
        """Log final evaluation metrics and hardware profiling results to W&B.

        This is called once after training completes. It should log both
        the ML metrics (accuracy, precision, recall, f1) and the profiling
        results (latency, memory, throughput, efficiency) to W&B's summary.

        Args:
            metrics: Dict with keys like 'accuracy', 'precision', 'recall', 'f1'.
            profiling: Dict with keys like 'inference_latency_ms', 'peak_memory_mb',
                      'throughput_samples_per_sec', 'efficiency_score', etc.
        """
        if self._run is None:
            return
        
        prefixed_profiling = {f"profile/{k}": v for k, v in profiling.items()}
        
        all_results = {**metrics, **prefixed_profiling}
        
        self._run.log(all_results)
        self._run.summary.update(all_results)

    def finish(self) -> str | None:
        """Finish the W&B run and return its run ID.

        Returns:
            The W&B run ID string, or None if tracking was disabled.
        """
        if self._run is None:
            return None

        run_id = self._run.id
        self._run.finish()
        logger.info("W&B run finished: %s", run_id)
        self._run = None
        return run_id
