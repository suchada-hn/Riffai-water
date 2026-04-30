from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

from app.models.database import get_db
from app.models.models import SatelliteImage, WaterLevel, Rainfall, Station
from app.services.satellite_service import SatelliteService
from app.services.water_service import WaterService
from app.config import get_settings
from app.services.cloud_run_status_service import get_cloud_run_status_service
from app.services.forecast_integration_service import get_forecast_integration_service
from app.services.sar_integration_service import get_sar_integration_service

router = APIRouter()
settings = get_settings()
sat_service = SatelliteService()
water_service = WaterService()


@router.post("/fetch-water")
async def fetch_water_data(
    basin_id: str = None,
    db: AsyncSession = Depends(get_db),
):
    """ดึงข้อมูลระดับน้ำ + ฝน ล่าสุด"""
    basins = [basin_id] if basin_id else list(settings.BASINS.keys())
    total_water = 0
    total_rain = 0

    for bid in basins:
        # ── Water Levels ──
        water_data = await water_service.fetch_water_levels(bid)
        for item in water_data:
            # Upsert station
            existing = await db.scalar(select(Station).where(Station.id == item["station_id"]))
            if not existing:
                db.add(Station(
                    id=item["station_id"], name=item["station_name"],
                    station_type="water_level",
                    lat=item["lat"], lon=item["lon"],
                    province=item["province"], basin_id=bid,
                    source=item["source"],
                ))
            if item.get("water_level_m") is not None:
                db.add(WaterLevel(
                    station_id=item["station_id"],
                    datetime=datetime.fromisoformat(item["datetime"]) if isinstance(item.get("datetime"), str) else datetime.utcnow(),
                    level_m=item["water_level_m"],
                ))
                total_water += 1

        # ── Rainfall ──
        rain_data = await water_service.fetch_rainfall(bid)
        for item in rain_data:
            existing = await db.scalar(select(Station).where(Station.id == item["station_id"]))
            if not existing:
                db.add(Station(
                    id=item["station_id"], name=item["station_name"],
                    station_type="rainfall",
                    lat=item["lat"], lon=item["lon"],
                    province=item["province"], basin_id=bid,
                    source=item["source"],
                ))
            if item.get("rainfall_mm") is not None:
                db.add(Rainfall(
                    station_id=item["station_id"],
                    datetime=datetime.fromisoformat(item["datetime"]) if isinstance(item.get("datetime"), str) else datetime.utcnow(),
                    amount_mm=item["rainfall_mm"],
                ))
                total_rain += 1

    await db.commit()
    return {
        "status": "completed",
        "timestamp": datetime.utcnow().isoformat(),
        "water_level_records": total_water,
        "rainfall_records": total_rain,
    }


@router.post("/fetch-satellite")
async def fetch_satellite_data(
    basin_id: str = None,
    db: AsyncSession = Depends(get_db),
):
    """ดึงข้อมูลดาวเทียมล่าสุด (Sentinel-2 optical)"""
    basins = [basin_id] if basin_id else list(settings.BASINS.keys())
    end = datetime.utcnow().strftime("%Y-%m-%d")
    start = (datetime.utcnow() - timedelta(days=12)).strftime("%Y-%m-%d")
    results = {}

    for bid in basins:
        try:
            s2 = sat_service.fetch_sentinel2(bid, start, end)
            if s2.get("status") == "success":
                db.add(SatelliteImage(
                    source=s2.get("source", "sentinel-2"),
                    acquisition_date=datetime.fromisoformat(s2["acquisition_date"]) if isinstance(s2.get("acquisition_date"), str) else datetime.utcnow(),
                    basin_id=bid,
                    cloud_coverage=s2.get("cloud_coverage"),
                    resolution_m=s2.get("resolution_m", 10),
                    avg_ndvi=s2.get("avg_ndvi"),
                    avg_ndwi=s2.get("avg_ndwi"),
                    avg_mndwi=s2.get("avg_mndwi"),
                    avg_lswi=s2.get("avg_lswi"),
                    avg_ndbi=s2.get("avg_ndbi"),
                    water_area_sqkm=s2.get("water_area_sqkm"),
                    rgb_path=s2.get("paths", {}).get("rgb"),
                    ndvi_path=s2.get("paths", {}).get("ndvi"),
                    ndwi_path=s2.get("paths", {}).get("ndwi"),
                    mndwi_path=s2.get("paths", {}).get("mndwi"),
                ))
            results[bid] = s2
        except Exception as e:
            results[bid] = {"error": str(e)}

    await db.commit()
    return {"status": "completed", "timestamp": datetime.utcnow().isoformat(), "results": results}


@router.post("/fetch-sar")
async def fetch_sar_data(
    basin_id: str = None,
    db: AsyncSession = Depends(get_db),
):
    """ดึงข้อมูล SAR (Sentinel-1) พร้อม VV, VH, ratio, change detection"""
    basins = [basin_id] if basin_id else list(settings.BASINS.keys())
    end = datetime.utcnow().strftime("%Y-%m-%d")
    start = (datetime.utcnow() - timedelta(days=12)).strftime("%Y-%m-%d")
    results = {}

    for bid in basins:
        try:
            s1 = sat_service.fetch_sentinel1_sar(bid, start, end)
            if s1.get("status") == "success":
                db.add(SatelliteImage(
                    source=s1.get("source", "sentinel-1-sar"),
                    acquisition_date=datetime.fromisoformat(s1["acquisition_date"]) if isinstance(s1.get("acquisition_date"), str) else datetime.utcnow(),
                    basin_id=bid,
                    resolution_m=s1.get("resolution_m", 10),
                    sar_vv_db=s1.get("vv_mean_db"),
                    sar_vh_db=s1.get("vh_mean_db"),
                    sar_ratio=s1.get("vv_vh_ratio"),
                    water_area_sqkm=s1.get("water_area_sqkm"),
                    change_detected=s1.get("change_detected", False),
                    change_area_sqkm=s1.get("change_area_sqkm", 0),
                ))
            results[bid] = s1
        except Exception as e:
            results[bid] = {"error": str(e)}

    await db.commit()
    return {"status": "completed", "timestamp": datetime.utcnow().isoformat(), "results": results}


@router.post("/fetch-historical")
async def fetch_historical(
    basin_id: str,
    start_year: int = 2020,
    end_year: int = 2024,
    db: AsyncSession = Depends(get_db),
):
    """ดึง time series ย้อนหลังสำหรับฝึก AI"""
    all_ts = []
    for year in range(start_year, end_year + 1):
        ts = sat_service.get_water_coverage_timeseries(
            basin_id, f"{year}-01-01", f"{year}-12-31", 16
        )
        all_ts.extend(ts)

    basin_area = settings.BASINS.get(basin_id, {}).get("area_sqkm", 10000)
    for item in all_ts:
        db.add(SatelliteImage(
            source="sentinel-2-historical",
            acquisition_date=datetime.fromisoformat(item["date"]),
            basin_id=basin_id,
            avg_ndvi=item.get("ndvi"),
            avg_ndwi=item.get("ndwi"),
            avg_mndwi=item.get("mndwi"),
            water_area_sqkm=(item.get("water_fraction") or 0) * basin_area,
        ))

    await db.commit()
    return {"status": "completed", "basin_id": basin_id, "records": len(all_ts)}



@router.get("/test-ee")
async def test_earth_engine():
    """ทดสอบการเชื่อมต่อ Earth Engine"""
    sat_service = SatelliteService()
    result = sat_service.test_connection()
    return result


@router.get("/status")
async def integration_status():
    """
    Integration freshness/status for external feeds (ONWR forecast + SAR).

    - Cloud Run job status is fetched only when CLOUD_RUN_STATUS_ENABLED=true.
    - GCS freshness is inferred from newest parseable object under configured prefixes.
    """
    cloud = get_cloud_run_status_service()
    forecast = get_forecast_integration_service()
    sar = get_sar_integration_service()

    # GCS inferred
    forecast_art = forecast.resolve_latest_artifact()
    sar_art = sar.resolve_latest_artifact()

    # Cloud Run job status (optional; can fail gracefully)
    forecast_job_name = settings.CLOUD_RUN_JOB_ONWR_FORECAST_THAILAND
    sar_job_name = settings.CLOUD_RUN_JOB_SAR_PIPELINE

    forecast_job = await cloud.get_job_status(forecast_job_name)
    sar_job = await cloud.get_job_status(sar_job_name)

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "cloudRun": {
            "enabled": cloud.enabled(),
            "forecastJob": forecast_job.to_dict(),
            "sarJob": sar_job.to_dict(),
        },
        "gcs": {
            "available": bool(forecast.gcs.client),
            "forecast": {
                "fresh": forecast.is_fresh(forecast_art),
                "artifact": forecast_art.to_meta(),
                "maxAgeHours": settings.ONWR_FORECAST_MAX_AGE_HOURS,
            },
            "sar": {
                "fresh": sar.is_fresh(sar_art),
                "artifact": sar_art.to_meta(),
                "maxAgeHours": settings.SAR_MAX_AGE_HOURS,
            },
        },
    }
