# Software architecture and engineering boundaries

```
  Synthetic MQTT publisher   OR   external secured IoT deployment
             |                          |
             +------------+-------------+
                          |
                     MQTT broker
                          |
             FastAPI lifespan subscriber
                          |
             PostgreSQL (metadata, latest,
                  sensor_data history)
                          |
                       REST API
                          |
                  React dashboards
                          |
             Three.js GLB building viewer

 IFC/BIM model --> offline Blender prep --> GLB file --> Three.js
 (not an automatic IFC parser or semantic reasoning engine)
```

**Backend:** FastAPI routes for authentication, sensors, heating, PMV and energy analysis. Passwords are PBKDF2-HMAC hashed and bearer JWTs are signed with a generated local secret. Secrets are read from `.env` only. The MQTT subscriber starts in application lifespan; it uses a configurable topic instead of wildcard `#`.

**Database:** PostgreSQL schema initialized with `database/schema.sql`. The `seed` service creates only synthetic building metadata. `sensor_data` history is unlimited by default (`HISTORY_MAX_RECORDS=0`); optional per-sensor pruning uses a bounded count.

**ML limitations:** Isolation Forest and phase checks are application-level utilities; the optional pretrained LSTM requires trusted `*.pkl` and `*.pth` assets plus optional Torch dependencies. Its accuracy and training provenance are not assessed by this demo; inference is disabled unless explicitly enabled.

**Viewer:** The included GLB assets represent a **synthetic** two-floor building to preserve a portable demo. The original research installation and its 55-device evaluation are described in the associated thesis; they are not reproduced here.

**Not provided:** building-physics simulation, automatic energy optimization, device control, automatic IFC-to-sensor semantic mapping, production-grade authorization policy, scalable deployment, documented latency benchmarks.
