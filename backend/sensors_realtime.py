"""MQTT-to-PostgreSQL adapter for registered building sensors."""
import json
import logging
import os
import paho.mqtt.client as mqtt
from utils.db_utils import connect_to_db
from utils.mqtt_payload import parse_sensor_message

log=logging.getLogger(__name__)
AIR_QUALITY_IDS=set()
ENERGY_METER_IDS=set()
HEATER_IDS=set()

def get_sensor_ids():
    conn=connect_to_db()
    if conn is None: return
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT s.id, st.type FROM sensors s JOIN sensor_types st ON st.id=s.type_id')
            rows=cur.fetchall()
        AIR_QUALITY_IDS.clear();ENERGY_METER_IDS.clear();HEATER_IDS.clear()
        lookup={'AirQuality':AIR_QUALITY_IDS,'EnergyMeter':ENERGY_METER_IDS,'Heater':HEATER_IDS}
        for identifier,kind in rows:
            if kind in lookup:lookup[kind].add(identifier)
    finally:conn.close()

def categorize_device(equipment_id):
    if equipment_id in AIR_QUALITY_IDS:return 'AirQuality'
    if equipment_id in ENERGY_METER_IDS:return 'EnergyMeter'
    if equipment_id in HEATER_IDS:return 'Heater'
    return None


def add_sensor_data_to_db(equipment_id,timestamp,values):
    conn=connect_to_db()
    if conn is None:return
    try:
        with conn.cursor() as cur:
            cur.execute('UPDATE sensors SET latest_data=%s,last_updated=%s WHERE id=%s',
                (json.dumps(values),timestamp,equipment_id))
            if cur.rowcount == 0:
                conn.rollback(); return
            cur.execute('INSERT INTO sensor_data (sensor_id,data,timestamp) VALUES (%s,%s,%s)',
                (equipment_id,json.dumps(values),timestamp))
            limit=int(os.getenv('HISTORY_MAX_RECORDS','0'))
            if limit>0:
                cur.execute("""DELETE FROM sensor_data WHERE sensor_id=%s AND id NOT IN
                    (SELECT id FROM sensor_data WHERE sensor_id=%s ORDER BY timestamp DESC,id DESC LIMIT %s)""",
                    (equipment_id,equipment_id,limit))
        conn.commit()
    except Exception:
        conn.rollback();log.exception('Could not persist sensor measurement')
    finally:conn.close()

def on_connect(client,userdata,flags,reason_code,properties):
    if reason_code==0:
        topic=os.getenv('MQTT_TOPIC','demo/sensors/#')
        client.subscribe(topic)
        log.info('MQTT connected; subscription=%s',topic)
    else:log.error('MQTT connect failed: %s',reason_code)

def on_message(client,userdata,msg):
    parsed=parse_sensor_message(msg.topic,msg.payload)
    if parsed and categorize_device(parsed[0]):
        add_sensor_data_to_db(*parsed)

def start_sensor_listener():
    get_sensor_ids()
    client=mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    username=os.getenv('MQTT_USERNAME')
    if username:client.username_pw_set(username,os.getenv('MQTT_PASSWORD'))
    client.on_connect=on_connect
    client.on_message=on_message
    client.connect_async(os.getenv('MQTT_BROKER','mosquitto'),int(os.getenv('MQTT_PORT','1883')),60)
    client.loop_start()
    return client
