import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import assets, alerts, sensors, maintenance, predictions, work_orders, chat, production
from app.db.database import SessionLocal, apply_migrations, engine
from app.models.tables import Base
from app.db.seed import seed_production

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:3000",
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app = FastAPI(
    title="ARGUS API",
    description="Predictive maintenance and equipment health monitoring for Nigerian upstream O&G",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets.router)
app.include_router(alerts.router)
app.include_router(sensors.router)
app.include_router(maintenance.router)
app.include_router(predictions.router)
app.include_router(work_orders.router)
app.include_router(chat.router)
app.include_router(production.router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    apply_migrations()
    db = SessionLocal()
    try:
        seed_production(db)
    finally:
        db.close()


@app.get("/")
def health_check():
    return {"status": "ok", "service": "ARGUS API", "version": "1.0.0"}


@app.get("/health")
def api_health():
    return {"status": "healthy"}
