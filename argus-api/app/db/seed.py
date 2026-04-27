"""
Seed the database with:
  - 10 Nigerian O&G assets
  - All sensors per asset
  - 90 days × hourly synthetic sensor readings
  - Pre-defined maintenance records
  - Health snapshots (computed from readings)
"""

import numpy as np
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text

ANCHOR = datetime(2024, 12, 31, 23, 0, 0)
DAYS   = 90
RNG    = np.random.default_rng(42)


# ── Asset & sensor definitions ────────────────────────────────────────────────

ASSETS = [
    {
        "id": "COMP-A", "name": "Compressor Train A", "type": "compressor",
        "location": "Bonny Terminal", "facility": "Bonny Export Terminal",
        "associated_well": "OML-58-07", "parent_asset": "Gas Processing Train 1",
        "manufacturer": "Nuovo Pignone (Baker Hughes)", "install_date": "2018-03-14",
        "last_maintenance": "2023-10-22", "next_scheduled_maintenance": "2025-04-15",
        "rated_capacity": "45 MMScfd @ 3,600 RPM", "operating_hours": 51840,
        "health_score": 52.0, "status": "critical",
        "sensors": [
            {"id": "COMP-A_BEAR_TEMP_NDE", "name": "Bearing Temp NDE",   "type": "temperature", "unit": "°C",  "baseline": 69.4, "lo_alarm": 60.0, "hi_alarm": 85.0,   "drift": 4.8,  "noise": 0.4,  "worsening": True},
            {"id": "COMP-A_DISC_TEMP",     "name": "Discharge Temperature","type": "temperature","unit": "°C",  "baseline": 139.5,"lo_alarm": 100.0,"hi_alarm": 155.0,  "drift": 3.1,  "noise": 0.8,  "worsening": True},
            {"id": "COMP-A_VIB_DE",        "name": "Vibration Drive End",  "type": "vibration",  "unit": "mm/s","baseline": 3.2,  "lo_alarm": 0.0,  "hi_alarm": 7.1,    "drift": 2.6,  "noise": 0.3,  "worsening": True},
            {"id": "COMP-A_SUCT_PRESS",    "name": "Suction Pressure",     "type": "pressure",   "unit": "barg","baseline": 15.2, "lo_alarm": 10.0, "hi_alarm": 25.0,   "drift": -0.4, "noise": 0.3,  "worsening": False},
            {"id": "COMP-A_DISC_PRESS",    "name": "Discharge Pressure",   "type": "pressure",   "unit": "barg","baseline": 80.0, "lo_alarm": 60.0, "hi_alarm": 95.0,   "drift": -1.9, "noise": 0.5,  "worsening": False},
            {"id": "COMP-A_RPM",           "name": "Shaft Speed",          "type": "speed",      "unit": "RPM", "baseline": 3600, "lo_alarm": 3200, "hi_alarm": 3800,   "drift": -18,  "noise": 12,   "worsening": False},
        ]
    },
    {
        "id": "COMP-B", "name": "Compressor Train B", "type": "compressor",
        "location": "Bonny Terminal", "facility": "Bonny Export Terminal",
        "associated_well": "OML-58-08", "parent_asset": "Gas Processing Train 2",
        "manufacturer": "Nuovo Pignone (Baker Hughes)", "install_date": "2019-07-20",
        "last_maintenance": "2024-08-10", "next_scheduled_maintenance": "2025-08-10",
        "rated_capacity": "45 MMScfd @ 3,600 RPM", "operating_hours": 42120,
        "health_score": 81.0, "status": "healthy",
        "sensors": [
            {"id": "COMP-B_BEAR_TEMP_NDE", "name": "Bearing Temp NDE",    "type": "temperature", "unit": "°C",  "baseline": 68.0, "lo_alarm": 60.0, "hi_alarm": 85.0,  "drift": -0.9, "noise": 0.4, "worsening": False},
            {"id": "COMP-B_DISC_TEMP",     "name": "Discharge Temperature","type": "temperature", "unit": "°C",  "baseline": 139.0,"lo_alarm": 100.0,"hi_alarm": 155.0, "drift": -0.8, "noise": 0.7, "worsening": False},
            {"id": "COMP-B_VIB_DE",        "name": "Vibration Drive End",  "type": "vibration",   "unit": "mm/s","baseline": 3.1,  "lo_alarm": 0.0,  "hi_alarm": 7.1,   "drift": -0.2, "noise": 0.2, "worsening": False},
            {"id": "COMP-B_SUCT_PRESS",    "name": "Suction Pressure",     "type": "pressure",    "unit": "barg","baseline": 15.2, "lo_alarm": 10.0, "hi_alarm": 25.0,  "drift": 0.2,  "noise": 0.3, "worsening": False},
        ]
    },
    {
        "id": "ESP-03", "name": "ESP Pump – Well 03", "type": "pump",
        "location": "OML-79 Manifold", "facility": "OML-79 Wellpad A",
        "associated_well": "OML-79-03", "parent_asset": None,
        "manufacturer": "Schlumberger REDA", "install_date": "2021-11-05",
        "last_maintenance": "2024-02-18", "next_scheduled_maintenance": "2025-02-18",
        "rated_capacity": "3,200 BFPD @ 60 Hz", "operating_hours": 26280,
        "health_score": 68.0, "status": "degraded",
        "sensors": [
            {"id": "ESP03_MOTOR_TEMP",  "name": "Motor Temperature",     "type": "temperature", "unit": "°C",  "baseline": 108.0,"lo_alarm": 80.0, "hi_alarm": 130.0, "drift": 10.4, "noise": 1.2, "worsening": True},
            {"id": "ESP03_CURRENT",    "name": "Motor Current",         "type": "current",     "unit": "A",   "baseline": 44.5, "lo_alarm": 35.0, "hi_alarm": 55.0,  "drift": 3.3,  "noise": 0.8, "worsening": True},
            {"id": "ESP03_VIBRATION",  "name": "Vibration",             "type": "vibration",   "unit": "mm/s","baseline": 2.8,  "lo_alarm": 0.0,  "hi_alarm": 6.5,   "drift": 1.3,  "noise": 0.3, "worsening": True},
            {"id": "ESP03_INTAKE_PRESS","name":"Pump Intake Pressure",  "type": "pressure",    "unit": "psi", "baseline": 950.0,"lo_alarm": 700.0,"hi_alarm": 1200.0,"drift": -58,  "noise": 12,  "worsening": False},
        ]
    },
    {
        "id": "ESP-07", "name": "ESP Pump – Well 07", "type": "pump",
        "location": "OML-79 Manifold", "facility": "OML-79 Wellpad B",
        "associated_well": "OML-79-07", "parent_asset": None,
        "manufacturer": "Schlumberger REDA", "install_date": "2022-06-12",
        "last_maintenance": "2024-10-05", "next_scheduled_maintenance": "2025-10-05",
        "rated_capacity": "3,200 BFPD @ 60 Hz", "operating_hours": 18120,
        "health_score": 91.0, "status": "healthy",
        "sensors": [
            {"id": "ESP07_MOTOR_TEMP", "name": "Motor Temperature", "type": "temperature", "unit": "°C",  "baseline": 106.0, "lo_alarm": 80.0,"hi_alarm": 130.0,"drift": -1.8,"noise": 1.0,"worsening": False},
            {"id": "ESP07_CURRENT",   "name": "Motor Current",    "type": "current",     "unit": "A",   "baseline": 44.0,  "lo_alarm": 35.0,"hi_alarm": 55.0, "drift": -0.9,"noise": 0.6,"worsening": False},
            {"id": "ESP07_VIBRATION", "name": "Vibration",        "type": "vibration",   "unit": "mm/s","baseline": 2.5,   "lo_alarm": 0.0, "hi_alarm": 6.5,  "drift": -0.2,"noise": 0.2,"worsening": False},
        ]
    },
    {
        "id": "SEP-01", "name": "Separator Unit 1", "type": "separator",
        "location": "Brass Terminal", "facility": "Brass River Terminal",
        "associated_well": "OML-58-07 / OML-58-08", "parent_asset": "Brass Processing Facility",
        "manufacturer": "Cameron (Schlumberger)", "install_date": "2017-09-01",
        "last_maintenance": "2024-05-14", "next_scheduled_maintenance": "2025-05-14",
        "rated_capacity": "25,000 BFPD", "operating_hours": 63288,
        "health_score": 74.0, "status": "degraded",
        "sensors": [
            {"id": "SEP01_LEVEL", "name": "Liquid Level",    "type": "level",       "unit": "%",   "baseline": 50.0,"lo_alarm": 20.0,"hi_alarm": 80.0,"drift": 14.8,"noise": 3.2,"worsening": True},
            {"id": "SEP01_PRESS", "name": "Vessel Pressure", "type": "pressure",    "unit": "barg","baseline": 8.0, "lo_alarm": 5.0, "hi_alarm": 12.0,"drift": 0.4, "noise": 0.2,"worsening": False},
            {"id": "SEP01_TEMP",  "name": "Vessel Temperature","type": "temperature","unit": "°C", "baseline": 51.0,"lo_alarm": 35.0,"hi_alarm": 70.0,"drift": 1.1, "noise": 0.5,"worsening": False},
        ]
    },
    {
        "id": "SEP-02", "name": "Separator Unit 2", "type": "separator",
        "location": "Brass Terminal", "facility": "Brass River Terminal",
        "associated_well": "OML-79-03", "parent_asset": "Brass Processing Facility",
        "manufacturer": "Cameron (Schlumberger)", "install_date": "2020-02-28",
        "last_maintenance": "2024-09-22", "next_scheduled_maintenance": "2025-09-22",
        "rated_capacity": "20,000 BFPD", "operating_hours": 41520,
        "health_score": 88.0, "status": "healthy",
        "sensors": [
            {"id": "SEP02_LEVEL", "name": "Liquid Level",    "type": "level",   "unit": "%",   "baseline": 50.0,"lo_alarm": 20.0,"hi_alarm": 80.0,"drift": -1.8,"noise": 2.0,"worsening": False},
            {"id": "SEP02_PRESS", "name": "Vessel Pressure", "type": "pressure","unit": "barg","baseline": 8.0, "lo_alarm": 5.0, "hi_alarm": 12.0,"drift": -0.2,"noise": 0.2,"worsening": False},
        ]
    },
    {
        "id": "GT-A", "name": "Gas Turbine Gen A", "type": "turbine",
        "location": "Bonny Terminal", "facility": "Bonny Export Terminal",
        "associated_well": None, "parent_asset": "Power Generation Block 1",
        "manufacturer": "GE Oil & Gas", "install_date": "2016-04-18",
        "last_maintenance": "2023-07-08", "next_scheduled_maintenance": "2025-01-08",
        "rated_capacity": "25 MW", "operating_hours": 74160,
        "health_score": 44.0, "status": "critical",
        "sensors": [
            {"id": "GTA_EXH_TEMP",   "name": "Exhaust Temperature", "type": "temperature", "unit": "°C",    "baseline": 510.0,"lo_alarm": 400.0,"hi_alarm": 580.0,"drift": 38.0, "noise": 2.5, "worsening": True},
            {"id": "GTA_VIB_DE",     "name": "Vibration Drive End", "type": "vibration",   "unit": "mm/s",  "baseline": 4.5,  "lo_alarm": 0.0,  "hi_alarm": 9.0,  "drift": 4.4,  "noise": 0.5, "worsening": True},
            {"id": "GTA_POWER_OUT",  "name": "Power Output",        "type": "power",       "unit": "MW",    "baseline": 24.8, "lo_alarm": 15.0, "hi_alarm": 26.0, "drift": -2.9, "noise": 0.4, "worsening": False},
            {"id": "GTA_FUEL_FLOW",  "name": "Fuel Gas Flow",       "type": "flow",        "unit": "MMScfd","baseline": 1.92, "lo_alarm": 1.0,  "hi_alarm": 2.5,  "drift": 0.26, "noise": 0.04,"worsening": False},
        ]
    },
    {
        "id": "PUMP-A", "name": "Transfer Pump A", "type": "pump",
        "location": "Bonny Terminal", "facility": "Bonny Export Terminal",
        "associated_well": None, "parent_asset": "Crude Export System",
        "manufacturer": "Flowserve", "install_date": "2020-08-14",
        "last_maintenance": "2024-07-30", "next_scheduled_maintenance": "2025-07-30",
        "rated_capacity": "50,000 BOPD", "operating_hours": 37440,
        "health_score": 77.0, "status": "healthy",
        "sensors": [
            {"id": "PUMPA_FLOW",      "name": "Flow Rate",          "type": "flow",     "unit": "BOPD","baseline": 50000,"lo_alarm": 30000,"hi_alarm": 55000,"drift": -2800,"noise": 400,"worsening": False},
            {"id": "PUMPA_PRESS_OUT", "name": "Discharge Pressure", "type": "pressure", "unit": "barg","baseline": 19.0, "lo_alarm": 12.0, "hi_alarm": 24.0, "drift": -0.6,"noise": 0.3,"worsening": False},
            {"id": "PUMPA_VIB",       "name": "Vibration",          "type": "vibration","unit": "mm/s","baseline": 2.2,  "lo_alarm": 0.0,  "hi_alarm": 6.0,  "drift": -0.1,"noise": 0.2,"worsening": False},
        ]
    },
    {
        "id": "PL-SEG1", "name": "Export Pipeline – Seg 1", "type": "pipeline",
        "location": "Bonny → Brass (Segment 1)", "facility": "Bonny–Brass Trunkline",
        "associated_well": "Multiple", "parent_asset": "Bonny–Brass Export Trunkline",
        "manufacturer": "Saipem (1997)", "install_date": "1997-03-01",
        "last_maintenance": "2024-01-10", "next_scheduled_maintenance": "2025-01-10",
        "rated_capacity": "120,000 BOPD", "operating_hours": 237960,
        "health_score": 63.0, "status": "degraded",
        "sensors": [
            {"id": "PL1_PRESS_IN",  "name": "Inlet Pressure",  "type": "pressure", "unit": "barg","baseline": 45.0,  "lo_alarm": 30.0, "hi_alarm": 60.0,  "drift": -2.9,"noise": 0.6,"worsening": True},
            {"id": "PL1_PRESS_OUT", "name": "Outlet Pressure", "type": "pressure", "unit": "barg","baseline": 32.0,  "lo_alarm": 20.0, "hi_alarm": 45.0,  "drift": -3.6,"noise": 0.5,"worsening": True},
            {"id": "PL1_FLOW",      "name": "Flow Rate",       "type": "flow",     "unit": "BOPD","baseline": 118000,"lo_alarm": 60000,"hi_alarm": 125000,"drift": -9600,"noise": 800,"worsening": False},
        ]
    },
    {
        "id": "FL-OML79", "name": "Flowline – OML-79", "type": "pipeline",
        "location": "OML-79 Field", "facility": "OML-79 Production Network",
        "associated_well": "OML-79-07", "parent_asset": "OML-79 Gathering System",
        "manufacturer": "Julius Berger (2019)", "install_date": "2019-11-22",
        "last_maintenance": "2024-06-15", "next_scheduled_maintenance": "2025-06-15",
        "rated_capacity": "15,000 BOPD", "operating_hours": 44616,
        "health_score": 85.0, "status": "healthy",
        "sensors": [
            {"id": "FLOML79_PRESS_IN", "name": "Wellhead Pressure", "type": "pressure", "unit": "barg","baseline": 30.8,"lo_alarm": 20.0,"hi_alarm": 45.0,  "drift": 0.4, "noise": 0.4,"worsening": False},
            {"id": "FLOML79_FLOW",     "name": "Flow Rate",         "type": "flow",     "unit": "BOPD","baseline": 9600,"lo_alarm": 5000,"hi_alarm": 15000, "drift": 220, "noise": 180,"worsening": False},
        ]
    },
]

MAINTENANCE_RECORDS = [
    {"id": "MR-001", "asset_id": "COMP-A", "asset_name": "Compressor Train A", "date": "2023-10-22", "type": "preventive", "technician": "Emeka Okafor / Saipem Field Services", "duration": 36, "findings": "DE bearing clearance within tolerance. NDE bearing showing early micro-pitting on outer race. Lube oil sample — elevated iron particles (12 ppm vs 5 ppm baseline). Seals OK. Impeller inspection: minor erosion on leading edge.", "outcome": "Bearing polished and lubricated. Oil changed and filter replaced. Recommended NDE bearing replacement at next PM cycle.", "next_due": "2025-04-15"},
    {"id": "MR-002", "asset_id": "COMP-A", "asset_name": "Compressor Train A", "date": "2022-08-14", "type": "overhaul",   "technician": "Baker Hughes Field Services", "duration": 168, "findings": "Both bearings replaced. Seals replaced. Impeller cleaned and rebalanced. Rotor bow within spec.", "outcome": "Full overhaul completed. Machine returned to rated performance. Compression ratio restored to 5.28.", "next_due": "2024-08-14"},
    {"id": "MR-003", "asset_id": "GT-A",   "asset_name": "Gas Turbine Gen A",  "date": "2023-07-08", "type": "preventive", "technician": "GE Power Services / Kingsley Adeyemi", "duration": 72, "findings": "Stage 1 turbine blades showing TBC coating erosion. Compressor blade fouling moderate. Combustor liner: minor cracking at transition piece.", "outcome": "Offline compressor wash performed. Combustor liner weld repair. Output restored to 23.8 MW post-wash.", "next_due": "2025-01-08"},
    {"id": "MR-004", "asset_id": "ESP-03", "asset_name": "ESP Pump – Well 03", "date": "2024-02-18", "type": "inspection", "technician": "Schlumberger Well Services / Tunde Bello", "duration": 8, "findings": "Motor temperature trending upward. Cable insulation resistance: 180 MΩ (acceptable, down from 420 MΩ at installation). No evidence of gas lock.", "outcome": "Frequency reduced from 62 Hz to 60 Hz. Monitoring increased to weekly well tests.", "next_due": "2025-02-18"},
    {"id": "MR-005", "asset_id": "SEP-01", "asset_name": "Separator Unit 1",   "date": "2024-05-14", "type": "preventive", "technician": "Cameron Technical / Chidi Eze", "duration": 24, "findings": "Internal inspection: localised pitting on bottom shell. Vane pack partially fouled. Level control valve actuator movement sluggish (12s vs 8s spec).", "outcome": "Vane pack cleaned. Level valve actuator serviced. Shell pitting treated with epoxy coating.", "next_due": "2025-05-14"},
    {"id": "MR-006", "asset_id": "PL-SEG1","asset_name": "Export Pipeline – Seg 1","date": "2024-01-10","type": "inspection","technician": "Saipem Pipeline Inspection / Aminu Garba","duration": 120,"findings": "ILI (Intelligent Pig) run completed. Wall thickness reduction at km 14.2 — estimated 22% wall loss. CP survey deficiency at same location.","outcome": "NUPRC notification filed. Temporary operating pressure reduction to 45 barg. Repair sleeve installation planned Q2 2024 — delayed due to contractor availability.","next_due": "2025-01-10"},
    {"id": "MR-007", "asset_id": "COMP-B", "asset_name": "Compressor Train B", "date": "2024-08-10", "type": "preventive", "technician": "Baker Hughes Field Services", "duration": 24, "findings": "All bearings within specification. Seals: acceptable condition. Lube oil sample normal — iron particles 4 ppm.", "outcome": "Oil and filter change. Minor vibration balance adjustment. Machine returned in excellent condition.", "next_due": "2025-08-10"},
    {"id": "MR-008", "asset_id": "ESP-07", "asset_name": "ESP Pump – Well 07", "date": "2024-10-05", "type": "inspection", "technician": "Schlumberger Well Services", "duration": 6, "findings": "All parameters nominal. Motor temperature stable. Cable insulation resistance: 380 MΩ. Well producing at 98% of target rate.", "outcome": "No action required. Continue standard monitoring schedule.", "next_due": "2025-10-05"},
]


def _gen_readings(baseline: float, drift: float, noise: float, worsening: bool, n_hours: int) -> list:
    values = []
    for i in range(n_hours):
        age = i / n_hours
        d = drift * age if worsening else drift * age
        if worsening and abs(drift) > 0:
            extra = RNG.exponential(abs(drift) * 0.05 * age)
            d += extra * np.sign(drift)
        n = RNG.normal(0, noise)
        spike = RNG.exponential(abs(noise) * 3) * np.sign(drift) if RNG.random() < 0.02 else 0
        values.append(round(float(baseline + d + n + spike), 3))
    return values


def run_seed(db: Session):
    print("Seeding assets...")
    for a in ASSETS:
        db.execute(text("""
            INSERT INTO assets (id,name,type,location,facility,associated_well,parent_asset,
                manufacturer,install_date,last_maintenance,next_scheduled_maintenance,
                rated_capacity,operating_hours,health_score,status)
            VALUES (:id,:name,:type,:location,:facility,:associated_well,:parent_asset,
                :manufacturer,:install_date,:last_maintenance,:next_scheduled_maintenance,
                :rated_capacity,:operating_hours,:health_score,:status)
            ON CONFLICT (id) DO UPDATE SET health_score=EXCLUDED.health_score, status=EXCLUDED.status
        """), {k: v for k, v in a.items() if k != "sensors"})

    print("Seeding sensors & readings...")
    n_hours = DAYS * 24
    for a in ASSETS:
        for s in a["sensors"]:
            db.execute(text("""
                INSERT INTO sensors (id,asset_id,name,type,unit,baseline,lo_alarm,hi_alarm)
                VALUES (:id,:asset_id,:name,:type,:unit,:baseline,:lo_alarm,:hi_alarm)
                ON CONFLICT (id) DO NOTHING
            """), {**{k: v for k, v in s.items() if k not in ("drift","noise","worsening")}, "asset_id": a["id"]})

            values = _gen_readings(s["baseline"], s["drift"], s["noise"], s["worsening"], n_hours)
            rows = []
            for i, val in enumerate(values):
                t = ANCHOR - timedelta(hours=n_hours - 1 - i)
                rows.append({"time": t, "sensor_id": s["id"], "asset_id": a["id"], "value": val})

            # Batch insert
            for chunk_start in range(0, len(rows), 500):
                chunk = rows[chunk_start:chunk_start + 500]
                db.execute(text("""
                    INSERT INTO sensor_readings (time, sensor_id, asset_id, value)
                    VALUES (:time, :sensor_id, :asset_id, :value)
                    ON CONFLICT DO NOTHING
                """), chunk)

    print("Seeding maintenance records...")
    for m in MAINTENANCE_RECORDS:
        db.execute(text("""
            INSERT INTO maintenance_records (id,asset_id,asset_name,date,type,technician,duration,findings,outcome,next_due)
            VALUES (:id,:asset_id,:asset_name,:date,:type,:technician,:duration,:findings,:outcome,:next_due)
            ON CONFLICT (id) DO NOTHING
        """), m)

    print("Seeding health snapshots (daily)...")
    for a in ASSETS:
        start_score = min(100, a["health_score"] + 30)
        for day in range(DAYS, -1, -1):
            t = ANCHOR - timedelta(days=day)
            age = (DAYS - day) / DAYS
            score = round(start_score - (start_score - a["health_score"]) * age + RNG.normal(0, 1), 1)
            score = max(0, min(100, score))
            db.execute(text("""
                INSERT INTO health_snapshots (time, asset_id, health_score)
                VALUES (:time, :asset_id, :health_score)
                ON CONFLICT DO NOTHING
            """), {"time": t, "asset_id": a["id"], "health_score": score})

    db.commit()
    print("Seed complete.")


WELL_PRODUCTION = [
    {
        "id": "OML-79-03", "name": "Well OML-79-03", "field": "OML-79",
        "facility": "OML-79 Wellpad A", "linked_asset_id": "ESP-03",
        "fluid_type": "oil", "current_rate": 1680.0, "target_rate": 3200.0,
        "rate_unit": "BOPD", "water_cut_pct": 42.0, "gor_scf_bbl": 520.0,
        "wellhead_pressure_barg": 8.2, "choke_size_64ths": 36,
        "status": "restricted", "uptime_30d_pct": 78.0,
        "last_well_test": "2024-12-20", "production_trend": "declining",
    },
    {
        "id": "OML-79-07", "name": "Well OML-79-07", "field": "OML-79",
        "facility": "OML-79 Wellpad B", "linked_asset_id": "FL-OML79",
        "fluid_type": "oil", "current_rate": 9800.0, "target_rate": 15000.0,
        "rate_unit": "BOPD", "water_cut_pct": 18.0, "gor_scf_bbl": 420.0,
        "wellhead_pressure_barg": 31.2, "choke_size_64ths": 48,
        "status": "flowing", "uptime_30d_pct": 94.0,
        "last_well_test": "2024-12-28", "production_trend": "stable",
    },
    {
        "id": "OML-58-07", "name": "Well OML-58-07", "field": "OML-58",
        "facility": "Bonny Export Terminal", "linked_asset_id": "COMP-A",
        "fluid_type": "gas", "current_rate": 18.2, "target_rate": 45.0,
        "rate_unit": "MMScfd", "water_cut_pct": 2.0, "gor_scf_bbl": 0.0,
        "wellhead_pressure_barg": 38.4, "choke_size_64ths": 56,
        "status": "restricted", "uptime_30d_pct": 82.0,
        "last_well_test": "2024-12-15", "production_trend": "declining",
    },
    {
        "id": "OML-58-08", "name": "Well OML-58-08", "field": "OML-58",
        "facility": "Bonny Export Terminal", "linked_asset_id": "COMP-B",
        "fluid_type": "gas", "current_rate": 42.0, "target_rate": 45.0,
        "rate_unit": "MMScfd", "water_cut_pct": 1.5, "gor_scf_bbl": 0.0,
        "wellhead_pressure_barg": 51.2, "choke_size_64ths": 64,
        "status": "flowing", "uptime_30d_pct": 96.0,
        "last_well_test": "2024-12-29", "production_trend": "stable",
    },
    {
        "id": "OML-58-SEP01", "name": "Separator Feed – OML-58 A", "field": "OML-58",
        "facility": "Brass River Terminal", "linked_asset_id": "SEP-01",
        "fluid_type": "oil", "current_rate": 18400.0, "target_rate": 25000.0,
        "rate_unit": "BOPD", "water_cut_pct": 55.0, "gor_scf_bbl": 610.0,
        "wellhead_pressure_barg": 5.8, "choke_size_64ths": 40,
        "status": "restricted", "uptime_30d_pct": 85.0,
        "last_well_test": "2024-12-18", "production_trend": "declining",
    },
    {
        "id": "OML-79-ESP07", "name": "Well OML-79-07 (ESP)", "field": "OML-79",
        "facility": "OML-79 Wellpad B", "linked_asset_id": "ESP-07",
        "fluid_type": "oil", "current_rate": 3050.0, "target_rate": 3200.0,
        "rate_unit": "BOPD", "water_cut_pct": 28.0, "gor_scf_bbl": 480.0,
        "wellhead_pressure_barg": 14.6, "choke_size_64ths": 48,
        "status": "flowing", "uptime_30d_pct": 97.0,
        "last_well_test": "2024-12-29", "production_trend": "stable",
    },
]


def seed_production(db: Session):
    count = db.execute(text("SELECT COUNT(*) FROM well_production")).fetchone()[0]
    if count > 0:
        return
    print("Seeding well production data...")
    for w in WELL_PRODUCTION:
        db.execute(text("""
            INSERT INTO well_production (
                id, name, field, facility, linked_asset_id, fluid_type,
                current_rate, target_rate, rate_unit, water_cut_pct, gor_scf_bbl,
                wellhead_pressure_barg, choke_size_64ths, status,
                uptime_30d_pct, last_well_test, production_trend
            ) VALUES (
                :id, :name, :field, :facility, :linked_asset_id, :fluid_type,
                :current_rate, :target_rate, :rate_unit, :water_cut_pct, :gor_scf_bbl,
                :wellhead_pressure_barg, :choke_size_64ths, :status,
                :uptime_30d_pct, :last_well_test, :production_trend
            ) ON CONFLICT (id) DO NOTHING
        """), w)
    db.commit()
    print("Well production seed complete.")
