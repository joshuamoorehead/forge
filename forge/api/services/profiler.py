"""Hardware-aware model profiling service.

Measures inference latency, memory footprint, model size, throughput,
and computes an efficiency score for deployment tradeoff analysis.
"""

import io
import logging
import pickle
import time
import tracemalloc
from dataclasses import dataclass

import numpy as np
import torch

logger = logging.getLogger(__name__)

WARMUP_ITERATIONS = 10
DEFAULT_ITERATIONS = 100


@dataclass
class ProfileResult:
    """Container for hardware profiling measurements."""

    inference_latency_ms: float
    inference_latency_p95_ms: float
    peak_memory_mb: float
    model_size_mb: float
    throughput_samples_per_sec: float
    efficiency_score: float


def get_model_size_mb(model: object) -> float:
    """Compute serialized model size in megabytes.

    Uses pickle for sklearn/xgboost models and torch state_dict for PyTorch.
    """
    if isinstance(model, torch.nn.Module):
        buffer = io.BytesIO()
        torch.save(model.state_dict(), buffer)
        size_bytes = buffer.tell()
    else:
        buffer = io.BytesIO()
        pickle.dump(model, buffer)
        size_bytes = buffer.tell()
    return size_bytes / (1024 * 1024)


def _predict(model: object, sample_input: np.ndarray) -> None:
    """Call the appropriate prediction method based on model type."""
    if isinstance(model, torch.nn.Module):
        with torch.no_grad():
            tensor_input = torch.tensor(sample_input, dtype=torch.float32)
            model(tensor_input)
    else:
        model.predict(sample_input)


def profile_model(
    model: object,
    sample_input: np.ndarray,
    accuracy: float = 0.0,
    n_iterations: int = DEFAULT_ITERATIONS,
) -> ProfileResult:
    """Run hardware-aware profiling on a trained model.

    Measures latency distribution, memory footprint, throughput,
    and computes an efficiency score relative to accuracy.

    Args:
        model: A trained model (sklearn, xgboost, or PyTorch nn.Module).
        sample_input: Representative input array for inference.
        accuracy: Model accuracy used to compute efficiency score.
        n_iterations: Number of inference iterations for latency measurement.

    Returns:
        ProfileResult with all profiling metrics populated.
    """
    if isinstance(model, torch.nn.Module):
        model.eval()

    # Warmup — let caches and JIT settle
    for _ in range(WARMUP_ITERATIONS):
        _predict(model, sample_input)

    # Latency profiling with memory tracking
    tracemalloc.start()
    latencies: list[float] = []

    for _ in range(n_iterations):
        start = time.perf_counter_ns()
        _predict(model, sample_input)
        end = time.perf_counter_ns()
        latencies.append((end - start) / 1e6)  # ns → ms

    _, peak_bytes = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    latency_array = np.array(latencies)
    mean_latency = float(np.mean(latency_array))
    p95_latency = float(np.percentile(latency_array, 95))
    peak_memory_mb = peak_bytes / (1024 * 1024)
    model_size_mb = get_model_size_mb(model)
    throughput = 1000.0 / mean_latency if mean_latency > 0 else 0.0

    efficiency = compute_efficiency_score(accuracy, mean_latency, peak_memory_mb)

    return ProfileResult(
        inference_latency_ms=mean_latency,
        inference_latency_p95_ms=p95_latency,
        peak_memory_mb=peak_memory_mb,
        model_size_mb=model_size_mb,
        throughput_samples_per_sec=throughput,
        efficiency_score=efficiency,
    )


def compute_efficiency_score(
    accuracy: float, latency_ms: float, memory_mb: float
) -> float:
    """Compute deployment efficiency: accuracy / (normalized_latency * normalized_memory).

    Normalizes latency to seconds and memory to GB so the score stays in a
    reasonable range.  Returns 0.0 when inputs would cause division by zero.
    """
    if latency_ms <= 0 or memory_mb <= 0:
        return 0.0

    normalized_latency = latency_ms / 1000.0  # ms → seconds
    normalized_memory = memory_mb / 1024.0     # MB → GB

    denominator = normalized_latency * normalized_memory
    if denominator == 0:
        return 0.0

    return accuracy / denominator
