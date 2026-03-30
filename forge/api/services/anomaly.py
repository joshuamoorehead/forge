"""Anomaly detection for ops monitoring using rolling z-scores."""

import numpy as np


def compute_rolling_zscores(
    values: list[float],
    window: int = 20,
) -> list[float]:
    """Compute rolling z-scores for a list of numeric values.

    For each value, the z-score is calculated relative to the preceding
    `window` values. Values within the first `window` entries use all
    available prior values. Returns 0.0 when standard deviation is zero
    (i.e., all values in the window are identical).

    Args:
        values: Ordered list of numeric values (e.g., cost_usd over time).
        window: Number of preceding values to use for mean/std calculation.

    Returns:
        List of z-scores, same length as input.
    """
    zscores = []
    for i in range(len(values)):
        window_values = values[max(0, i-window):i]
        if len(window_values) == 0:
            zscores.append(0.0)
            continue
        std = np.std(window_values)
        if std == 0:
            # If current value matches the flat history, z=0; otherwise infinite deviation
            zscores.append(0.0 if values[i] == window_values[0] else float("inf"))
            continue
        zscores.append((values[i] - np.mean(window_values)) / std)
    return zscores



def flag_anomalies(
    values: list[float],
    window: int = 20,
    threshold: float = 2.5,
) -> list[bool]:
    """Flag values whose rolling z-score exceeds the threshold.

    Args:
        values: Ordered list of numeric values.
        window: Rolling window size for z-score computation.
        threshold: Absolute z-score threshold for anomaly flagging.

    Returns:
        List of booleans — True if the value is anomalous.
    """
    zscores = compute_rolling_zscores(values, window=window)
    return [abs(z) > threshold for z in zscores]
