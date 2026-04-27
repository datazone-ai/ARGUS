from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import List

from app.db.database import get_db
from app.models.schemas import AssetOut, SensorOut, HealthSnapshotOut
from app.models.tables import Asset, Sensor, HealthSnapshot
from app.services.ml_service import compute_asset_health, score_to_status, compute_degradation_rate, estimate_rul

router = APIRouter(prefix="/assets", tags=["assets"])

ANCHOR = datetime(2024, 12, 31, 23, 0, 0)

FAILURE_MODES: dict = {
    "compressor": [
        {"id": "fm-comp-1", "name": "Bearing Failure", "probability": 0.72, "impact": "high",
         "indicators": ["vibration_nde", "vibration_de", "temp_nde"],
         "description": "Progressive bearing wear due to inadequate lubrication or misalignment"},
        {"id": "fm-comp-2", "name": "Seal Degradation", "probability": 0.45, "impact": "medium",
         "indicators": ["suction_pressure", "discharge_pressure"],
         "description": "Mechanical seal wear causing pressure loss and gas leakage"},
        {"id": "fm-comp-3", "name": "Valve Failure", "probability": 0.38, "impact": "high",
         "indicators": ["discharge_pressure", "motor_current"],
         "description": "Check valve failure reducing compression efficiency"},
    ],
    "pump": [
        {"id": "fm-pump-1", "name": "Impeller Wear", "probability": 0.68, "impact": "high",
         "indicators": ["flow_rate", "motor_current"],
         "description": "Erosion of impeller blades reducing pump efficiency"},
        {"id": "fm-pump-2", "name": "Cavitation", "probability": 0.52, "impact": "medium",
         "indicators": ["vibration", "suction_pressure"],
         "description": "Vapor bubble collapse causing pitting and vibration"},
        {"id": "fm-pump-3", "name": "Seal Failure", "probability": 0.31, "impact": "medium",
         "indicators": ["motor_current", "vibration"],
         "description": "Mechanical seal deterioration leading to fluid leakage"},
    ],
    "separator": [
        {"id": "fm-sep-1", "name": "Internals Fouling", "probability": 0.61, "impact": "medium",
         "indicators": ["liquid_level", "inlet_pressure"],
         "description": "Scale and wax buildup on separator internals reducing efficiency"},
        {"id": "fm-sep-2", "name": "Level Control Failure", "probability": 0.44, "impact": "high",
         "indicators": ["liquid_level"],
         "description": "Level controller malfunction causing carryover or gas blowby"},
        {"id": "fm-sep-3", "name": "Corrosion", "probability": 0.29, "impact": "high",
         "indicators": ["inlet_pressure", "outlet_pressure"],
         "description": "Internal corrosion from H2S and CO2 in produced fluids"},
    ],
    "pipeline": [
        {"id": "fm-pipe-1", "name": "Internal Corrosion", "probability": 0.58, "impact": "high",
         "indicators": ["inlet_pressure", "outlet_pressure"],
         "description": "Corrosion-induced wall thinning from produced water and CO2"},
        {"id": "fm-pipe-2", "name": "Wax Deposition", "probability": 0.47, "impact": "medium",
         "indicators": ["flow_rate", "inlet_pressure"],
         "description": "Paraffin wax crystallisation restricting flow at low temperatures"},
        {"id": "fm-pipe-3", "name": "Erosion", "probability": 0.33, "impact": "high",
         "indicators": ["flow_velocity", "outlet_pressure"],
         "description": "Solid particle erosion at bends and restrictions"},
    ],
    "turbine": [
        {"id": "fm-turb-1", "name": "Hot Section Degradation", "probability": 0.65, "impact": "high",
         "indicators": ["exhaust_temp", "shaft_speed"],
         "description": "Thermal fatigue and oxidation of combustor and turbine blades"},
        {"id": "fm-turb-2", "name": "Compressor Fouling", "probability": 0.54, "impact": "medium",
         "indicators": ["shaft_speed", "power_output"],
         "description": "Airborne contaminant deposits on compressor blades reducing airflow"},
        {"id": "fm-turb-3", "name": "Bearing Failure", "probability": 0.41, "impact": "high",
         "indicators": ["vibration_x", "vibration_y", "lube_oil_temp"],
         "description": "Journal or thrust bearing deterioration under high load"},
    ],
}


def _get_sensors(db: Session, asset_id: str) -> list:
    rows = db.execute(
        text("SELECT id, asset_id, name, type, unit, baseline, lo_alarm, hi_alarm FROM sensors WHERE asset_id = :aid"),
        {"aid": asset_id}
    ).fetchall()
    return [dict(r._mapping) for r in rows]


def _build_sensor_out(sensor: dict, details: dict) -> dict:
    d = details.get(sensor["id"], {})
    return {
        "id": sensor["id"],
        "asset_id": sensor["asset_id"],
        "name": sensor["name"],
        "type": sensor["type"],
        "unit": sensor["unit"],
        "baseline": sensor["baseline"],
        "lo_alarm": sensor["lo_alarm"],
        "hi_alarm": sensor["hi_alarm"],
        "current_value": d.get("current_value"),
        "status": d.get("status", "normal"),
        "last_updated": d.get("last_updated"),
        "history": [],
    }


@router.get("/", response_model=List[AssetOut])
def list_assets(db: Session = Depends(get_db)):
    assets = db.execute(text("SELECT * FROM assets ORDER BY name")).fetchall()
    result = []
    for row in assets:
        a = dict(row._mapping)
        sensors = _get_sensors(db, a["id"])
        _, sensor_details = compute_asset_health(db, a["id"], sensors, ANCHOR)
        sensor_outs = [_build_sensor_out(s, sensor_details) for s in sensors]
        result.append({
            **a,
            "sensors": sensor_outs,
            "failure_modes": FAILURE_MODES.get(a["type"], []),
        })
    return result


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: str, db: Session = Depends(get_db)):
    row = db.execute(text("SELECT * FROM assets WHERE id = :id"), {"id": asset_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
    a = dict(row._mapping)
    sensors = _get_sensors(db, asset_id)
    _, sensor_details = compute_asset_health(db, asset_id, sensors, ANCHOR)
    sensor_outs = [_build_sensor_out(s, sensor_details) for s in sensors]
    return {
        **a,
        "sensors": sensor_outs,
        "failure_modes": FAILURE_MODES.get(a["type"], []),
    }


@router.get("/{asset_id}/health-history", response_model=List[HealthSnapshotOut])
def get_health_history(asset_id: str, days: int = 30, db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT time, asset_id, health_score FROM health_snapshots
            WHERE asset_id = :aid AND time >= :start
            ORDER BY time ASC
        """),
        {"aid": asset_id, "start": ANCHOR - __import__("datetime").timedelta(days=days)}
    ).fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/{asset_id}/sensors/{sensor_id}/history")
def get_sensor_history(asset_id: str, sensor_id: str, hours: int = 168, db: Session = Depends(get_db)):
    from datetime import timedelta
    rows = db.execute(
        text("""
            SELECT time, value FROM sensor_readings
            WHERE sensor_id = :sid AND asset_id = :aid AND time >= :start
            ORDER BY time ASC
        """),
        {"sid": sensor_id, "aid": asset_id, "start": ANCHOR - timedelta(hours=hours)}
    ).fetchall()
    return [{"time": r[0].isoformat(), "value": round(r[1], 3)} for r in rows]
