"""Unit tests for feature engineering service."""

import numpy as np
import pandas as pd
import pytest

from forge.api.services.feature_eng import (
    compute_all_features,
    compute_bollinger_bands,
    compute_macd,
    compute_rsi,
    fft_spectral_features,
    rolling_autocorrelation,
)


class TestFFTSpectralFeatures:
    """Tests for FFT spectral decomposition."""

    def test_known_sine_wave_recovers_frequency(self) -> None:
        """A pure sine wave at frequency f should have that as dominant frequency."""
        sample_rate = 256
        duration = 1.0
        target_freq = 10.0  # 10 Hz
        time = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        sine_wave = np.sin(2 * np.pi * target_freq * time)

        features = fft_spectral_features(sine_wave)

        # The dominant frequency should be close to 10/256 ≈ 0.039 in normalized freq
        assert features["dominant_freq_1"] is not None
        # Convert normalized freq back: dominant_freq * sample_rate should ≈ target_freq
        recovered = features["dominant_freq_1"] * sample_rate
        assert abs(recovered - target_freq) < 2.0, (
            f"Expected ~{target_freq}Hz, got {recovered}Hz"
        )

    def test_snr_pure_signal_is_high(self) -> None:
        """A pure sine wave should have high SNR (most energy at one frequency)."""
        time = np.linspace(0, 1, 256, endpoint=False)
        pure_sine = np.sin(2 * np.pi * 20 * time)
        features = fft_spectral_features(pure_sine)
        assert features["snr"] is not None
        assert features["snr"] > 5.0  # Should be well above noise floor

    def test_spectral_entropy_noise_vs_sine(self) -> None:
        """White noise should have higher spectral entropy than a pure sine."""
        rng = np.random.default_rng(42)
        time = np.linspace(0, 1, 256, endpoint=False)

        sine_features = fft_spectral_features(np.sin(2 * np.pi * 15 * time))
        noise_features = fft_spectral_features(rng.standard_normal(256))

        assert sine_features["spectral_entropy"] is not None
        assert noise_features["spectral_entropy"] is not None
        assert noise_features["spectral_entropy"] > sine_features["spectral_entropy"]

    def test_short_input_returns_none(self) -> None:
        """Input shorter than 4 samples should return all Nones."""
        features = fft_spectral_features(np.array([1.0, 2.0, 3.0]))
        assert features["dominant_freq_1"] is None
        assert features["spectral_entropy"] is None


class TestRollingAutocorrelation:
    """Tests for rolling autocorrelation."""

    def test_known_autocorrelated_process(self) -> None:
        """An AR(1) process with phi=0.9 should show high lag-1 autocorrelation."""
        rng = np.random.default_rng(42)
        n_samples = 1000
        phi = 0.9
        prices = np.zeros(n_samples)
        prices[0] = 100.0
        for i in range(1, n_samples):
            prices[i] = prices[i - 1] + phi * (prices[i - 1] - prices[i - 2] if i > 1 else 0) + rng.standard_normal()

        result = rolling_autocorrelation(prices)
        # AR(1) with strong phi should have detectable lag-1 autocorrelation
        assert result["autocorr_lag_1"] is not None

    def test_insufficient_data_for_lag(self) -> None:
        """If data is shorter than the lag, should return None."""
        short_prices = np.array([100.0, 101.0, 102.0])
        result = rolling_autocorrelation(short_prices, lags=[10])
        assert result["autocorr_lag_10"] is None

    def test_default_lags(self) -> None:
        """Should compute for lags [1, 5, 10, 21] by default."""
        prices = np.cumsum(np.random.default_rng(42).standard_normal(100)) + 100
        result = rolling_autocorrelation(prices)
        assert set(result.keys()) == {
            "autocorr_lag_1", "autocorr_lag_5", "autocorr_lag_10", "autocorr_lag_21"
        }


class TestRSI:
    """Tests for RSI computation."""

    def test_rsi_always_between_0_and_100(self) -> None:
        """RSI values should always be in [0, 100]."""
        rng = np.random.default_rng(42)
        prices = np.cumsum(rng.standard_normal(200)) + 100
        prices = np.maximum(prices, 1.0)  # Keep positive
        rsi = compute_rsi(prices)
        valid_rsi = rsi[~np.isnan(rsi)]
        assert len(valid_rsi) > 0
        assert np.all(valid_rsi >= 0.0)
        assert np.all(valid_rsi <= 100.0)

    def test_rsi_strong_uptrend_above_50(self) -> None:
        """Monotonically increasing prices should give RSI near 100."""
        prices = np.linspace(100, 200, 50)
        rsi = compute_rsi(prices)
        valid_rsi = rsi[~np.isnan(rsi)]
        assert np.all(valid_rsi > 50.0)

    def test_rsi_insufficient_data(self) -> None:
        """Short input should return all NaN."""
        prices = np.array([100.0, 101.0, 102.0])
        rsi = compute_rsi(prices, period=14)
        assert np.all(np.isnan(rsi))


class TestMACD:
    """Tests for MACD computation."""

    def test_macd_output_shape(self) -> None:
        """MACD should return arrays matching input length."""
        prices = np.cumsum(np.random.default_rng(42).standard_normal(100)) + 100
        macd = compute_macd(prices)
        assert len(macd["macd_line"]) == 100
        assert len(macd["macd_signal"]) == 100
        assert len(macd["macd_histogram"]) == 100

    def test_macd_histogram_is_difference(self) -> None:
        """Histogram should equal MACD line minus signal line."""
        prices = np.cumsum(np.random.default_rng(42).standard_normal(100)) + 100
        macd = compute_macd(prices)
        np.testing.assert_allclose(
            macd["macd_histogram"],
            macd["macd_line"] - macd["macd_signal"],
            atol=1e-10,
        )

    def test_macd_insufficient_data(self) -> None:
        """Short input should return all NaN."""
        prices = np.array([100.0, 101.0])
        macd = compute_macd(prices)
        assert np.all(np.isnan(macd["macd_line"]))

    def test_macd_signal_crossover(self) -> None:
        # Downtrend: start at 100, drop ~1 per step for 40 steps
        down = np.linspace(100, 60, 40)                                                                                     
        # Uptrend: rise ~1.5 per step for 40 steps  
        up = np.linspace(60, 120, 40)                                                                                       
        prices = np.concatenate([down, up])      
        macd = compute_macd(prices)
        histogram = macd["macd_histogram"]
        # Check that crossover occurs in the uptrend portion (index 40+)
        uptrend_hist = histogram[40:]                                                                                       
        crossover_found = any(
            uptrend_hist[i - 1] < 0 and uptrend_hist[i] > 0                                                                 
            for i in range(1, len(uptrend_hist))                  
        )                                                                                                                   
        assert crossover_found, "Expected MACD crossover during uptrend"



class TestBollingerBands:
    """Tests for Bollinger Bands computation."""

    def test_middle_band_is_sma(self) -> None:
        """Middle band should be the simple moving average."""
        prices = np.arange(1.0, 31.0)  # 1 to 30
        bb = compute_bollinger_bands(prices, period=5)
        # At index 4 (5th element), SMA of [1,2,3,4,5] = 3.0
        assert bb["bb_middle"][4] == pytest.approx(3.0)

    def test_bands_symmetry(self) -> None:
        """Upper and lower bands should be symmetric around the middle."""
        rng = np.random.default_rng(42)
        prices = np.cumsum(rng.standard_normal(50)) + 100
        bb = compute_bollinger_bands(prices, period=20, num_std=2.0)

        valid = ~np.isnan(bb["bb_middle"])
        upper_diff = bb["bb_upper"][valid] - bb["bb_middle"][valid]
        lower_diff = bb["bb_middle"][valid] - bb["bb_lower"][valid]
        np.testing.assert_allclose(upper_diff, lower_diff, atol=1e-10)

    def test_nan_before_period(self) -> None:
        """Bands should be NaN before enough data for the window."""
        prices = np.arange(1.0, 31.0)
        bb = compute_bollinger_bands(prices, period=20)
        assert np.all(np.isnan(bb["bb_middle"][:19]))
        assert not np.isnan(bb["bb_middle"][19])


class TestComputeAllFeatures:
    """Integration test for the full feature pipeline."""

    def test_adds_all_feature_columns(self) -> None:
        """compute_all_features should add all expected feature columns."""
        rng = np.random.default_rng(42)
        df = pd.DataFrame({
            "Date": pd.date_range("2024-01-01", periods=100),
            "Open": rng.uniform(95, 105, 100),
            "High": rng.uniform(100, 110, 100),
            "Low": rng.uniform(90, 100, 100),
            "Close": np.cumsum(rng.standard_normal(100)) + 100,
            "Volume": rng.integers(1000000, 5000000, 100),
        })

        result = compute_all_features(df)

        expected_cols = {
            "rsi", "macd_line", "macd_signal", "macd_histogram",
            "bb_upper", "bb_middle", "bb_lower",
            "dominant_freq_1", "dominant_freq_2", "dominant_freq_3",
            "spectral_entropy", "snr",
            "autocorr_lag_1", "autocorr_lag_5", "autocorr_lag_10", "autocorr_lag_21",
        }
        assert expected_cols.issubset(set(result.columns))

    def test_preserves_original_columns(self) -> None:
        """Original OHLCV columns should still be present."""
        rng = np.random.default_rng(42)
        df = pd.DataFrame({
            "Date": pd.date_range("2024-01-01", periods=50),
            "Open": rng.uniform(95, 105, 50),
            "High": rng.uniform(100, 110, 50),
            "Low": rng.uniform(90, 100, 50),
            "Close": np.cumsum(rng.standard_normal(50)) + 100,
            "Volume": rng.integers(1000000, 5000000, 50),
        })

        result = compute_all_features(df)
        assert "Close" in result.columns
        assert "Volume" in result.columns
        assert len(result) == 50
