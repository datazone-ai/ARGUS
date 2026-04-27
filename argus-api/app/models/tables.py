from sqlalchemy import Column, String, Float, Integer, DateTime, Date, Text, ARRAY
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from datetime import datetime
from app.db.database import Base


class Asset(Base):
    __tablename__ = "assets"
    id                          = Column(String, primary_key=True)
    name                        = Column(String, nullable=False)
    type                        = Column(String, nullable=False)
    location                    = Column(String, nullable=False)
    facility                    = Column(String, nullable=False)
    associated_well             = Column(String)
    parent_asset                = Column(String)
    manufacturer                = Column(String)
    install_date                = Column(String)
    last_maintenance            = Column(String)
    next_scheduled_maintenance  = Column(String)
    rated_capacity              = Column(String)
    operating_hours             = Column(Integer)
    health_score                = Column(Float, default=100.0)
    status                      = Column(String, default="healthy")


class Sensor(Base):
    __tablename__ = "sensors"
    id       = Column(String, primary_key=True)
    asset_id = Column(String, nullable=False)
    name     = Column(String, nullable=False)
    type     = Column(String, nullable=False)
    unit     = Column(String, nullable=False)
    baseline = Column(Float, nullable=False)
    lo_alarm = Column(Float, nullable=False)
    hi_alarm = Column(Float, nullable=False)


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    time      = Column(DateTime, primary_key=True)
    sensor_id = Column(String, primary_key=True)
    asset_id  = Column(String, nullable=False)
    value     = Column(Float, nullable=False)


class Alert(Base):
    __tablename__ = "alerts"
    id                      = Column(String, primary_key=True)
    asset_id                = Column(String, nullable=False)
    asset_name              = Column(String, nullable=False)
    linked_well             = Column(String)
    severity                = Column(String, nullable=False)
    type                    = Column(String, nullable=False)
    title                   = Column(String, nullable=False)
    observation             = Column(Text, nullable=False)
    pattern_match           = Column(Text, nullable=False)
    recommended_action      = Column(Text, nullable=False)
    risk_if_ignored         = Column(Text, nullable=False)
    confidence_score        = Column(Integer, nullable=False)
    time_to_failure_min     = Column(Integer, nullable=False)
    time_to_failure_max     = Column(Integer, nullable=False)
    predicted_impact_bopd   = Column(Integer, nullable=False)
    financial_impact_usd    = Column(Float, nullable=False)
    triggered_at            = Column(DateTime, nullable=False)
    status                  = Column(String, default="open")
    sensors                 = Column(PG_ARRAY(String))


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"
    id          = Column(String, primary_key=True)
    asset_id    = Column(String, nullable=False)
    asset_name  = Column(String, nullable=False)
    date        = Column(String, nullable=False)
    type        = Column(String, nullable=False)
    technician  = Column(String, nullable=False)
    duration    = Column(Integer, nullable=False)
    findings    = Column(Text, nullable=False)
    outcome     = Column(Text, nullable=False)
    next_due    = Column(String, nullable=False)


class WorkOrder(Base):
    __tablename__ = "work_orders"
    id                          = Column(String, primary_key=True)
    type                        = Column(String, nullable=False)
    title                       = Column(String, nullable=False)
    asset_name                  = Column(String, nullable=False)
    asset_id                    = Column(String, nullable=False)
    linked_well                 = Column(String)
    priority                    = Column(String, nullable=False)
    description                 = Column(Text, nullable=False)
    estimated_downtime_hours    = Column(Float)
    estimated_impact_bopd       = Column(Integer)
    estimated_financial_impact  = Column(Float)
    source_alert_id             = Column(String)
    status                      = Column(String, default="confirmed")
    created_at                  = Column(DateTime, default=datetime.utcnow)
    assigned_to                 = Column(String)
    target_date                 = Column(String)
    field_notes                 = Column(Text)
    updated_at                  = Column(DateTime)
    closed_at                   = Column(DateTime)


class WellProduction(Base):
    __tablename__ = "well_production"
    id                      = Column(String, primary_key=True)
    name                    = Column(String, nullable=False)
    field                   = Column(String, nullable=False)
    facility                = Column(String, nullable=False)
    linked_asset_id         = Column(String)
    fluid_type              = Column(String, default="oil")
    current_rate            = Column(Float, nullable=False)
    target_rate             = Column(Float, nullable=False)
    rate_unit               = Column(String, nullable=False)
    water_cut_pct           = Column(Float, default=0.0)
    gor_scf_bbl             = Column(Float, default=0.0)
    wellhead_pressure_barg  = Column(Float, nullable=False)
    choke_size_64ths        = Column(Integer)
    status                  = Column(String, default="flowing")
    uptime_30d_pct          = Column(Float, default=100.0)
    last_well_test          = Column(String)
    production_trend        = Column(String, default="stable")


class HealthSnapshot(Base):
    __tablename__ = "health_snapshots"
    time         = Column(DateTime, primary_key=True)
    asset_id     = Column(String, primary_key=True)
    health_score = Column(Float, nullable=False)
