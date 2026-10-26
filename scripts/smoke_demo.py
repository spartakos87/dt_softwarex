"""Smoke-test HTTP + demo MQTT ingestion using Python stdlib."""
import json
import os
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
ENV={}
for line in (ROOT/'.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key,value=line.split('=',1)
        ENV[key]=value
BASE='http://localhost:7781'

def request(path,data=None,token=None):
    headers={'Accept':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    if data is not None:headers['Content-Type']='application/x-www-form-urlencoded'
    with urlopen(Request(BASE+path,data=data,headers=headers),timeout=10) as f:
        return json.load(f)

for attempt in range(30):
    try:
        health=request('/health')
        assert health['status']=='ok';break
    except Exception:
        time.sleep(2)
else:raise RuntimeError('Backend not reachable on port 7781')
form=urlencode({'username':ENV.get('DEMO_USERNAME','demo'),'password':ENV['DEMO_PASSWORD']}).encode()
token=request('/api/v1/login',form)['access_token']
for attempt in range(15):
    names=request('/api/v1/getSensorNames',token=token)
    all_sensors=request('/api/v1/sensors',token=token)
    if isinstance(all_sensors, dict):
        has_measurements = any(row.get('latest_data') for group in all_sensors.values() for row in group)
    else:
        has_measurements = False
    if has_measurements:
        break
    time.sleep(2)
else:raise RuntimeError('No synthetic observations found')
print('Smoke test passed: authenticated sensors and synthetic measurements loaded.')
print('Registered scene sensor names:',names)
