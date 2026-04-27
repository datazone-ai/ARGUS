import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.database import get_db

router = APIRouter(prefix="/chat", tags=["chat"])

ANCHOR = datetime(2024, 12, 31, 23, 0, 0)


# ── Request/Response schemas ──────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatContext(BaseModel):
    currentPage: Optional[str] = None
    currentAssetId: Optional[str] = None
    currentAssetName: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[ChatContext] = None


# ── Tool definitions ──────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "get_open_alerts",
        "description": (
            "Get currently open alerts, optionally filtered by severity or asset. "
            "Returns alert details including observation, recommended action, financial impact, "
            "and time-to-failure range. Use for questions about current risks, critical issues, "
            "or financial exposure."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "severity": {
                    "type": "string",
                    "enum": ["critical", "high", "medium", "low"],
                    "description": "Filter by alert severity"
                },
                "asset_id": {
                    "type": "string",
                    "description": "Filter by specific asset ID (e.g. COMP-A, GT-A, ESP-03)"
                }
            }
        }
    },
    {
        "name": "get_asset_status",
        "description": (
            "Get health score, status, sensor readings, and metadata for one or all assets. "
            "Use for questions about asset condition, health scores, or comparing assets."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "asset_id": {
                    "type": "string",
                    "description": "Specific asset ID. Leave empty to get all assets."
                }
            }
        }
    },
    {
        "name": "get_sensor_history",
        "description": (
            "Get recent sensor readings for a specific sensor. Use for trend questions, "
            "vibration history, temperature trends, or pressure analysis. "
            "Returns hourly averages to keep response size manageable."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "asset_id": {"type": "string"},
                "sensor_id": {"type": "string", "description": "Full sensor ID e.g. COMP-A-VIB-NDE"},
                "hours": {"type": "integer", "default": 168, "description": "Hours of history (default 7 days)"}
            },
            "required": ["asset_id", "sensor_id"]
        }
    },
    {
        "name": "get_maintenance_history",
        "description": (
            "Get maintenance records for an asset, optionally filtered by year or type. "
            "Use for questions about past inspections, outcomes, findings, and next due dates."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "asset_id": {"type": "string"},
                "year": {"type": "integer"},
                "type": {
                    "type": "string",
                    "enum": ["preventive", "corrective", "inspection", "overhaul"]
                }
            }
        }
    },
    {
        "name": "get_rul_estimates",
        "description": (
            "Get Remaining Useful Life (RUL) estimates for all assets or a specific one. "
            "Returns health score, degradation rate (pts/day), and min/max days to failure. "
            "Use for questions about when assets might fail or how urgent maintenance is."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "asset_id": {"type": "string"}
            }
        }
    },
    {
        "name": "get_financial_exposure",
        "description": (
            "Get total financial exposure from open alerts, broken down by asset. "
            "Use for questions about cost of risk, deferred production value, or prioritisation by financial impact."
        ),
        "input_schema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_work_orders",
        "description": (
            "Get work orders and cases, optionally filtered by status or asset. "
            "Use for questions about ongoing maintenance actions, who is assigned, and target dates."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["confirmed", "in_progress", "completed", "cancelled"]},
                "asset_id": {"type": "string"}
            }
        }
    },
    {
        "name": "get_sensor_list",
        "description": (
            "List all sensors on an asset with their current values, baseline, alarm limits, and status. "
            "Use to discover sensor IDs before calling get_sensor_history, or to get a snapshot of all sensor states."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "asset_id": {"type": "string"}
            },
            "required": ["asset_id"]
        }
    },
    {
        "name": "compare_assets",
        "description": (
            "Compare health scores, degradation rates, and open alert counts across all assets. "
            "Use for ranking questions: 'which assets are worst', 'sort by urgency', etc."
        ),
        "input_schema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_health_trend",
        "description": (
            "Get daily health score history for an asset over the last N days. "
            "Use for questions about whether an asset is improving or declining over time."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "asset_id": {"type": "string"},
                "days": {"type": "integer", "default": 14}
            },
            "required": ["asset_id"]
        }
    }
]


# ── Tool executor ─────────────────────────────────────────────────────────────

class ToolExecutor:
    def __init__(self, db: Session):
        self.db = db

    def execute(self, name: str, inputs: Dict[str, Any]) -> str:
        fn = getattr(self, f"_{name}", None)
        if not fn:
            return json.dumps({"error": f"Unknown tool: {name}"})
        try:
            return fn(**inputs)
        except Exception as e:
            return json.dumps({"error": str(e)})

    def _get_open_alerts(self, severity: str = None, asset_id: str = None) -> str:
        q = "SELECT * FROM alerts WHERE status='open'"
        params: Dict = {}
        if severity:
            q += " AND severity=:severity"
            params["severity"] = severity
        if asset_id:
            q += " AND asset_id=:asset_id"
            params["asset_id"] = asset_id
        q += " ORDER BY financial_impact_usd DESC"
        rows = self.db.execute(text(q), params).fetchall()
        alerts = []
        for r in rows:
            d = dict(r._mapping)
            d["triggered_at"] = d["triggered_at"].isoformat() if d.get("triggered_at") else None
            d["sensors"] = d.get("sensors") or []
            alerts.append(d)
        total = sum(a["financial_impact_usd"] for a in alerts)
        return json.dumps({
            "open_alert_count": len(alerts),
            "total_financial_exposure_usd": round(total),
            "alerts": alerts
        })

    def _get_asset_status(self, asset_id: str = None) -> str:
        if asset_id:
            rows = self.db.execute(text("SELECT * FROM assets WHERE id=:id"), {"id": asset_id}).fetchall()
        else:
            rows = self.db.execute(text("SELECT * FROM assets ORDER BY health_score ASC")).fetchall()
        assets = [dict(r._mapping) for r in rows]
        for a in assets:
            sensors = self.db.execute(
                text("SELECT id, name, type, unit, baseline, hi_alarm, lo_alarm FROM sensors WHERE asset_id=:aid"),
                {"aid": a["id"]}
            ).fetchall()
            latest = {}
            for s in sensors:
                val_row = self.db.execute(
                    text("SELECT value FROM sensor_readings WHERE sensor_id=:sid ORDER BY time DESC LIMIT 1"),
                    {"sid": s[0]}
                ).fetchone()
                latest[s[0]] = round(val_row[0], 3) if val_row else None
            a["sensors"] = [
                {**dict(s._mapping), "current_value": latest.get(s[0])}
                for s in sensors
            ]
        return json.dumps(assets)

    def _get_sensor_history(self, asset_id: str, sensor_id: str, hours: int = 168) -> str:
        start = ANCHOR - timedelta(hours=hours)
        rows = self.db.execute(
            text("""
                SELECT date_trunc('hour', time) as hr, AVG(value) as avg_value
                FROM sensor_readings
                WHERE sensor_id=:sid AND asset_id=:aid AND time>=:start
                GROUP BY hr ORDER BY hr ASC
            """),
            {"sid": sensor_id, "aid": asset_id, "start": start}
        ).fetchall()
        sensor_info = self.db.execute(
            text("SELECT name, type, unit, baseline, hi_alarm, lo_alarm FROM sensors WHERE id=:sid"),
            {"sid": sensor_id}
        ).fetchone()
        info = dict(sensor_info._mapping) if sensor_info else {}
        readings = [{"time": r[0].isoformat(), "value": round(r[1], 3)} for r in rows]
        if readings:
            values = [r["value"] for r in readings]
            info["current"] = values[-1]
            info["min"] = min(values)
            info["max"] = max(values)
            info["trend"] = "rising" if len(values) > 4 and values[-1] > values[-4] else "stable or falling"
        return json.dumps({"sensor": info, "hourly_readings": readings[-48:]})

    def _get_maintenance_history(self, asset_id: str = None, year: int = None, type: str = None) -> str:
        q = "SELECT * FROM maintenance_records WHERE 1=1"
        params: Dict = {}
        if asset_id:
            q += " AND asset_id=:asset_id"
            params["asset_id"] = asset_id
        if year:
            q += " AND EXTRACT(year FROM date::date)=:year"
            params["year"] = year
        if type:
            q += " AND type=:type"
            params["type"] = type
        q += " ORDER BY date DESC"
        rows = self.db.execute(text(q), params).fetchall()
        return json.dumps([dict(r._mapping) for r in rows])

    def _get_rul_estimates(self, asset_id: str = None) -> str:
        from app.services.ml_service import compute_degradation_rate, estimate_rul
        if asset_id:
            rows = self.db.execute(
                text("SELECT id, name, type, health_score, status FROM assets WHERE id=:id"),
                {"id": asset_id}
            ).fetchall()
        else:
            rows = self.db.execute(
                text("SELECT id, name, type, health_score, status FROM assets ORDER BY health_score ASC")
            ).fetchall()
        results = []
        for r in rows:
            a = dict(r._mapping)
            deg = compute_degradation_rate(self.db, a["id"])
            rul_min, rul_max = estimate_rul(a["health_score"], deg)
            results.append({
                **a,
                "degradation_rate_pts_per_day": deg,
                "rul_min_days": rul_min,
                "rul_max_days": rul_max,
                "urgency": "critical" if rul_min < 20 else "high" if rul_min < 60 else "monitor"
            })
        return json.dumps(results)

    def _get_financial_exposure(self) -> str:
        rows = self.db.execute(
            text("""
                SELECT asset_name, asset_id,
                       SUM(financial_impact_usd) as exposure,
                       SUM(predicted_impact_bopd) as bopd,
                       COUNT(*) as alert_count
                FROM alerts WHERE status='open'
                GROUP BY asset_name, asset_id
                ORDER BY exposure DESC
            """)
        ).fetchall()
        breakdown = [dict(r._mapping) for r in rows]
        total = sum(b["exposure"] for b in breakdown)
        return json.dumps({
            "total_exposure_usd": round(total),
            "total_exposure_millions": round(total / 1_000_000, 2),
            "by_asset": breakdown
        })

    def _get_work_orders(self, status: str = None, asset_id: str = None) -> str:
        q = "SELECT * FROM work_orders WHERE 1=1"
        params: Dict = {}
        if status:
            q += " AND status=:status"
            params["status"] = status
        if asset_id:
            q += " AND asset_id=:asset_id"
            params["asset_id"] = asset_id
        q += " ORDER BY created_at DESC"
        rows = self.db.execute(text(q), params).fetchall()
        results = []
        for r in rows:
            d = dict(r._mapping)
            d["created_at"] = d["created_at"].isoformat() if d.get("created_at") else None
            results.append(d)
        return json.dumps(results)

    def _get_sensor_list(self, asset_id: str) -> str:
        sensors = self.db.execute(
            text("SELECT id, name, type, unit, baseline, hi_alarm, lo_alarm FROM sensors WHERE asset_id=:aid"),
            {"aid": asset_id}
        ).fetchall()
        result = []
        for s in sensors:
            d = dict(s._mapping)
            val = self.db.execute(
                text("SELECT value, time FROM sensor_readings WHERE sensor_id=:sid ORDER BY time DESC LIMIT 1"),
                {"sid": s[0]}
            ).fetchone()
            if val:
                d["current_value"] = round(val[0], 3)
                d["last_updated"] = val[1].isoformat()
                d["deviation_pct"] = round((val[0] - d["baseline"]) / d["baseline"] * 100, 1)
            result.append(d)
        return json.dumps(result)

    def _compare_assets(self) -> str:
        from app.services.ml_service import compute_degradation_rate
        rows = self.db.execute(
            text("SELECT id, name, type, location, health_score, status FROM assets ORDER BY health_score ASC")
        ).fetchall()
        results = []
        for r in rows:
            a = dict(r._mapping)
            deg = compute_degradation_rate(self.db, a["id"])
            alert_count = self.db.execute(
                text("SELECT COUNT(*) FROM alerts WHERE asset_id=:aid AND status='open'"),
                {"aid": a["id"]}
            ).fetchone()[0]
            results.append({**a, "degradation_rate": deg, "open_alerts": alert_count})
        return json.dumps(results)

    def _get_health_trend(self, asset_id: str, days: int = 14) -> str:
        start = ANCHOR - timedelta(days=days)
        rows = self.db.execute(
            text("""
                SELECT time, health_score FROM health_snapshots
                WHERE asset_id=:aid AND time>=:start ORDER BY time ASC
            """),
            {"aid": asset_id, "start": start}
        ).fetchall()
        snapshots = [{"time": r[0].isoformat(), "health_score": r[1]} for r in rows]
        if len(snapshots) >= 2:
            trend = snapshots[-1]["health_score"] - snapshots[0]["health_score"]
            direction = "improving" if trend > 1 else "declining" if trend < -1 else "stable"
        else:
            direction = "insufficient data"
        return json.dumps({"asset_id": asset_id, "trend_direction": direction, "snapshots": snapshots})


# ── System prompt builder ─────────────────────────────────────────────────────

def build_system_prompt(context: Optional[ChatContext], db: Session) -> str:
    # Get a quick summary for context injection
    try:
        alert_count = db.execute(text("SELECT COUNT(*) FROM alerts WHERE status='open'")).fetchone()[0]
        critical_count = db.execute(text("SELECT COUNT(*) FROM alerts WHERE status='open' AND severity='critical'")).fetchone()[0]
        total_exposure = db.execute(text("SELECT COALESCE(SUM(financial_impact_usd),0) FROM alerts WHERE status='open'")).fetchone()[0]
        worst_asset = db.execute(text("SELECT name, health_score FROM assets ORDER BY health_score ASC LIMIT 1")).fetchone()
    except Exception:
        alert_count = critical_count = total_exposure = 0
        worst_asset = None

    ctx_lines = []
    if context:
        if context.currentAssetName:
            ctx_lines.append(f"- User is currently viewing asset: {context.currentAssetName} ({context.currentAssetId})")
        elif context.currentPage:
            ctx_lines.append(f"- User is on page: {context.currentPage}")

    ctx_block = "\n".join(ctx_lines) if ctx_lines else "- Dashboard overview"

    return f"""You are Assets Intelligence, an AI assistant embedded in the ARGUS predictive maintenance platform
for Nigerian upstream oil & gas operations (Bonny, Brass, OML-79 facilities).

You have live access to data for 10 monitored assets: compressors (COMP-A, COMP-B), ESP pumps
(ESP-03, ESP-07, ESP-12), separators (SEP-01, SEP-02), export pipelines (PL-SEG1, PL-SEG2),
and a gas turbine generator (GT-A). Data includes ML health scores (0-100 scale), real-time sensor
readings, physics-informed alerts, maintenance records, RUL estimates, and work orders.

CURRENT DASHBOARD STATE:
- Data anchor: 31 December 2024, 23:00
- Open alerts: {alert_count} ({critical_count} critical)
- Total financial exposure: ${round(total_exposure/1_000_000, 1)}M
- Worst-performing asset: {worst_asset[0] if worst_asset else 'N/A'} (health: {worst_asset[1] if worst_asset else 'N/A'})
{ctx_block}

BEHAVIOUR:
- Always call the relevant tool(s) first — never guess or fabricate sensor values, health scores,
  or financial figures. Ground every answer in tool results.
- When discussing financial exposure, express in USD millions to one decimal place and include the
  BOPD basis when available.
- For alert questions, always state the confidence score and time-to-failure range — these drive urgency.
- For maintenance questions, cite both findings and outcome, and note when next maintenance is due.
- Speak like a senior reliability engineer: concise, technical, action-oriented. Use O&G terms naturally
  (BOPD, RUL, NDE bearing, hi-alarm, ILI, ESP, etc.).
- If asked to take an action (create work order, dismiss alert), explain that actions must be taken
  through the dashboard interface — you are read-only.
- Be direct. Operations managers don't have time for hedging."""


# ── Mock response engine (no API credits required) ────────────────────────────

def _fmt_millions(v: float) -> str:
    return f"${v/1_000_000:.1f}M"

def _severity_icon(s: str) -> str:
    return {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}.get(s, "⚪")

def mock_respond(query: str, executor: ToolExecutor) -> tuple[str, List[str]]:
    q = query.lower()

    # ── Intent: financial exposure / cost of risk
    if any(w in q for w in ["financial", "exposure", "cost", "million", "dollar", "$", "money", "impact"]):
        raw = json.loads(executor.execute("get_financial_exposure", {}))
        alerts_raw = json.loads(executor.execute("get_open_alerts", {}))
        total = raw["total_exposure_usd"]
        lines = [
            f"**Total financial exposure from open alerts: {_fmt_millions(total)}**\n",
            "Breakdown by asset:\n",
        ]
        for a in raw["by_asset"][:6]:
            lines.append(f"• **{a['asset_name']}** — {_fmt_millions(a['exposure'])} across {a['alert_count']} alert(s), {a['bopd']:.0f} BOPD at risk")
        lines.append(f"\nTotal open alerts: {alerts_raw['open_alert_count']}. Prioritise assets at top of this list for immediate work-order action.")
        return "\n".join(lines), ["get_financial_exposure", "get_open_alerts"]

    # ── Intent: open alerts / current risks
    if any(w in q for w in ["alert", "risk", "critical", "warning", "open", "issue", "problem", "danger"]):
        raw = json.loads(executor.execute("get_open_alerts", {}))
        alerts = raw["alerts"][:6]
        lines = [
            f"**{raw['open_alert_count']} open alerts** · total exposure {_fmt_millions(raw['total_financial_exposure_usd'])}\n"
        ]
        for a in alerts:
            icon = _severity_icon(a["severity"])
            ttf = f"{a.get('time_to_failure_min','?')}–{a.get('time_to_failure_max','?')} days"
            lines.append(
                f"{icon} **{a['asset_name']}** [{a['severity'].upper()}] — {a['title']}\n"
                f"   Confidence: {a.get('confidence_score',0)*100:.0f}% · TTF: {ttf} · Impact: {_fmt_millions(a.get('financial_impact_usd',0))}\n"
                f"   Action: {a.get('recommended_action','—')}\n"
            )
        return "\n".join(lines), ["get_open_alerts"]

    # ── Intent: maintenance / overdue / scheduled
    if any(w in q for w in ["maintenance", "overdue", "schedule", "next due", "inspection", "service", "technician", "findings"]):
        raw = json.loads(executor.execute("get_maintenance_history", {}))
        wo_raw = json.loads(executor.execute("get_work_orders", {}))
        active_wo = [w for w in wo_raw if w.get("status") not in ("completed", "cancelled")]
        lines = ["**Maintenance overview**\n"]
        if active_wo:
            lines.append(f"**Active work orders / cases: {len(active_wo)}**")
            for w in active_wo[:4]:
                lines.append(f"• [{w['type'].upper()}] **{w['asset_name']}** — {w['title']} ({w['status']}, {w['priority']} priority)")
            lines.append("")
        if raw:
            lines.append(f"**Recent maintenance records: {len(raw)}**")
            for r in raw[:5]:
                lines.append(f"• **{r['asset_name']}** [{r['type']}] {r['date']} — {r['findings'][:80]}… Next due: {r.get('next_due','—')}")
        return "\n".join(lines), ["get_maintenance_history", "get_work_orders"]

    # ── Intent: RUL / remaining life / failure timeline
    if any(w in q for w in ["rul", "remaining", "life", "fail", "days", "timeline", "how long", "when will"]):
        raw = json.loads(executor.execute("get_rul_estimates", {}))
        lines = ["**Remaining Useful Life estimates (worst first)**\n"]
        for a in raw[:8]:
            urgency_label = {"critical": "⚠️ CRITICAL", "high": "🔶 HIGH", "monitor": "✅ Monitor"}.get(a["urgency"], "")
            rul_min = a.get("rul_min_days")
            rul_max = a.get("rul_max_days")
            rul_str = f"{rul_min}–{rul_max} days" if rul_min is not None else "N/A"
            lines.append(
                f"{urgency_label} **{a['name']}** (health {a['health_score']:.0f}/100)\n"
                f"   RUL: {rul_str} · Degradation: {a['degradation_rate_pts_per_day']:.2f} pts/day\n"
            )
        return "\n".join(lines), ["get_rul_estimates"]

    # ── Intent: sensor / abnormal readings
    if any(w in q for w in ["sensor", "vibration", "temperature", "pressure", "reading", "abnormal", "alarm", "hi-alarm", "lo-alarm"]):
        raw = json.loads(executor.execute("get_asset_status", {}))
        lines = ["**Sensor status across fleet**\n"]
        flagged = []
        for asset in raw:
            for s in asset.get("sensors", []):
                val = s.get("current_value")
                if val is None:
                    continue
                hi = s.get("hi_alarm")
                lo = s.get("lo_alarm")
                if (hi and val > hi) or (lo and val < lo):
                    flagged.append((asset["name"], s["name"], val, s["unit"], hi, lo))
        if flagged:
            lines.append(f"**{len(flagged)} sensor(s) outside alarm limits:**\n")
            for asset_name, sname, val, unit, hi, lo in flagged[:8]:
                direction = "above hi-alarm" if hi and val > hi else "below lo-alarm"
                lines.append(f"• **{asset_name}** — {sname}: {val:.2f} {unit} ({direction})")
        else:
            lines.append("No sensors currently outside their alarm limits.")
        return "\n".join(lines), ["get_asset_status"]

    # ── Intent: work orders / cases
    if any(w in q for w in ["work order", "case", "assigned", "pending", "wo", "action"]):
        raw = json.loads(executor.execute("get_work_orders", {}))
        active = [w for w in raw if w.get("status") not in ("completed", "cancelled")]
        lines = [f"**Work orders & cases: {len(raw)} total, {len(active)} active**\n"]
        for w in active[:6]:
            lines.append(
                f"• [{w['type'].upper()}] **{w['asset_name']}** — {w['title']}\n"
                f"   Status: {w['status']} · Priority: {w['priority']} · Assigned: {w.get('assigned_to') or 'Unassigned'} · Due: {w.get('target_date') or '—'}"
            )
        if not active:
            lines.append("No active work orders at this time.")
        return "\n".join(lines), ["get_work_orders"]

    # ── Default: fleet health summary
    raw = json.loads(executor.execute("compare_assets", {}))
    alerts_raw = json.loads(executor.execute("get_open_alerts", {}))
    fin_raw = json.loads(executor.execute("get_financial_exposure", {}))
    lines = [
        f"**Fleet health summary — {len(raw)} assets monitored**\n",
        f"Open alerts: **{alerts_raw['open_alert_count']}** · Total exposure: **{_fmt_millions(fin_raw['total_exposure_usd'])}**\n",
        "Asset health ranking (worst first):\n",
    ]
    for a in raw:
        bar = "█" * int(a["health_score"] / 10) + "░" * (10 - int(a["health_score"] / 10))
        lines.append(
            f"• **{a['name']}** [{a['type']}] {bar} {a['health_score']:.0f}/100 — "
            f"{a['open_alerts']} alert(s), degrading {a['degradation_rate']:.2f} pts/day"
        )
    return "\n".join(lines), ["compare_assets", "get_open_alerts", "get_financial_exposure"]


# ── Chat endpoint ─────────────────────────────────────────────────────────────

@router.post("/")
def chat(body: ChatRequest, db: Session = Depends(get_db)):
    executor = ToolExecutor(db)
    last_user_msg = next(
        (m.content for m in reversed(body.messages) if m.role == "user"), ""
    )
    response_text, tools_used = mock_respond(last_user_msg, executor)
    return {"response": response_text, "tools_used": tools_used}
