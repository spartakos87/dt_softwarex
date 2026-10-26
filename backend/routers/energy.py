# backend/routers/energy.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import pandas as pd
from utils.security import get_current_user
from utils.db_utils import connect_to_db
import os
from typing import Dict, Any
from datetime import datetime, timezone

router = APIRouter(tags=["EnergySensors"])

@router.get("/energy")
def get_all_energy_data(current_user: str = Depends(get_current_user)):
    conn = connect_to_db()
    if not conn:
        raise HTTPException(status_code=403, detail="Database connection failed")

    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            s.id,
            s.name,
            s.location,
            s.last_updated AS timestamp,
            (s.latest_data->>'a_act_power')::float    AS a_act,
            (s.latest_data->>'b_act_power')::float    AS b_act,
            (s.latest_data->>'c_act_power')::float    AS c_act,
            (s.latest_data->>'total_act_power')::float  AS total_act,
            (s.latest_data->>'total_aprt_power')::float AS total_aprt,
            (s.latest_data->>'a_voltage')::float      AS a_voltage,
            (s.latest_data->>'b_voltage')::float      AS b_voltage,
            (s.latest_data->>'c_voltage')::float      AS c_voltage,
            (s.latest_data->>'total_act')::float      AS total_energy,
            (s.latest_data->>'total_act_ret')::float  AS total_ret_energy
        FROM sensors s
        JOIN sensor_types st ON s.type_id = st.id
        WHERE st.type = 'EnergyMeter'
          AND s.latest_data IS NOT NULL
        ORDER BY s.name, s.id, s.last_updated DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    if not rows:
        raise HTTPException(status_code=404, detail="No energy data found")

    results = {}
    tariff_id = 0
    for r in rows:
        (sensor_id, name, location, timestamp, a_act, b_act, c_act, total_act,
         total_aprt, a_volt, b_volt, c_volt, total_energy, total_ret_energy) = r

        # Power factor
        pf = total_act / total_aprt if total_aprt and total_aprt > 0 else 0.0

        # Phase imbalance
        phases = [a_act, b_act, c_act]
        avg = sum(phases) / 3.0 if sum(phases) > 0 else None
        imbalance = {}
        if avg and avg > 0:
            imbalance = {
                "A": round((a_act - avg) / avg * 100, 1),
                "B": round((b_act - avg) / avg * 100, 1),
                "C": round((c_act - avg) / avg * 100, 1),
            }

        # Voltage stats
        max_voltage = max(a_volt, b_volt, c_volt)
        min_voltage = min(a_volt, b_volt, c_volt)

        # Reverse detection
        reversed_flow = total_ret_energy > total_energy

        # Missing data
        required_keys = [a_act, b_act, c_act, total_act, total_aprt, a_volt, b_volt, c_volt]
        missing_data = any(v is None for v in required_keys)

        # Cost estimation (if you know tariff rate)
        tariff_rate = 0.15  # €/kWh (example)
        consumption_kwh = total_energy / 1000 if total_energy else 0
        cost = round(consumption_kwh * tariff_rate, 2)

        results[sensor_id] = {
            "id": sensor_id,
            "name": name,
            "location": location,
            "type": "EnergyMeter",
            "datetime": timestamp.isoformat() if timestamp else None,
            "total_active_power_kw": round(total_act, 3),
            "consumption_kwh": round(consumption_kwh, 3),
            "cost": cost,
            "max_voltage": round(max_voltage, 2),
            "min_voltage": round(min_voltage, 2),
            "reversed": reversed_flow,
            "tariff_id": tariff_id,
            "tariff_rate": tariff_rate,
            "missing": missing_data,
            "power_factor": round(pf, 3),
            "phase_imbalance_percent": imbalance
        }

    return results

def _epoch_to_iso(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return datetime.fromtimestamp(val, tz=timezone.utc).isoformat()
    return str(val)

def _safe_minmax(values):
    nums = [v for v in values if isinstance(v, (int, float))]
    if not nums:
        return None, None
    return min(nums), max(nums)

def _normalize_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    raw = payload.get("data", payload)  # accept flat or {"data": {...}}

    # ID
    entity_id = raw.get("ID") or raw.get("id") or raw.get("device_id")

    # Datetime: ISO or epoch in: Datetime/datetime/timestamp/ts
    dt = raw.get("Datetime") or raw.get("datetime") or raw.get("timestamp") or raw.get("ts")
    dt_iso = _epoch_to_iso(dt)

    # Voltages: could be single or phases A/B/C
    vA, vB, vC = raw.get("A"), raw.get("B"), raw.get("C")
    if any(v is not None for v in (vA, vB, vC)):
        vmin, vmax = _safe_minmax([vA, vB, vC])
    else:
        v = raw.get("voltage") or raw.get("Voltage")
        vmin = vmax = v

    return {
        "ID": entity_id,
        "Datetime": dt_iso,
        "Name": raw.get("Name") or raw.get("name"),
        "Location": raw.get("Location") or raw.get("location"),
        "Active Power": raw.get("Active Power") or raw.get("active_power") or raw.get("power"),
        "Power Factor": raw.get("Power Factor") or raw.get("power_factor") or raw.get("pf"),
        "Consumption Cost": raw.get("Consumption Cost") or raw.get("cost"),
        "Max Voltage": raw.get("Max Voltage") or vmax,
        "Min Voltage": raw.get("Min Voltage") or vmin,
        "Reversed": raw.get("Reversed") or raw.get("reversed") or 0,
        "Missing": raw.get("Missing") or raw.get("missing") or 0,
    }

@router.get("/energy/ai/{sensor_id}")
def predict_energy_next(sensor_id: str, current_user: str = Depends(get_current_user)):
    if os.getenv('ENABLE_LSTM','0') != '1':
        raise HTTPException(status_code=503, detail='Optional LSTM inference disabled for the demo')
    try:
        from ai.LSTM import LSTM_helper  # trusted local artifacts only
    except (ImportError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="LSTM dependencies or artifacts unavailable") from exc
    # Fetch last SEQLEN rows (newest first), then pass to helper
    conn = connect_to_db()
    if not conn:
        raise HTTPException(status_code=403, detail="Database connection failed")
    cur = conn.cursor()
    cur.execute(
                    """
                    SELECT data, timestamp
                    FROM sensor_data
                    WHERE sensor_id = %s
                    ORDER BY timestamp DESC
                    LIMIT %s
                    """,
                    (sensor_id, LSTM_helper.SEQLEN),
                )
    fetched = cur.fetchall()  # list[(dict, datetime)]
    
    if not fetched:
        raise HTTPException(status_code=404, detail="No data found for this sensor.")

    # LSTM_helper takes care of sorting and shaping
    result = LSTM_helper.predict_next_from_db_rows(sensor_id, fetched)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result

@router.get("/energy/notifications")
def get_energy_notifications(current_user: str = Depends(get_current_user)):
    conn = connect_to_db()
    if not conn:
        raise HTTPException(403, "Database connection failed")
    cur = conn.cursor()
    cur.execute("""
        SELECT
          s.id,
          s.name,
          (s.latest_data->>'a_act_power')::float    AS a_act,
          (s.latest_data->>'b_act_power')::float    AS b_act,
          (s.latest_data->>'c_act_power')::float    AS c_act,
          (s.latest_data->>'total_act_power')::float AS total_act,
          (s.latest_data->>'total_aprt_power')::float AS total_aprt
        FROM sensors s
        JOIN sensor_types st ON s.type_id = st.id
        WHERE st.type = 'EnergyMeter'
          AND s.latest_data->>'total_act_power'    IS NOT NULL
          AND s.latest_data->>'total_aprt_power'   IS NOT NULL
          AND s.latest_data->>'a_act_power'        IS NOT NULL
          AND s.latest_data->>'b_act_power'        IS NOT NULL
          AND s.latest_data->>'c_act_power'        IS NOT NULL
        ORDER BY s.last_updated DESC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    notes = []
    for sensor_id, name, a_act, b_act, c_act, total_act, total_aprt in rows:
        # 1) Low power factor
        if total_aprt > 0:
            pf = total_act / total_aprt
            if pf < 0.8:
                notes.append({
                    "id":    f"energy-{sensor_id}-pf",
                    "type":  "EnergyMeter",
                    "metric": "PowerFactor",
                    "severity": "Moderate",
                    "message": f"Sensor {name} low power factor: {pf:.2f}"
                })

        # 2) Phase imbalance
        phases = [a_act, b_act, c_act]
        avg = sum(phases) / 3.0
        for phase_label, val in zip(("A","B","C"), phases):
            if avg > 0:
                deviation = (val - avg) / avg
                if abs(deviation) > 0.25:
                    pct = deviation * 100
                    notes.append({
                        "id":     f"energy-{sensor_id}-imbalance-{phase_label}",
                        "type":   "EnergyMeter",
                        "metric": "PhaseImbalance",
                        "severity": "Moderate",
                        "message": (
                            f"Sensor {name} phase {phase_label} "
                            f"{'high' if pct>0 else 'low'} by {abs(pct):.0f}%"
                        )
                    })
    return notes