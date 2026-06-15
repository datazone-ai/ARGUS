import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from openai import AzureOpenAI
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.database import get_db

load_dotenv()

router = APIRouter(prefix="/chat", tags=["chat"])

ANCHOR = datetime(2024, 12, 31, 23, 0, 0)

_client: Optional[AzureOpenAI] = None

def get_client() -> AzureOpenAI:
    global _client
    if _client is None:
        _client = AzureOpenAI(
            api_key=os.environ["AZURE_OPENAI_API_KEY"],
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_version=os.environ["AZURE_OPENAI_API_VERSION"],
        )
    return _client


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


# ── Tool definitions (OpenAI format) ─────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_open_alerts",
            "description": (
                "Get currently open alerts, optionally filtered by severity or asset. "
                "Returns alert details including observation, recommended action, financial impact, "
                "and time-to-failure range. Use for questions about current risks, critical issues, "
                "or financial exposure."
            ),
            "parameters": {
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
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_asset_status",
            "description": (
                "Get health score, status, sensor readings, and metadata for one or all assets. "
                "Use for questions about asset condition, health scores, or comparing assets."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_id": {
                        "type": "string",
                        "description": "Specific asset ID. Leave empty to get all assets."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_sensor_history",
            "description": (
                "Get recent sensor readings for a specific sensor. Use for trend questions, "
                "vibration history, temperature trends, or pressure analysis. "
                "Returns hourly averages to keep response size manageable."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_id": {"type": "string"},
                    "sensor_id": {"type": "string", "description": "Full sensor ID e.g. COMP-A-VIB-NDE"},
                    "hours": {"type": "integer", "description": "Hours of history (default 168 = 7 days)"}
                },
                "required": ["asset_id", "sensor_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_maintenance_history",
            "description": (
                "Get maintenance records for an asset, optionally filtered by year or type. "
                "Use for questions about past inspections, outcomes, findings, and next due dates."
            ),
            "parameters": {
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
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_rul_estimates",
            "description": (
                "Get Remaining Useful Life (RUL) estimates for all assets or a specific one. "
                "Returns health score, degradation rate (pts/day), and min/max days to failure. "
                "Use for questions about when assets might fail or how urgent maintenance is."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_id": {"type": "string"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_financial_exposure",
            "description": (
                "Get total financial exposure from open alerts, broken down by asset. "
                "Use for questions about cost of risk, deferred production value, or prioritisation by financial impact."
            ),
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_work_orders",
            "description": (
                "Get work orders and cases, optionally filtered by status or asset. "
                "Use for questions about ongoing maintenance actions, who is assigned, and target dates."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["confirmed", "in_progress", "completed", "cancelled"]},
                    "asset_id": {"type": "string"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_sensor_list",
            "description": (
                "List all sensors on an asset with their current values, baseline, alarm limits, and status. "
                "Use to discover sensor IDs before calling get_sensor_history, or to get a snapshot of all sensor states."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_id": {"type": "string"}
                },
                "required": ["asset_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "compare_assets",
            "description": (
                "Compare health scores, degradation rates, and open alert counts across all assets. "
                "Use for ranking questions: 'which assets are worst', 'sort by urgency', etc."
            ),
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_health_trend",
            "description": (
                "Get daily health score history for an asset over the last N days. "
                "Use for questions about whether an asset is improving or declining over time."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_id": {"type": "string"},
                    "days": {"type": "integer", "description": "Number of days (default 14)"}
                },
                "required": ["asset_id"]
            }
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


# ── System prompt ─────────────────────────────────────────────────────────────

def build_system_prompt(context: Optional[ChatContext], db: Session) -> str:
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


# ── GPT-4o tool-use loop ──────────────────────────────────────────────────────

def run_chat(messages: List[Dict], system_prompt: str, executor: ToolExecutor) -> tuple[str, List[str]]:
    client = get_client()
    deployment = os.environ["AZURE_OPENAI_DEPLOYMENT"]
    tools_used: List[str] = []

    api_messages = [{"role": "system", "content": system_prompt}] + messages

    for _ in range(6):  # max 6 agentic turns
        response = client.chat.completions.create(
            model=deployment,
            messages=api_messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.2,
            max_tokens=1500,
        )

        choice = response.choices[0]
        assistant_msg = choice.message

        if not assistant_msg.tool_calls:
            return assistant_msg.content or "", tools_used

        # Append assistant turn with tool calls
        api_messages.append(assistant_msg)

        # Execute each tool call and append results
        for tc in assistant_msg.tool_calls:
            fn_name = tc.function.name
            fn_args = json.loads(tc.function.arguments)
            tools_used.append(fn_name)
            result = executor.execute(fn_name, fn_args)
            api_messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

    # Fallback: ask for a final answer without tools
    api_messages.append({"role": "user", "content": "Please summarise what you found."})
    response = client.chat.completions.create(
        model=deployment,
        messages=api_messages,
        temperature=0.2,
        max_tokens=1000,
    )
    return response.choices[0].message.content or "", tools_used


# ── Chat endpoint ─────────────────────────────────────────────────────────────

@router.post("/")
def chat(body: ChatRequest, db: Session = Depends(get_db)):
    executor = ToolExecutor(db)
    system_prompt = build_system_prompt(body.context, db)

    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    try:
        response_text, tools_used = run_chat(messages, system_prompt, executor)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"response": response_text, "tools_used": tools_used}
