from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import List

from app.db.database import get_db
from app.services.ml_service import compute_asset_health, compute_degradation_rate, estimate_rul, score_to_status

router = APIRouter(prefix="/predictions", tags=["predictions"])

ANCHOR = datetime(2024, 12, 31, 23, 0, 0)


def _get_sensors(db: Session, asset_id: str) -> list:
    rows = db.execute(
        text("SELECT id, asset_id, name, type, unit, baseline, lo_alarm, hi_alarm FROM sensors WHERE asset_id = :aid"),
        {"aid": asset_id}
    ).fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/rul")
def get_rul_all(db: Session = Depends(get_db)):
    """Remaining Useful Life estimates for all assets."""
    assets = db.execute(text("SELECT id, name, type, health_score, status FROM assets ORDER BY health_score ASC")).fetchall()
    results = []
    for row in assets:
        a = dict(row._mapping)
        deg_rate = compute_degradation_rate(db, a["id"])
        rul_min, rul_max = estimate_rul(a["health_score"], deg_rate)
        results.append({
            "asset_id": a["id"],
            "asset_name": a["name"],
            "asset_type": a["type"],
            "health_score": a["health_score"],
            "status": a["status"],
            "degradation_rate": deg_rate,
            "rul_min_days": rul_min,
            "rul_max_days": rul_max,
        })
    return results


@router.get("/risk-matrix")
def get_risk_matrix(db: Session = Depends(get_db)):
    """Probability of failure × consequence data for scatter plot."""
    assets = db.execute(text("SELECT id, name, type, health_score, status FROM assets")).fetchall()
    results = []
    for row in assets:
        a = dict(row._mapping)
        deg_rate = compute_degradation_rate(db, a["id"])
        probability = max(0.0, min(1.0, 1.0 - a["health_score"] / 100.0))
        consequence = abs(deg_rate) * 10.0 if deg_rate < 0 else 0.1
        results.append({
            "asset_id": a["id"],
            "asset_name": a["name"],
            "asset_type": a["type"],
            "health_score": a["health_score"],
            "status": a["status"],
            "probability": round(probability, 3),
            "consequence": round(min(consequence, 10.0), 3),
        })
    return results


@router.get("/decline-curves/{asset_id}")
def get_decline_curve(asset_id: str, db: Session = Depends(get_db)):
    """Historical + projected health score decline for a single asset."""
    rows = db.execute(
        text("""
            SELECT time, health_score FROM health_snapshots
            WHERE asset_id = :aid
            ORDER BY time ASC
        """),
        {"aid": asset_id}
    ).fetchall()

    history = [{"time": r[0].isoformat(), "health_score": r[1]} for r in rows]

    if not rows:
        return {"history": [], "projection_no_intervention": [], "projection_with_maintenance": []}

    last_score = rows[-1][1]
    last_time = rows[-1][0]
    deg_rate = compute_degradation_rate(db, asset_id)

    proj_none = []
    proj_maint = []
    for day in range(1, 61):
        ts = (last_time + __import__("datetime").timedelta(days=day)).isoformat()
        score_none = max(0.0, last_score + deg_rate * day)
        if day <= 30:
            score_maint = score_none
        else:
            recovery = (day - 30) * 0.5
            score_maint = min(100.0, score_none + recovery)
        proj_none.append({"time": ts, "health_score": round(score_none, 1)})
        proj_maint.append({"time": ts, "health_score": round(score_maint, 1)})

    return {
        "history": history,
        "projection_no_intervention": proj_none,
        "projection_with_maintenance": proj_maint,
    }


@router.get("/health-refresh")
def refresh_health_scores(db: Session = Depends(get_db)):
    """Recompute ML health scores for all assets and persist to DB."""
    assets = db.execute(text("SELECT id, type FROM assets")).fetchall()
    updated = []
    for row in assets:
        asset_id = row[0]
        sensors = _get_sensors(db, asset_id)
        health, _ = compute_asset_health(db, asset_id, sensors, ANCHOR)
        status = score_to_status(health)
        db.execute(
            text("UPDATE assets SET health_score = :h, status = :s WHERE id = :id"),
            {"h": health, "s": status, "id": asset_id}
        )
        updated.append({"asset_id": asset_id, "health_score": health, "status": status})
    db.commit()
    return {"updated": len(updated), "assets": updated}
