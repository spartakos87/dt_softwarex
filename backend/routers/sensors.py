from fastapi import APIRouter, HTTPException, Depends
from utils.security import get_current_user
from utils.db_utils import connect_to_db
from datetime import datetime, timedelta
from ai.ai_features import detect_anomalies, getStatus

router = APIRouter(tags=["Sensors"])

def fetch_data_as_dict(cursor, query):
    cursor.execute(query)
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]

@router.get("/sensors")
def get_all_sensor_data(current_user: str = Depends(get_current_user)):
    sensors_data = {}
    conn = connect_to_db()
    if conn:
        cursor = conn.cursor()
        sensors_data["EnergyMeter"] = fetch_data_as_dict(cursor, "SELECT * FROM sensors WHERE type_id = (SELECT id FROM sensor_types WHERE type = 'EnergyMeter')")
        sensors_data["AirQuality"] = fetch_data_as_dict(cursor, "SELECT * FROM sensors WHERE type_id = (SELECT id FROM sensor_types WHERE type = 'AirQuality')")
        sensors_data["Heater"] = fetch_data_as_dict(cursor, "SELECT * FROM sensors WHERE type_id = (SELECT id FROM sensor_types WHERE type = 'Heater')")
        cursor.close()
        conn.close()
        if not any(sensors_data.values()):
            raise HTTPException(status_code=404, detail="No sensor data found")
        return sensors_data

@router.get("/getSensorNames")
def get_sensor_names(current_user: str = Depends(get_current_user)):
    sensor_names = []
    conn = connect_to_db()
    if not conn:
        raise HTTPException(status_code=403, detail="Database connection failed")
    cursor = conn.cursor()
    cursor.execute("SELECT name, floor FROM sensors ORDER BY floor, name")
    sensors = cursor.fetchall()
    cursor.close()
    conn.close()
    if not sensors:
        raise HTTPException(status_code=404, detail="No sensors found")
    return sensors

@router.get("/getSensorData/{sensor_name}")
def get_sensor_data(sensor_name: str, current_user: str = Depends(get_current_user)):
    conn = connect_to_db()
    if not conn:
        raise HTTPException(status_code=403, detail="Database connection failed")
    
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sensors WHERE name = %s", (sensor_name,))
    sensor_data = cursor.fetchone()
    columns = [col[0] for col in cursor.description]
    
    cursor.close()
    conn.close()
    
    if not sensor_data:
        raise HTTPException(status_code=404, detail=f"Sensor '{sensor_name}' not found")
    
    return dict(zip(columns, sensor_data))
    
@router.get("/sensor/status/{ai_enabled}")
async def get_sensor_status(ai_enabled: bool = False, current_user: str = Depends(get_current_user)):
    # If AI, fetch raw DB rows and call detect_anomalies(...)
    anomalies = []
    if ai_enabled:
        conn = connect_to_db()
        if not conn:
            raise HTTPException(status_code=403, detail="Database connection failed")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * 
              FROM sensors AS s
              JOIN sensor_types AS st 
                ON s.type_id = st.id
             WHERE s.building_id = 1
        """)
        sensorData = cursor.fetchall()
        cursor.close()
        conn.close()

        if sensorData:
            anomalies = await detect_anomalies(sensorData)

    # Build a lookup: sensor_id -> anomaly dict
    anomaly_map = { a["id"]: a for a in anomalies }

    # Now do your normal fetch for allSensors
    conn = connect_to_db()
    if not conn:
        raise HTTPException(status_code=403, detail="Database connection failed")
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            s.id,
            s.name,
            s.location,
            S.floor,
            s.last_updated,
            s.latest_data,
            st.type
        FROM sensors AS s
        JOIN sensor_types AS st
          ON s.type_id = st.id
        WHERE s.building_id = 1
        ORDER BY s.type_id DESC, s.name;
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    if not rows:
        raise HTTPException(status_code=404, detail="No sensors found")
    
    now = datetime.now()
    allSensors = []

    for sensor_id, name, location, floor, last_updated, latest_data, sensor_type in rows:
        ld = latest_data or {}
        status = "green"
        messages = [
            f"Sensor ID: {sensor_id}",
            f"Sensor type: {sensor_type}",
            f"Location: {location}",
            "DATA"
        ]

        # last‐seen check
        if not last_updated or (now - last_updated) > timedelta(hours=2):
            status = "red"
            messages.append("No data received for more than 2 hours")
        else:
            messages.append("Sensor is Online")

        # heater checks...
        if sensor_type == "Heater":
            batt = ld.get("Battery")
            if batt is not None and batt == 0 and status != "red":
                status = "red"
                messages.append(f"Battery at {batt}%")
            if batt is not None and batt < 10 and status != "red":
                status = "yellow"
                messages.append(f"Battery low: {batt}%")
            vp = ld.get("ValvePosition")
            if vp is not None and vp < 10 and status != "red":
                status = "yellow"
                messages.append(f"Valve position is too low: {vp}%")

        # __insert AI results here__
        if ai_enabled:
            messages.append("DATA")
            a = anomaly_map.get(sensor_id)
            if a:
                # override status if you like
                messages.append(f"Anomaly score: {a['score']:.3f}")
                if a["status"] != "green":
                    messages.append(f"Anomaly detected: {a['status']}")
                if a["anomalous_features"]:
                    messages.append("Anomalous features: " + ", ".join(a["anomalous_features"]))
                status = getStatus(status, a["status"])
        allSensors.append({
            "id": sensor_id,
            "name": name,
            "location": location,
            "floor": floor,
            "type": sensor_type,
            "last_seen": last_updated.isoformat() if last_updated else None,
            "latest_data": ld,
            "status": status,
            "messages": messages
        })

    return allSensors

@router.get("/sensor/history/{sensor_id}")
async def get_sensor_history(sensor_id: str, current_user: str = Depends(get_current_user)):
    conn = connect_to_db()
    if not conn:
        raise HTTPException(status_code=403, detail="Database connection failed")
    
    cursor = conn.cursor()
    cursor.execute("""
        SELECT data, timestamp 
        FROM sensor_data 
        WHERE sensor_id = %s 
        ORDER BY timestamp ASC
    """, (sensor_id,))
    
    history = cursor.fetchall()
    cursor.close()
    conn.close()
    
    if not history:
        raise HTTPException(status_code=404, detail=f"No history found for sensor ID '{sensor_id}'")
    
    return [{"data": row[0], "timestamp": row[1].isoformat()} for row in history]
