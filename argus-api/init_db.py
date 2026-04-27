"""
Run once to initialise the database: create tables, enable TimescaleDB hypertables, seed data.

Usage:
    python init_db.py

Prerequisites:
    psql -U postgres -c "CREATE USER argus WITH PASSWORD 'argus123';"
    psql -U postgres -c "CREATE DATABASE argusdb OWNER argus;"
    psql -U postgres -d argusdb -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"
"""

import sys
from app.db.database import engine, try_enable_timescale, SessionLocal
from app.models.tables import Base
from app.db.seed import run_seed


def main():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")

    print("Enabling TimescaleDB hypertables (if available)...")
    try_enable_timescale(engine)

    db = SessionLocal()
    try:
        print("Seeding data...")
        run_seed(db)
        print("Seed complete.")
    except Exception as e:
        print(f"Seed failed: {e}", file=sys.stderr)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
