from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://argus:argus123@localhost:5432/argusdb"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def try_enable_timescale(engine_or_session=None):
    db = SessionLocal()
    try:
        db.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
        db.commit()
        db.execute(text(
            "SELECT create_hypertable('sensor_readings', 'time', if_not_exists => TRUE);"
        ))
        db.commit()
        db.execute(text(
            "SELECT create_hypertable('health_snapshots', 'time', if_not_exists => TRUE);"
        ))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def apply_migrations():
    """Add columns and tables introduced after initial schema creation."""
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS field_notes TEXT"))
        db.execute(text("ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP"))
        db.execute(text("ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP"))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS well_production (
                id VARCHAR PRIMARY KEY,
                name VARCHAR NOT NULL,
                field VARCHAR NOT NULL,
                facility VARCHAR NOT NULL,
                linked_asset_id VARCHAR,
                fluid_type VARCHAR DEFAULT 'oil',
                current_rate FLOAT NOT NULL,
                target_rate FLOAT NOT NULL,
                rate_unit VARCHAR NOT NULL,
                water_cut_pct FLOAT DEFAULT 0.0,
                gor_scf_bbl FLOAT DEFAULT 0.0,
                wellhead_pressure_barg FLOAT NOT NULL,
                choke_size_64ths INTEGER,
                status VARCHAR DEFAULT 'flowing',
                uptime_30d_pct FLOAT DEFAULT 100.0,
                last_well_test VARCHAR,
                production_trend VARCHAR DEFAULT 'stable'
            )
        """))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Migration warning: {e}")
    finally:
        db.close()
