import json
from datetime import datetime
from demo.publisher import build_payload
from utils.mqtt_payload import parse_sensor_message


def test_synthetic_messages_parse():
    for kind in ('air', 'energy', 'heater'):
        payload = json.dumps(build_payload(kind, 3)).encode()
        result = parse_sensor_message('demo/sensors/demo-iaq-kitchen', payload)
        assert result is not None
        device_id, timestamp, values = result
        assert device_id == 'demo-iaq-kitchen'
        assert isinstance(timestamp, datetime)
        assert isinstance(values, dict) and values


def test_invalid_and_oversized_messages_are_ignored():
    assert parse_sensor_message('demo/sensors/device', b'not json') is None
    assert parse_sensor_message('demo/sensors/device', b'x' * 64001) is None
    assert parse_sensor_message('demo/sensors/device', b'{"Timestamp":"bad","Measurements":[]}') is None
