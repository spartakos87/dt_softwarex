"""HTTP API; MQTT is started and stopped in the lifespan rather than at import."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.auth import router as auth_router
from routers.pmv import router as pmv_router
from routers.sensors import router as sensor_router
from routers.energy import router as energy_router
from routers.heater import router as heater_router
from routers.chat import router as chat_router
from sensors_realtime import start_sensor_listener
from utils.security import _secret

@asynccontextmanager
async def lifespan(app:FastAPI):
    _secret()  # fail fast on missing/weak JWT config
    client=start_sensor_listener() if os.getenv('ENABLE_MQTT','1')=='1' else None
    try:yield
    finally:
        if client:
            client.disconnect()
            client.loop_stop()

app=FastAPI(title='BIM-DT SoftwareX',version='0.1.0',lifespan=lifespan)
origins=[x.strip() for x in os.getenv('CORS_ORIGINS','http://localhost:7779').split(',') if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=True,
    allow_methods=['GET','POST'],allow_headers=['Authorization','Content-Type'])
for router in (auth_router,pmv_router,sensor_router,energy_router,heater_router,chat_router):
    app.include_router(router,prefix='/api/v1')

@app.get('/health')
def health():
    return {'status':'ok','service':'bim-dt'}
