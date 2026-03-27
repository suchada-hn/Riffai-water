import json
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.config import get_settings
from app.models.database import engine, Base, async_session
from app.models.models import Basin
from app.api.endpoints import auth, dashboard, map, data, alerts, prediction, reports, pipeline, batch, tiles, tambon, onwr_basins

settings = get_settings()

_DEBUG_LOG_PATH = "/Users/macosx/Desktop/Riffai/Riffai-water-1/.cursor/debug-5f3060.log"


class _DebugCorsAuditMiddleware(BaseHTTPMiddleware):
    """Logs whether responses include CORS headers (session 5f3060). Also prints to stdout for Cloud Run logs."""

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        try:
            response = await call_next(request)
            acao = response.headers.get("access-control-allow-origin")
            # #region agent log
            line = {
                "sessionId": "5f3060",
                "hypothesisId": "H_app_reached",
                "location": "backend/app/main.py:_DebugCorsAuditMiddleware",
                "message": "response after handlers",
                "data": {
                    "method": request.method,
                    "path": request.url.path,
                    "origin": origin,
                    "status": response.status_code,
                    "access_control_allow_origin": acao,
                },
                "timestamp": int(time.time() * 1000),
            }
            print(json.dumps(line), flush=True)
            try:
                with open(_DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
                    f.write(json.dumps(line) + "\n")
            except OSError:
                pass
            # #endregion
            return response
        except Exception as e:
            # #region agent log
            eline = {
                "sessionId": "5f3060",
                "hypothesisId": "H_app_exception",
                "location": "backend/app/main.py:_DebugCorsAuditMiddleware",
                "message": "exception before response",
                "data": {
                    "path": request.url.path,
                    "origin": origin,
                    "err": type(e).__name__,
                    "err_msg": str(e)[:300],
                },
                "timestamp": int(time.time() * 1000),
            }
            print(json.dumps(eline), flush=True)
            try:
                with open(_DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
                    f.write(json.dumps(eline) + "\n")
            except OSError:
                pass
            # #endregion
            raise


async def auto_seed():
    """Seed ข้อมูลตัวอย่างอัตโนมัติถ้า DB ว่าง"""
    from sqlalchemy import select, func
    async with async_session() as db:
        count = await db.scalar(select(func.count(Basin.id)))
        if count and count > 0:
            print(f"📦 Database has {count} basins, skip seeding")
            return
    # รัน seed
    print("🌱 Empty database detected, seeding...")
    from app.seed import seed
    await seed()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created")
    await auto_seed()
    print(f"🌊 RIFFAI Platform v{settings.APP_VERSION} ready!")
    print(f"📡 API: http://localhost:8000/docs")
    yield
    # Shutdown
    await engine.dispose()
    print("👋 RIFFAI Platform shutdown")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="ระบบ AI วิเคราะห์ภาพถ่ายดาวเทียมเพื่อบริหารจัดการน้ำ",
    lifespan=lifespan,
)

# Debug inner, CORS outer (last added = first to run) so CORS wraps responses/errors from inner stack.
app.add_middleware(_DebugCorsAuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["🔐 Auth"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["📊 Dashboard"])
app.include_router(map.router, prefix="/api/map", tags=["🗺️ Map & GIS"])
app.include_router(tiles.router, prefix="/api/map", tags=["🗺️ Map & GIS"])
app.include_router(tambon.router, prefix="/api/flood", tags=["🌊 Tambon Flood Prediction"])
app.include_router(prediction.router, prefix="/api/predict", tags=["🤖 Prediction"])
app.include_router(batch.router, prefix="/api/predict", tags=["🤖 Batch Prediction"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["🚨 Alerts"])
app.include_router(data.router, prefix="/api/data", tags=["📈 Data & Analytics"])
app.include_router(reports.router, prefix="/api/reports", tags=["📄 Reports"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["📡 Pipeline"])
app.include_router(onwr_basins.router, prefix="/api", tags=["ONWR SAR"])


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "basins": list(settings.BASINS.keys()),
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "version": settings.APP_VERSION}
