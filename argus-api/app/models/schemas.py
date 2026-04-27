from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SensorOut(BaseModel):
    id: str
    asset_id: str
    name: str
    type: str
    unit: str
    baseline: float
    lo_alarm: float
    hi_alarm: float
    current_value: Optional[float] = None
    status: Optional[str] = "normal"
    last_updated: Optional[str] = None
    history: Optional[List[dict]] = []

    class Config:
        from_attributes = True


class AssetOut(BaseModel):
    id: str
    name: str
    type: str
    location: str
    facility: str
    associated_well: Optional[str] = None
    parent_asset: Optional[str] = None
    manufacturer: Optional[str] = None
    install_date: Optional[str] = None
    last_maintenance: Optional[str] = None
    next_scheduled_maintenance: Optional[str] = None
    rated_capacity: Optional[str] = None
    operating_hours: Optional[int] = None
    health_score: float
    status: str
    sensors: List[SensorOut] = []
    failure_modes: List[dict] = []

    class Config:
        from_attributes = True


class AlertOut(BaseModel):
    id: str
    asset_id: str
    asset_name: str
    linked_well: Optional[str] = None
    severity: str
    type: str
    title: str
    observation: str
    pattern_match: str
    recommended_action: str
    risk_if_ignored: str
    confidence_score: int
    time_to_failure_min: int
    time_to_failure_max: int
    predicted_impact_bopd: int
    financial_impact_usd: float
    triggered_at: str
    status: str
    sensors: List[str] = []

    class Config:
        from_attributes = True


class AlertStatusUpdate(BaseModel):
    status: str


class MaintenanceRecordOut(BaseModel):
    id: str
    asset_id: str
    asset_name: str
    date: str
    type: str
    technician: str
    duration: int
    findings: str
    outcome: str
    next_due: str

    class Config:
        from_attributes = True


class WorkOrderCreate(BaseModel):
    type: str
    title: str
    asset_name: str
    asset_id: str
    linked_well: Optional[str] = None
    priority: str
    description: str
    estimated_downtime_hours: Optional[float] = None
    estimated_impact_bopd: Optional[int] = None
    estimated_financial_impact: Optional[float] = None
    source_alert_id: Optional[str] = None
    assigned_to: Optional[str] = None
    target_date: Optional[str] = None


class WorkOrderStatusUpdate(BaseModel):
    status: str
    field_notes: Optional[str] = None


class WorkOrderOut(WorkOrderCreate):
    id: str
    status: str
    created_at: str
    field_notes: Optional[str] = None
    updated_at: Optional[str] = None
    closed_at: Optional[str] = None

    class Config:
        from_attributes = True


class WellProductionOut(BaseModel):
    id: str
    name: str
    field: str
    facility: str
    linked_asset_id: Optional[str] = None
    fluid_type: str
    current_rate: float
    target_rate: float
    rate_unit: str
    water_cut_pct: float
    gor_scf_bbl: float
    wellhead_pressure_barg: float
    choke_size_64ths: Optional[int] = None
    status: str
    uptime_30d_pct: float
    last_well_test: Optional[str] = None
    production_trend: str

    class Config:
        from_attributes = True


class HealthSnapshotOut(BaseModel):
    time: str
    asset_id: str
    health_score: float

    class Config:
        from_attributes = True
