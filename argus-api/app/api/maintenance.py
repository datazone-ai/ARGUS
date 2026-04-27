from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from app.db.database import get_db
from app.models.schemas import MaintenanceRecordOut

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("/", response_model=List[MaintenanceRecordOut])
def list_maintenance(asset_id: str = None, db: Session = Depends(get_db)):
    if asset_id:
        rows = db.execute(
            text("SELECT * FROM maintenance_records WHERE asset_id = :aid ORDER BY date DESC"),
            {"aid": asset_id}
        ).fetchall()
    else:
        rows = db.execute(
            text("SELECT * FROM maintenance_records ORDER BY date DESC")
        ).fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/{record_id}", response_model=MaintenanceRecordOut)
def get_maintenance_record(record_id: str, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    row = db.execute(
        text("SELECT * FROM maintenance_records WHERE id = :id"), {"id": record_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    return dict(row._mapping)
