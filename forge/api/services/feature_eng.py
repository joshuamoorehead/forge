"""Feature engineering service for financial time-series data.

Computes signal processing and technical analysis features using only
numpy and scipy — no external TA libraries.
"""

from typing import Any

import numpy as np
import pandas as pd
from numpy.typing import NDArray
from scipy import signal as scipy_signal


def fft_spectral_features(prices: NDArray[np.float64]) -> dict[str, Any]:
    """Compute FFT-based spectral features from a price series.

    Returns dominant frequencies, spectral entropy, and signal-to-noise ratio.
    The input is detrended before FFT to remove the DC component.
    """
    if len(prices) < 4:
        return {
            "dominant_freq_1": None,
            "dominant_freq_2": None,
            "dominant_freq_3": None,
            "spectral_entropy": None,
            "snr": None,
        }

    # Detrend to remove linear drift, then apply Hann window to reduce spectral leakage
    detrended = scipy_signal.detrend(prices)
    windowed = detrended * np.hanning(len(detrended))

    fft_vals = np.fft.rfft(windowed)
    power_spectrum = np.abs(fft_vals) ** 2
    freqs = np.fft.rfftfreq(len(windowed))

    # Skip DC component (index 0)
    power_no_dc = power_spectrum[1:]
    freqs_no_dc = freqs[1:]

    if len(power_no_dc) == 0 or power_no_dc.sum() == 0:
        return {
            "dominant_freq_1": None,
            "dominant_freq_2": None,
            "dominant_freq_3": None,
            "spectral_entropy": None,
            "snr": None,
        }

    # Top 3 dominant frequencies by power
    top_indices = np.argsort(power_no_dc)[::-1][:3]
    dominant_freqs = [float(freqs_no_dc[i]) for i in top_indices]
    while len(dominant_freqs) < 3:
        dominant_freqs.append(None)

    # Spectral entropy — measures how "spread out" the power spectrum is
    psd_norm = power_no_dc / power_no_dc.sum()
    psd_norm = psd_norm[psd_norm > 0]
    spectral_entropy = float(-np.sum(psd_norm * np.log2(psd_norm)))

    # SNR — ratio of peak signal power to mean noise floor
    peak_power = power_no_dc.max()
    mean_power = power_no_dc.mean()
    snr = float(10 * np.log10(peak_power / mean_power)) if mean_power > 0 else 0.0

    return {
        "dominant_freq_1": dominant_freqs[0],
        "dominant_freq_2": dominant_freqs[1],
        "dominant_freq_3": dominant_freqs[2],
        "spectral_entropy": spectral_entropy,
        "snr": snr,
    }


def rolling_autocorrelation(
    prices: NDArray[np.float64], lags: list[int] | None = None
) -> dict[str, float | None]:
    """Compute autocorrelation of returns at specified lags.

    Uses the Pearson correlation between the series and its lagged version.
    """
    if lags is None:
        lags = [1, 5, 10, 21]

    returns = np.diff(prices) / prices[:-1]

    result: dict[str, float | None] = {}
    for lag in lags:
        if len(returns) <= lag:
            result[f"autocorr_lag_{lag}"] = None
            continue
        series = returns[lag:]
        lagged = returns[:-lag]
        if np.std(series) == 0 or np.std(lagged) == 0:
            result[f"autocorr_lag_{lag}"] = 0.0
        else:
            result[f"autocorr_lag_{lag}"] = float(np.corrcoef(series, lagged)[0, 1])
    return result


def compute_rsi(prices: NDArray[np.float64], period: int = 14) -> NDArray[np.float64]:
    """Compute Relative Strength Index using exponential moving average of gains/losses."""
    if len(prices) < period + 1:
        return np.full(len(prices), np.nan)

    deltas = np.diff(prices)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    rsi = np.full(len(prices), np.nan)

    # Seed with simple average for the first window
    avg_gain = gains[:period].mean()
    avg_loss = losses[:period].mean()

    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

        if avg_loss == 0:
            rsi[i + 1] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi[i + 1] = 100.0 - (100.0 / (1.0 + rs))

    return rsi


def compute_macd(
    prices: NDArray[np.float64],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> dict[str, NDArray[np.float64]]:
    """Compute MACD line, signal line, and histogram using EMA."""
    def ema(data: NDArray[np.float64], span: int) -> NDArray[np.float64]:
        """Compute exponential moving average."""
        alpha = 2.0 / (span + 1)
        result = np.empty_like(data)
        result[0] = data[0]
        for i in range(1, len(data)):
            result[i] = alpha * data[i] + (1 - alpha) * result[i - 1]
        return result

    if len(prices) < slow_period:
        nan_arr = np.full(len(prices), np.nan)
        return {"macd_line": nan_arr, "macd_signal": nan_arr, "macd_histogram": nan_arr}

    fast_ema = ema(prices, fast_period)
    slow_ema = ema(prices, slow_period)
    macd_line = fast_ema - slow_ema
    macd_signal = ema(macd_line, signal_period)
    macd_histogram = macd_line - macd_signal

    return {
        "macd_line": macd_line,
        "macd_signal": macd_signal,
        "macd_histogram": macd_histogram,
    }


def compute_bollinger_bands(
    prices: NDArray[np.float64], period: int = 20, num_std: float = 2.0
) -> dict[str, NDArray[np.float64]]:
    """Compute Bollinger Bands: middle (SMA), upper, and lower bands."""
    upper = np.full(len(prices), np.nan)
    middle = np.full(len(prices), np.nan)
    lower = np.full(len(prices), np.nan)

    for i in range(period - 1, len(prices)):
        window = prices[i - period + 1 : i + 1]
        sma = window.mean()
        std = window.std(ddof=0)
        middle[i] = sma
        upper[i] = sma + num_std * std
        lower[i] = sma - num_std * std

    return {"bb_upper": upper, "bb_middle": middle, "bb_lower": lower}


def compute_all_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute all features on an OHLCV DataFrame.

    Expects columns: Open, High, Low, Close, Volume.
    Returns the original DataFrame with feature columns appended.
    """
    close = df["Close"].values.astype(np.float64)
    result = df.copy()

    # RSI
    result["rsi"] = compute_rsi(close)

    # MACD
    macd = compute_macd(close)
    result["macd_line"] = macd["macd_line"]
    result["macd_signal"] = macd["macd_signal"]
    result["macd_histogram"] = macd["macd_histogram"]

    # Bollinger Bands
    bb = compute_bollinger_bands(close)
    result["bb_upper"] = bb["bb_upper"]
    result["bb_middle"] = bb["bb_middle"]
    result["bb_lower"] = bb["bb_lower"]

    # FFT spectral features — stored as scalar columns (same value per ticker)
    fft_features = fft_spectral_features(close)
    for key, value in fft_features.items():
        result[key] = value

    # Autocorrelation — also scalar per series
    autocorr = rolling_autocorrelation(close)
    for key, value in autocorr.items():
        result[key] = value

    return result
