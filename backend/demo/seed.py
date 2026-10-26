"""Idempotent synthetic metadata and salted demo-account initialization."""
import os
import psycopg2
from utils.passwords import hash_password
from utils.db_utils import connect_to_db

SENSORS=[
 ('demo-iaq-kitchen','AirQuality_Kitchen','Kitchen',0,'AirQuality'),
 ('demo-iaq-office','AirQuality_Office','Office',1,'AirQuality'),
 ('demo-energy-lab','EnergyMeter_Lab','Laboratory',0,'EnergyMeter'),
 ('demo-heater-lab','Heater_Lab','Laboratory',0,'Heater'),
 ('demo-heater-office','Heater_Office','Office',1,'Heater'),
]

def seed():
    pwd=os.environ['DEMO_PASSWORD']
    conn=connect_to_db()
    if conn is None: raise RuntimeError('Database unavailable for demo seed')
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO buildings(id,name) VALUES (1,'Synthetic Demo Building') ON CONFLICT(id) DO NOTHING")
            for typ in ('AirQuality','EnergyMeter','Heater'):
                cur.execute('INSERT INTO sensor_types(type) VALUES (%s) ON CONFLICT(type) DO NOTHING',(typ,))
            cur.execute('INSERT INTO users(username,password,building_id) VALUES (%s,%s,1) '
                'ON CONFLICT(username) DO UPDATE SET password=EXCLUDED.password',
                (os.getenv('DEMO_USERNAME','demo'),hash_password(pwd)))
            for identifier,name,location,floor,kind in SENSORS:
                cur.execute("""INSERT INTO sensors(id,name,location,floor,building_id,type_id)
                    VALUES (%s,%s,%s,%s,1,(SELECT id FROM sensor_types WHERE type=%s))
                    ON CONFLICT(id) DO NOTHING""",(identifier,name,location,floor,kind))
        conn.commit()
        print(f'Synthetic demo seeded: {len(SENSORS)} metadata records; no real building dataset')
    except Exception:
        conn.rollback(); raise
    finally:conn.close()

if __name__=='__main__':seed()
