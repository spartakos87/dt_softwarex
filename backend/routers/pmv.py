# backend/routers/pmv.py
from fastapi import APIRouter, HTTPException, Query, Depends
from pythermalcomfort.models import pmv_ppd_iso
from utils.security import get_current_user
from utils.db_utils import connect_to_db
import math

router = APIRouter(tags=["PMV"])

@router.get("/pmv")
def get_pmv(
    met: float = Query(1.1, description="Metabolic rate (met)"),
    clo: float = Query(0.5, description="Clothing insulation (clo)"),
    v_air: float = Query(0.1, description="Air velocity in m/s"),
    current_user: str = Depends(get_current_user)
):
    """
    Calculate PMV/PPD for all AirQuality sensors using passed parameters.
    Query parameters:
      - met: metabolic rate (default 1.1)
      - clo: clothing insulation (default 0.5)
      - v_air: air velocity in m/s (default 0.1)
    Returns a list of sensor results.
    """
    conn = connect_to_db()
    if not conn:
        raise HTTPException(status_code=403, detail="Database connection failed")

    cursor = conn.cursor()
    # Cast JSON fields to float directly in SQL
    cursor.execute("""
        SELECT
            s.id,
            s.name,
            s.last_updated AS timestamp,
            (s.latest_data->>'temperature')::float AS temperature,
            (s.latest_data->>'humidity')::float AS humidity
        FROM sensors s
        JOIN sensor_types st ON s.type_id = st.id
        WHERE st.type = 'AirQuality'
          AND s.latest_data->>'temperature' IS NOT NULL
          AND s.latest_data->>'humidity' IS NOT NULL
        ORDER BY s.name, s.id, timestamp DESC
    """
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    # Return empty list if no data
    if not rows:
        raise HTTPException(status_code=404, detail="No AirQuality sensors found")

    results = []
    for sensor_id, name, timestamp, temperature, humidity in rows:
        # Skip NaNs
        if math.isnan(temperature) or math.isnan(humidity):
            continue

        # perform PMV/PPD calculation
        res = pmv_ppd_iso(
            tdb=temperature,
            tr=temperature,
            vr=v_air,
            rh=humidity,
            met=met,
            clo=clo,
            model="7730-2005"
        )

        # skip invalid values
        if math.isnan(res.pmv) or math.isnan(res.ppd):
            continue

        pmv_val = round(res.pmv, 2)
        ppd_val = round(res.ppd, 1)
        status = (
            "Comfortable" if abs(pmv_val) < 0.5
            else "Moderate" if abs(pmv_val) < 0.7
            else "Uncomfortable"
        )

        results.append({
            "id": sensor_id,
            "name": name,
            "type": "AirQuality",
            "timestamp": timestamp.isoformat() if timestamp else None,
            "temperature": temperature,
            "humidity": humidity,
            "pmv": pmv_val,
            "ppd": ppd_val,
            "status": status
        })

    return results
