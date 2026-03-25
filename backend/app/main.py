from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.models.database import engine, Base, async_session
from app.models.models import Basin
from app.api.endpoints import auth, dashboard, map, data, alerts, prediction, reports, pipeline, batch, tiles, tambon

settings = get_settings()


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
