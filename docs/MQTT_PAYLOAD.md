# MQTT protocol — local demonstration

The bundled demo uses MQTT topic `demo/sensors/<sensor-id>`, where `<sensor-id>` must exist in the `sensors` table. The default listener subscribes to `demo/sensors/#` (not all broker topics). Unregistered IDs and malformed JSON are ignored.

Example air-quality observation:

```json
{
  "Timestamp": "2026-10-26T12:00:00Z",
  "Measurements": [{
    "Value": {"temperature": 21.3, "humidity": 44.2, "co2": 710}
  }]
}
```

The synthetic publisher populates additional demonstration energy and heating attributes. Sensor IDs and names are configured in `backend/demo/seed.py`. For a **new** device, add a metadata entry and restart backend (the listener caches the registered sensor IDs at startup). The 3D object is associated by name, not automatically by IFC GlobalId: use a GLB node named `IfcSensor/<sensor-name>`.

The broker is anonymous only inside a localhost-bound development environment. To connect real sensors, use a secured externally managed MQTT broker, authenticated clients, TLS, and an explicit topic allowlist; don't expose this demo stack on a public network.
