"""Deterministic-looking synthetic sensor stream for the local demo, not a benchmark."""
import json
import math
import os
import random
import time
from datetime import datetime, timezone

def build_payload(kind:str,tick:int,seed:int=17):
    rng=random.Random(seed+tick)
    if kind=='air':
        values={'temperature':round(21+math.sin(tick/12)+rng.uniform(-.25,.25),2),
                'humidity':round(45+rng.uniform(-3,3),2), 'co2':round(650+rng.uniform(-80,80)),
                'Temperature':22.0}
    elif kind=='energy':
        pa=350+10*math.sin(tick/8)
        pb=340+8*math.sin(tick/7)
        pc=360+9*math.cos(tick/10)
        values={'a_act_power':round(pa,2),'b_act_power':round(pb,2),'c_act_power':round(pc,2),
          'total_act_power':round(pa+pb+pc,2),'total_aprt_power':1150.,
          'a_voltage':230.0,'b_voltage':229.7,'c_voltage':230.2,
          'a_pf':.95,'b_pf':.96,'c_pf':.94,'total_act':round((pa+pb+pc)*(tick+1)/3600,2),
          'total_act_ret':0}
    else:
        values={'Temperature':round(20.5+math.sin(tick/10),2),
                'TargetTemperature':21.5,'ValvePosition':45,'Battery':90}
    return {'Timestamp':datetime.now(timezone.utc).isoformat(),
            'Measurements':[{'Value':values}]}

def main():
    import paho.mqtt.client as mqtt
    client=mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    host=os.getenv('MQTT_BROKER','mosquitto')
    while True:
        try: client.connect(host,int(os.getenv('MQTT_PORT','1883')),60); break
        except OSError:time.sleep(2)
    client.loop_start()
    devices=[('demo-iaq-kitchen','air'),('demo-iaq-office','air'),
             ('demo-energy-lab','energy'),('demo-heater-lab','heater'),('demo-heater-office','heater')]
    step=0
    try:
        while True:
            for identifier,kind in devices:
                message=json.dumps(build_payload(kind,step))
                client.publish(f'demo/sensors/{identifier}',message,qos=1)
            step+=1
            time.sleep(float(os.getenv('DEMO_INTERVAL_SECONDS','5')))
    finally:
        client.disconnect();client.loop_stop()

if __name__=='__main__':main()
