# BIM-DT — Reproducible Digital Twin for Building Monitoring

**A research-software demonstration using a BIM-derived 3D view, MQTT sensor streams, PostgreSQL, FastAPI, and React/Three.js.**  This version is prepared as a candidate companion repository for a SoftwareX software-description article. It is a *working source prototype*, **not** a validated production building-management system.

## Overview

BIM-DT visualizes building monitoring information in dashboards and a 3D GLB scene. Sensor messages are received over MQTT, persisted to PostgreSQL, served through authenticated FastAPI endpoints, and displayed in a React interface. The application includes utilities for PMV/PPD comfort assessment and energy/phase monitoring. Isolation Forest and an optional pretrained LSTM module are included from the research prototype, but their predictive accuracy is **not evaluated by the synthetic demo**. No automatic energy optimization or building-device actuation is performed.

The packaged example contains a **synthetic two-floor building and five virtual monitoring devices**, not photographs, geometry, sensor IDs or observations from the original deployment. The historical research case study used 55 physical sensors; consult the associated thesis rather than interpreting demo telemetry as validation.

## Quick start (macOS, Linux, Windows with Docker Desktop)

**Requirements:** Git; Docker with Compose v2; Python 3.10+ for the one-time environment generator; roughly 4 GB free disk space for first-time images (more if you enable optional ML). No real sensors, API keys or database exports are required.

```bash
# After creating the empty GitHub repository and pushing this source snapshot:
git clone https://github.com/spartakos87/dt_softwarex.git
cd dt_softwarex
python3 scripts/create_env.py
# In Windows PowerShell use: py scripts/create_env.py
docker compose up --build -d
```

Visit **http://localhost:7779** (React UI) or **http://localhost:7781/docs** (FastAPI interactive docs). Demo username: `demo`; the generated password is the value of `DEMO_PASSWORD` in your **untracked** `.env` file. The frontend makes API calls to `http://localhost:7781/api/v1`. All container ports exposed by Compose bind to `127.0.0.1`, not to the network.

The stack includes six services: `db` (PostgreSQL 15), `mosquitto`, `seed` (exits after synthetic metadata initialization), `backend`, `publisher` (sends telemetry every 5 seconds), and `frontend`. Wait for the initial build and container health checks, then execute:

```bash
python3 scripts/smoke_demo.py
# For container diagnostics:
docker compose ps
docker compose logs --tail=100 backend publisher seed
```

The smoke script logs in with the local demo user and verifies that sensor information and example readings are returned. You can navigate **Dashboard → Floor Plans → 3D view**, click **Show Sensor Data**, and select a blue virtual sensor block. Both GLB files are pre-generated. The data are synthetic; neither frame rate nor network latency is benchmarked by this script.

Stop without deleting data: `docker compose down`. Completely reset the demo database and regenerate seeded metadata: `docker compose down -v && docker compose up --build -d` (deletes only this stack's local database volume).

### What you should see

- **Dashboard:** sensor status, energy/comfort overview, with optional weather disabled unless `VITE_OWM_KEY` is configured.
- **Sensors:** five virtual sensors with changing observations.
- **Floor Plans:** two clearly marked synthetic floor-plan images.
- **Building 3D:** two GLB scenes showing the demo rooms and selectable virtual sensor meshes.
- **Energy Overview:** simulated per-phase power values and rule-derived information.
- **Heating:** simulated temperature and setpoint data.
- **PMV/PPD:** comfort estimates calculated using assumed activity/clothing/air velocity and synthetic indoor measurements.
- **AI assistant / LSTM:** optional integrations; disabled by default without external credentials or full ML dependencies.

## Architecture

```text
sensor simulator ──MQTT──> Mosquitto ──> FastAPI subscriber ──> PostgreSQL
                                         │                         │
                                         └──── REST API <─────────┘
                                                 │
                                     React dashboard + Three.js
                                                 ▲
                                  IFC -> Blender -> GLB (offline)
```

The demo 3D geometry was generated with `trimesh` for reproducibility; the original workflow prepared IFC/BIM assets in Blender and exported them to GLB. The current application matches scene-node names (e.g., `IfcSensor/AirQuality_Kitchen`) with sensor names stored in PostgreSQL; **it does not automatically extract IFC semantics or map sensors by IFC GlobalId**. See [Architecture](docs/ARCHITECTURE.md) and [MQTT payload format](docs/MQTT_PAYLOAD.md).

## Project layout

| Path | Responsibility |
| --- | --- |
| `backend/main.py` | API, CORS, MQTT lifespan |
| `backend/routers/` | Authentication, sensor, PMV, energy/heater, optional AI endpoints |
| `backend/sensors_realtime.py` | Configurable MQTT subscriber and ingestion |
| `backend/demo/` | Idempotent synthetic metadata seed + publisher |
| `backend/ai/` | Existing rule/Isolation Forest and optional LSTM implementation |
| `database/schema.sql` | Empty PostgreSQL schema; no real deployment rows |
| `frontend/src/pages/BuildingViewer.jsx` | Three.js viewer and virtual-device interaction |
| `frontend/public/floor_*.glb` | Bundled original-free demo models |
| `mosquitto/mosquitto.conf` | Local, dev-only broker |
| `scripts/` | Secret generator, demo smoke test, synthetic GLB generator |
| `tests/` | Unit and source-level validation |

## MQTT example

Publish to `demo/sensors/demo-iaq-kitchen`:

```json
{"Timestamp":"2026-10-26T12:00:00Z", "Measurements":[{"Value":{"temperature":21.4,"humidity":44.0,"co2":680}}]}
```

Only known sensor IDs are stored. Registered sensor metadata and the scene-object names must match to make objects clickable. For real sensors, add your own metadata and use a secured broker and TLS; see [MQTT reference](docs/MQTT_PAYLOAD.md). The default demo broker is intentionally unauthenticated and **must not be exposed to the internet**.

## Settings and optional integrations

A one-time `scripts/create_env.py` invocation generates high-entropy values for `DB_PASSWORD`, `JWT_SECRET` and `DEMO_PASSWORD`. `.env` is excluded by `.gitignore`; **never commit the file**. The `.env.example` file is a template and contains no working secrets.

| Variable | Default / purpose |
| --- | --- |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Private PostgreSQL configuration |
| `JWT_SECRET` | Required HS256 signing key, automatically generated |
| `DEMO_USERNAME`, `DEMO_PASSWORD` | Credentials for only the synthetic demo |
| `MQTT_TOPIC` | `demo/sensors/#`, configured subscription |
| `HISTORY_MAX_RECORDS` | `0` = retain all demo observations; positive integer = per-device bound |
| `VITE_API_BASE_URL` | `http://localhost:7781/api/v1` |
| `VITE_OWM_KEY`, `VITE_WEATHER_LAT`, `VITE_WEATHER_LON` | Optional weather API key and selected location |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional explanatory assistant; no access to building control |
| `ENABLE_LSTM`, `INSTALL_ML` | Optional trusted model inference; both `1` to build and enable |

**Optional pretrained LSTM:** In `.env`, set `INSTALL_ML=1` and `ENABLE_LSTM=1`, then `docker compose up --build -d`. The original local artifacts in `backend/ai/LSTM/` are provided for continuity only. Only load `*.pkl` files from a trusted source; joblib/pickle files can execute code when deserialized. The original model settings and evaluation must be independently checked before citing prediction accuracy. The default build avoids installing PyTorch.

## Validation and limitations

```bash
# Offline unit and static source checks, in a Python environment with pytest,
# paho-mqtt and psycopg2-binary installed:
python3 -m pytest -q
python3 -m compileall -q backend scripts tests
# Frontend build (requires Node 20+):
cd frontend && npm ci && npm run build && cd ..
```

The GitHub Actions workflow runs lightweight source tests and a frontend build. The supplied synthetic demo proves neither scalability nor latency, nor forecasting improvements over baselines. The original one-building case study reported throughput and visualization metrics under separate conditions; these are *not* reproduced by this repository without an independent benchmark protocol. The local stack is **development only**; production deployment would require HTTPS/reverse proxy, rate limiting, user role/permission checks, MQTT authentication and TLS, hardened secrets management, audit logging, and operational monitoring.

## Rebuild the synthetic model

The two tiny GLB scenes were generated with `scripts/generate_demo_assets.py`, using `trimesh`, Pillow and NumPy. They are self-contained and unrelated to any real floor plan. To regenerate:

```bash
python3 -m pip install trimesh pillow numpy
python3 scripts/generate_demo_assets.py
```

## Provenance, license, citation

**SoftwareX status:** candidate preparation release `0.1.0`, not independently deployed/benchmarked or archived with a DOI. Create and verify the public GitHub repository, run the demo, tag a release, archive it (e.g. Zenodo), and update the manuscript's code metadata with the immutable version identifier before submission. Keep any 55-device performance results explicitly attributed to the original case study.

## Known issues / contribution guide

Please open GitHub issues for installation problems and provide operating system, Docker version, error details (without credentials), and instructions for reproducing the issue. Contributions that add tests, portable sensor-to-model mapping, alternative MQTT adapters, model evaluation, and CI validation are welcome. For security reports, do not post passwords or raw building measurements in public issues.
