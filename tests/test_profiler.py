"""Tests for the hardware-aware profiler service."""

import numpy as np
import pytest
from sklearn.tree import DecisionTreeClassifier

from forge.api.services.profiler import (
    ProfileResult,
    compute_efficiency_score,
    get_model_size_mb,
    profile_model,
)


@pytest.fixture
def dummy_sklearn_model() -> DecisionTreeClassifier:
    """Train a simple DecisionTree for profiling tests."""
    rng = np.random.RandomState(42)
    x = rng.randn(200, 5)
    y = (x[:, 0] > 0).astype(int)
    model = DecisionTreeClassifier(max_depth=3, random_state=42)
    model.fit(x, y)
    return model


@pytest.fixture
def sample_input() -> np.ndarray:
    """Single-row input for inference."""
    return np.random.RandomState(42).randn(1, 5).astype(np.float32)


class TestProfileModel:
    """Tests for the profile_model function."""

    def test_returns_profile_result(
        self, dummy_sklearn_model: DecisionTreeClassifier, sample_input: np.ndarray
    ) -> None:
        result = profile_model(dummy_sklearn_model, sample_input, accuracy=0.85, n_iterations=20)
        assert isinstance(result, ProfileResult)

    def test_all_fields_positive(
        self, dummy_sklearn_model: DecisionTreeClassifier, sample_input: np.ndarray
    ) -> None:
        result = profile_model(dummy_sklearn_model, sample_input, accuracy=0.85, n_iterations=20)
        assert result.inference_latency_ms > 0
        assert result.inference_latency_p95_ms > 0
        assert result.peak_memory_mb >= 0
        assert result.model_size_mb > 0
        assert result.throughput_samples_per_sec > 0

    def test_p95_gte_mean(
        self, dummy_sklearn_model: DecisionTreeClassifier, sample_input: np.ndarray
    ) -> None:
        result = profile_model(dummy_sklearn_model, sample_input, accuracy=0.85, n_iterations=50)
        assert result.inference_latency_p95_ms >= result.inference_latency_ms

    def test_efficiency_score_with_accuracy(
        self, dummy_sklearn_model: DecisionTreeClassifier, sample_input: np.ndarray
    ) -> None:
        result = profile_model(dummy_sklearn_model, sample_input, accuracy=0.9, n_iterations=20)
        assert result.efficiency_score > 0

    def test_efficiency_score_zero_accuracy(
        self, dummy_sklearn_model: DecisionTreeClassifier, sample_input: np.ndarray
    ) -> None:
        result = profile_model(dummy_sklearn_model, sample_input, accuracy=0.0, n_iterations=20)
        assert result.efficiency_score == 0.0


class TestGetModelSizeMb:
    """Tests for model serialization size."""

    def test_sklearn_model_has_size(self, dummy_sklearn_model: DecisionTreeClassifier) -> None:
        size = get_model_size_mb(dummy_sklearn_model)
        assert size > 0
        assert size < 100  # a tiny decision tree shouldn't be 100MB


class TestComputeEfficiencyScore:
    """Tests for the efficiency score formula."""

    def test_higher_accuracy_higher_score(self) -> None:
        low = compute_efficiency_score(0.5, 10.0, 100.0)
        high = compute_efficiency_score(0.9, 10.0, 100.0)
        assert high > low

    def test_higher_latency_lower_score(self) -> None:
        fast = compute_efficiency_score(0.8, 1.0, 100.0)
        slow = compute_efficiency_score(0.8, 100.0, 100.0)
        assert fast > slow

    def test_zero_latency_returns_zero(self) -> None:
        assert compute_efficiency_score(0.9, 0.0, 100.0) == 0.0

    def test_zero_memory_returns_zero(self) -> None:
        assert compute_efficiency_score(0.9, 10.0, 0.0) == 0.0
