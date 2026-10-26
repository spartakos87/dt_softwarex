"""Pure MQTT payload schema/parser; independent of the broker and DB drivers."""
import json
from datetime import datetime, timezone

def parse_sensor_message(topic: str,payload: bytes):
    """Pure parser: returns (device_id, UTC-naive timestamp, values) or None."""
    if not topic or not isinstance(payload,(bytes,bytearray)) or len(payload)>64_000:return None
    try:
        data=json.loads(payload)
        stamp=data.get('Timestamp')
        measurements=data.get('Measurements')
        if not isinstance(stamp,str) or not isinstance(measurements,list) or not measurements:return None
        values=measurements[0].get('Value') if isinstance(measurements[0],dict) else None
        if not isinstance(values,dict):return None
        ts=datetime.fromisoformat(stamp.replace('Z','+00:00'))
        if ts.tzinfo:ts=ts.astimezone(timezone.utc).replace(tzinfo=None)
        return topic.split('/')[-1],ts,values
    except (ValueError,TypeError,AttributeError,KeyError):return None

