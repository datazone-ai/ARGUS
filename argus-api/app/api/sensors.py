from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import List

from app.db.database import get_db
from app.models.schemas import SensorOut

router = APIRouter(prefix="/sensors", tags=["sensors"])

ANCHOR = datetime(2024, 12, 31, 23, 0, 0)


@router.get("/", response_model=List[SensorOut])
def list_sensors(asset_id: str = None, db: Session = Depends(get_db)):
    if asset_id:
        rows = db.execute(
            text("SELECT * FROM sensors WHERE asset_id = :aid ORDER BY name"),
            {"aid": asset_id}
        ).fetchall()
    else:
        rows = db.execute(text("SELECT * FROM sensors ORDER BY asset_id, name")).fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/{sensor_id}", response_model=SensorOut)
def get_sensor(sensor_id: str, db: Session = Depends(get_db)):
    row = db.execute(text("SELECT * FROM sensors WHERE id = :id"), {"id": sensor_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Sensor not found")
    d = dict(row._mapping)

    reading = db.execute(
        text("SELECT value, time FROM sensor_readings WHERE sensor_id = :sid ORDER BY time DESC LIMIT 1"),
        {"sid": sensor_id}
    ).fetchone()
    if reading:
        d["current_value"] = round(reading[0], 3)
        d["last_updated"] = reading[1].isoformat()

    return d


@router.get("/{sensor_id}/readings")
def get_sensor_readings(sensor_id: str, hours: int = 168, db: Session = Depends(get_db)):
    from datetime import timedelta
    rows = db.execute(
        text("""
            SELECT time, value FROM sensor_readings
            WHERE sensor_id = :sid AND time >= :start
            ORDER BY time ASC
        """),
        {"sid": sensor_id, "start": ANCHOR - timedelta(hours=hours)}
    ).fetchall()
    return [{"time": r[0].isoformat(), "value": round(r[1], 3)} for r in rows]
