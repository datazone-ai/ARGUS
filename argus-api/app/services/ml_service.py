"""
ML Service — Isolation Forest anomaly detection + physics-informed health scoring.

Per-asset pipeline:
  1. Pull last 30 days of sensor readings from DB
  2. Train Isolation Forest on each sensor independently
  3. Compute physics deviation score (current vs baseline)
  4. Compute rolling trend (slope over 7 days)
  5. Combine into a 0-100 health score
  6. Persist updated health score to assets table + health_snapshots
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
from typing import Dict, List, Tuple


SENSOR_WEIGHTS = {
    "vibration":   0.30,
    "temperature": 0.25,
    "pressure":    0.20,
    "current":     0.15,
    "flow":        0.05,
    "level":       0.03,
    "speed":       0.01,
    "power":       0.01,
}

STATUS_MAP = [
    (80, "healthy"),
    (60, "degraded"),
    (0,  "critical"),
]


def _sensor_status(current: float, baseline: float, hi_alarm: float, lo_alarm: float) -> str:
    pct = abs(current - baseline) / (abs(baseline) + 1e-6)
    if current >= hi_alarm or current <= lo_alarm:
        return "critical"
    if pct > 0.05:
        return "warning"
    return "normal"


def _deviation_score(current: float, baseline: float, hi_alarm: float, lo_alarm: float) -> float:
    """Returns 0-100 where 100 = no deviation from baseline."""
    alarm_range = max(abs(hi_alarm - baseline), abs(baseline - lo_alarm), 1e-6)
    dev = abs(current - baseline) / alarm_range
    return max(0.0, 100.0 - dev * 100.0)


def _trend_penalty(series: pd.Series) -> float:
    """Linear slope of last 7 days normalised to a 0-20 penalty."""
    if len(series) < 2:
        return 0.0
    x = np.arange(len(series), dtype=float)
    slope, _ = np.polyfit(x, series.values, 1)
    normalised = abs(slope) / (series.std() + 1e-6)
    return min(20.0, normalised * 10.0)


def _isolation_score(values: np.ndarray) -> float:
    """Returns 0-100 where 100 = most normal. Uses Isolation Forest."""
    if len(values) < 10:
        return 80.0
    X = values.reshape(-1, 1)
    clf = IsolationForest(contamination=0.05, random_state=42, n_estimators=50)
    clf.fit(X)
    # score_samples returns negative anomaly scores; higher = more normal
    raw = clf.score_samples(X[-1:].reshape(-1, 1))[0]
    # Typical range for score_samples: -0.7 (very anomalous) to -0.3 (normal)
    normalised = np.clip((raw + 0.7) / 0.4, 0.0, 1.0) * 100.0
    return float(normalised)


def compute_asset_health(
    db: Session,
    asset_id: str,
    sensors: list,
    anchor: datetime,
) -> Tuple[float, Dict[str, dict]]:
    """
    Returns (health_score, sensor_detail_map).
    sensor_detail_map: {sensor_id: {current_value, status, deviation_score, iso_score}}
    """
    window_start = anchor - timedelta(days=30)

    sensor_details: Dict[str, dict] = {}
    component_scores: List[float] = []
    weights: List[float] = []

    for sensor in sensors:
        rows = db.execute(
            text("""
                SELECT time, value FROM sensor_readings
                WHERE sensor_id = :sid AND time >= :start AND time <= :end
                ORDER BY time ASC
            """),
            {"sid": sensor["id"], "start": window_start, "end": anchor}
        ).fetchall()

        if not rows:
            sensor_details[sensor["id"]] = {
                "current_value": sensor["baseline"],
                "status": "stale",
                "deviation_score": 50.0,
                "iso_score": 50.0,
                "last_updated": None,
            }
            component_scores.append(50.0)
            weights.append(SENSOR_WEIGHTS.get(sensor["type"], 0.05))
            continue

        times  = [r[0] for r in rows]
        values = np.array([r[1] for r in rows])
        series = pd.Series(values, index=pd.to_datetime(times))

        current   = float(values[-1])
        dev_score = _deviation_score(current, sensor["baseline"], sensor["hi_alarm"], sensor["lo_alarm"])
        iso_score = _isolation_score(values)
        trend_pen = _trend_penalty(series.resample("6h").mean().dropna())
        status    = _sensor_status(current, sensor["baseline"], sensor["hi_alarm"], sensor["lo_alarm"])

        combined = (dev_score * 0.5 + iso_score * 0.35) - trend_pen * 0.15
        combined = max(0.0, min(100.0, combined))

        sensor_details[sensor["id"]] = {
            "current_value": round(current, 3),
            "status": status,
            "deviation_score": round(dev_score, 1),
            "iso_score": round(iso_score, 1),
            "last_updated": times[-1].isoformat() if times else None,
        }
        component_scores.append(combined)
        weights.append(SENSOR_WEIGHTS.get(sensor["type"], 0.05))

    if not component_scores:
        return 50.0, sensor_details

    total_w = sum(weights)
    health = sum(s * w for s, w in zip(component_scores, weights)) / total_w
    health = round(max(0.0, min(100.0, health)), 1)
    return health, sensor_details


def score_to_status(score: float) -> str:
    for threshold, label in STATUS_MAP:
        if score >= threshold:
            return label
    return "critical"


def compute_degradation_rate(db: Session, asset_id: str, days: int = 14) -> float:
    """Returns health score change per day (negative = declining)."""
    rows = db.execute(
        text("""
            SELECT time, health_score FROM health_snapshots
            WHERE asset_id = :aid
            ORDER BY time DESC
            LIMIT :n
        """),
        {"aid": asset_id, "n": days}
    ).fetchall()

    if len(rows) < 2:
        return 0.0

    scores = np.array([r[1] for r in reversed(rows)])
    x = np.arange(len(scores), dtype=float)
    slope, _ = np.polyfit(x, scores, 1)
    return round(float(slope), 3)


def estimate_rul(health_score: float, degradation_rate: float) -> Tuple[int, int]:
    """
    Returns (min_days, max_days) to failure (health < 30).
    degradation_rate is pts/day (negative).
    """
    if degradation_rate >= 0:
        return (999, 999)
    days_to_critical = (health_score - 30.0) / abs(degradation_rate)
    min_d = max(1, int(days_to_critical * 0.6))
    max_d = max(2, int(days_to_critical * 1.4))
    return (min_d, max_d)
