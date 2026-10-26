# backend/routers/energy.py
from fastapi import APIRouter, HTTPException, Depends
from utils.security import get_current_user
from utils.db_utils import connect_to_db

router = APIRouter(tags=["HeaterSensors"])

@router.get("/heater")
def get_heater_data(current_user: str = Depends(get_current_user)):
    conn = connect_to_db()
    if not conn:
        raise HTTPException(status_code=403, detail="Database connection failed")

    cursor = conn.cursor()

    # Get latest row per heater sensor
    cursor.execute("""
        SELECT
            sensor.id, 
            sensor.name,
            sensor.last_updated AS timestamp,
            sensor.latest_data->>'ValvePosition' AS valve_position, 
            sensor.latest_data->>'TargetTemperature' AS target_temperature,
            sensor.latest_data->>'Temperature' AS temperature,
            sensor.latest_data->>'Battery' AS battery
        FROM sensors as sensor, sensor_types as stype
        WHERE sensor.type_id = stype.id
        AND stype.type = 'Heater'
        ORDER BY name, id, timestamp DESC
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    if not rows:
        raise HTTPException(status_code=404, detail="No heater data found")

    results = {}
    for row in rows:
        sensor_id, name, timestamp, valve_position, target_temperature, temperature, battery = row

        results[sensor_id] = {
            "Timestamp": timestamp.isoformat() if timestamp else None,
            "Name": name,
            "Type": "Heater",
            "Measurements": [
                {
                    "Value": {
                        "ValvePosition": float(valve_position) if valve_position else None,
                        "TargetTemperature": float(target_temperature) if target_temperature else None,
                        "Temperature": float(temperature) if temperature else None,
                        "Battery": float(battery) if battery else None
                    }
                }
            ]
        }

    return results

@router.get("/getSensorNotifications")
def get_sensor_notifications(current_user: str = Depends(get_current_user)):
    notifications = []
    conn = connect_to_db()
    if not conn:
        raise HTTPException(status_code=403, detail="Database connection failed")
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT ON (s.id)
            s.id,
                s.name,
                s.last_updated   AS timestamp,
                (s.latest_data->>'ValvePosition')::FLOAT        AS valve_position,
                (s.latest_data->>'TargetTemperature')::FLOAT  AS target_temperature,
                (s.latest_data->>'Temperature')::FLOAT        AS temperature,
                (s.latest_data->>'Battery')::FLOAT              AS battery
            FROM sensors AS s
            JOIN sensor_types AS st 
            ON s.type_id = st.id
            WHERE st.type = 'Heater'
            AND s.latest_data->>'ValvePosition'    IS NOT NULL
            AND s.latest_data->>'TargetTemperature' IS NOT NULL
            AND s.latest_data->>'Temperature'       IS NOT NULL
            AND s.latest_data->>'Battery'           IS NOT NULL
            ORDER BY 
                s.id,
                s.last_updated DESC;
        """)
    notifications = cursor.fetchall()
    cursor.close()
    conn.close()
    if not notifications:
        return []
    return notifications