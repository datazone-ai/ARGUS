from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from app.db.database import get_db
from app.models.schemas import WellProductionOut

router = APIRouter(prefix="/production", tags=["production"])


def _row_to_well(row) -> dict:
    return dict(row._mapping)


@router.get("/wells", response_model=List[WellProductionOut])
def list_wells(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM well_production ORDER BY field, name")).fetchall()
    return [_row_to_well(r) for r in rows]


@router.get("/wells/{well_id}", response_model=WellProductionOut)
def get_well(well_id: str, db: Session = Depends(get_db)):
    row = db.execute(text("SELECT * FROM well_production WHERE id = :id"), {"id": well_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Well not found")
    return _row_to_well(row)


@router.get("/summary")
def production_summary(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM well_production")).fetchall()
    wells = [_row_to_well(r) for r in rows]

    oil_wells = [w for w in wells if w["fluid_type"] == "oil"]
    gas_wells = [w for w in wells if w["fluid_type"] == "gas"]

    total_bopd = sum(w["current_rate"] for w in oil_wells)
    target_bopd = sum(w["target_rate"] for w in oil_wells)
    total_mmscfd = sum(w["current_rate"] for w in gas_wells)
    target_mmscfd = sum(w["target_rate"] for w in gas_wells)

    status_counts = {}
    for w in wells:
        status_counts[w["status"]] = status_counts.get(w["status"], 0) + 1

    return {
        "total_oil_bopd": round(total_bopd),
        "target_oil_bopd": round(target_bopd),
        "oil_efficiency_pct": round(total_bopd / target_bopd * 100, 1) if target_bopd else 0,
        "total_gas_mmscfd": round(total_mmscfd, 1),
        "target_gas_mmscfd": round(target_mmscfd, 1),
        "gas_efficiency_pct": round(total_mmscfd / target_mmscfd * 100, 1) if target_mmscfd else 0,
        "well_count": len(wells),
        "status_breakdown": status_counts,
    }
