from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from app.db.database import get_db
from app.models.schemas import AlertOut, AlertStatusUpdate
from app.services.alert_engine import run_all_checkers

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _row_to_alert(row) -> dict:
    d = dict(row._mapping)
    d["triggered_at"] = d["triggered_at"].isoformat() if d["triggered_at"] else None
    d["sensors"] = d.get("sensors") or []
    return d


@router.get("/", response_model=List[AlertOut])
def list_alerts(status: str = None, db: Session = Depends(get_db)):
    q = "SELECT * FROM alerts"
    params = {}
    if status:
        q += " WHERE status = :status"
        params["status"] = status
    q += " ORDER BY triggered_at DESC"
    rows = db.execute(text(q), params).fetchall()
    return [_row_to_alert(r) for r in rows]


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    row = db.execute(text("SELECT * FROM alerts WHERE id = :id"), {"id": alert_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return _row_to_alert(row)


@router.patch("/{alert_id}/status", response_model=AlertOut)
def update_alert_status(alert_id: str, body: AlertStatusUpdate, db: Session = Depends(get_db)):
    valid = {"open", "acknowledged", "snoozed", "resolved", "dismissed"}
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")
    db.execute(
        text("UPDATE alerts SET status = :status WHERE id = :id"),
        {"status": body.status, "id": alert_id}
    )
    db.commit()
    row = db.execute(text("SELECT * FROM alerts WHERE id = :id"), {"id": alert_id}).fetchone()
    return _row_to_alert(row)


@router.post("/refresh")
def refresh_alerts(db: Session = Depends(get_db)):
    """Re-run alert engine against current sensor data and upsert new alerts."""
    new_alerts = run_all_checkers(db)
    inserted = 0
    for alert in new_alerts:
        existing = db.execute(
            text("SELECT id FROM alerts WHERE id = :id"), {"id": alert["id"]}
        ).fetchone()
        if not existing:
            db.execute(
                text("""
                    INSERT INTO alerts (
                        id, asset_id, asset_name, linked_well, severity, type,
                        title, observation, pattern_match, recommended_action,
                        risk_if_ignored, confidence_score, time_to_failure_min,
                        time_to_failure_max, predicted_impact_bopd, financial_impact_usd,
                        triggered_at, status, sensors
                    ) VALUES (
                        :id, :asset_id, :asset_name, :linked_well, :severity, :type,
                        :title, :observation, :pattern_match, :recommended_action,
                        :risk_if_ignored, :confidence_score, :time_to_failure_min,
                        :time_to_failure_max, :predicted_impact_bopd, :financial_impact_usd,
                        :triggered_at, :status, :sensors
                    )
                """),
                {**alert, "sensors": alert.get("sensors", [])}
            )
            inserted += 1
    db.commit()
    return {"inserted": inserted, "total_checked": len(new_alerts)}
