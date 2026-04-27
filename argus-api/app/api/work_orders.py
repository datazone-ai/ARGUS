import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db
from app.models.schemas import WorkOrderCreate, WorkOrderOut, WorkOrderStatusUpdate

router = APIRouter(prefix="/work-orders", tags=["work_orders"])


def _row_to_wo(row) -> dict:
    d = dict(row._mapping)
    for ts_field in ("created_at", "updated_at", "closed_at"):
        if isinstance(d.get(ts_field), datetime):
            d[ts_field] = d[ts_field].isoformat()
    return d


@router.get("/", response_model=List[WorkOrderOut])
def list_work_orders(
    status: Optional[str] = None,
    asset_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = "SELECT * FROM work_orders WHERE 1=1"
    params = {}
    if status:
        q += " AND status = :status"
        params["status"] = status
    if asset_id:
        q += " AND asset_id = :asset_id"
        params["asset_id"] = asset_id
    if assigned_to:
        q += " AND assigned_to = :assigned_to"
        params["assigned_to"] = assigned_to
    q += " ORDER BY created_at DESC"
    rows = db.execute(text(q), params).fetchall()
    return [_row_to_wo(r) for r in rows]


@router.get("/{wo_id}", response_model=WorkOrderOut)
def get_work_order(wo_id: str, db: Session = Depends(get_db)):
    row = db.execute(text("SELECT * FROM work_orders WHERE id = :id"), {"id": wo_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Work order not found")
    return _row_to_wo(row)


@router.post("/", response_model=WorkOrderOut, status_code=201)
def create_work_order(body: WorkOrderCreate, db: Session = Depends(get_db)):
    wo_id = f"WO-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.utcnow()
    db.execute(
        text("""
            INSERT INTO work_orders (
                id, type, title, asset_name, asset_id, linked_well, priority,
                description, estimated_downtime_hours, estimated_impact_bopd,
                estimated_financial_impact, source_alert_id, status, created_at,
                assigned_to, target_date
            ) VALUES (
                :id, :type, :title, :asset_name, :asset_id, :linked_well, :priority,
                :description, :estimated_downtime_hours, :estimated_impact_bopd,
                :estimated_financial_impact, :source_alert_id, 'confirmed', :created_at,
                :assigned_to, :target_date
            )
        """),
        {
            "id": wo_id,
            "type": body.type,
            "title": body.title,
            "asset_name": body.asset_name,
            "asset_id": body.asset_id,
            "linked_well": body.linked_well,
            "priority": body.priority,
            "description": body.description,
            "estimated_downtime_hours": body.estimated_downtime_hours,
            "estimated_impact_bopd": body.estimated_impact_bopd,
            "estimated_financial_impact": body.estimated_financial_impact,
            "source_alert_id": body.source_alert_id,
            "created_at": now,
            "assigned_to": body.assigned_to,
            "target_date": body.target_date,
        }
    )
    db.commit()

    if body.source_alert_id:
        db.execute(
            text("UPDATE alerts SET status='acknowledged' WHERE id=:id AND status='open'"),
            {"id": body.source_alert_id}
        )
        db.commit()

    row = db.execute(text("SELECT * FROM work_orders WHERE id = :id"), {"id": wo_id}).fetchone()
    return _row_to_wo(row)


@router.patch("/{wo_id}/status", response_model=WorkOrderOut)
def update_work_order_status(wo_id: str, body: WorkOrderStatusUpdate, db: Session = Depends(get_db)):
    valid = {"confirmed", "in_progress", "completed", "cancelled"}
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")

    now = datetime.utcnow()
    closed_at = now if body.status in ("completed", "cancelled") else None

    params: dict = {"status": body.status, "updated_at": now, "id": wo_id}

    if body.field_notes is not None and closed_at is not None:
        db.execute(
            text("""
                UPDATE work_orders
                SET status = :status, updated_at = :updated_at,
                    closed_at = :closed_at, field_notes = :field_notes
                WHERE id = :id
            """),
            {**params, "closed_at": closed_at, "field_notes": body.field_notes}
        )
    elif body.field_notes is not None:
        db.execute(
            text("UPDATE work_orders SET status=:status, updated_at=:updated_at, field_notes=:field_notes WHERE id=:id"),
            {**params, "field_notes": body.field_notes}
        )
    elif closed_at is not None:
        db.execute(
            text("UPDATE work_orders SET status=:status, updated_at=:updated_at, closed_at=:closed_at WHERE id=:id"),
            {**params, "closed_at": closed_at}
        )
    else:
        db.execute(
            text("UPDATE work_orders SET status=:status, updated_at=:updated_at WHERE id=:id"),
            params
        )

    db.commit()
    row = db.execute(text("SELECT * FROM work_orders WHERE id = :id"), {"id": wo_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Work order not found")
    return _row_to_wo(row)


@router.patch("/{wo_id}/notes", response_model=WorkOrderOut)
def update_field_notes(wo_id: str, field_notes: str, db: Session = Depends(get_db)):
    db.execute(
        text("UPDATE work_orders SET field_notes=:notes, updated_at=:now WHERE id=:id"),
        {"notes": field_notes, "now": datetime.utcnow(), "id": wo_id}
    )
    db.commit()
    row = db.execute(text("SELECT * FROM work_orders WHERE id = :id"), {"id": wo_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Work order not found")
    return _row_to_wo(row)
