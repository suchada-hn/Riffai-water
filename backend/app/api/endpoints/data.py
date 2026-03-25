from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from typing import Optional
import json

from app.models.database import get_db
from app.models.models import WaterLevel, Rainfall, SatelliteImage, Station

router = APIRouter()


@router.get("/water-level/{basin_id}")
async def get_water_level_data(
    basin_id: str,
    station_id: Optional[str] = None,
    days: int = Query(default=30, ge=1, le=730),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    
    query = (
        select(
            WaterLevel.datetime,
            WaterLevel.level_m,
            WaterLevel.flow_rate,
            Station.name.label("station_name"),
            Station.id.label("station_id"),
        )
        .join(Station, WaterLevel.station_id == Station.id)
        .where(and_(Station.basin_id == basin_id, WaterLevel.datetime >= since))
    )
    
    if station_id:
        query = query.where(Station.id == station_id)
    
    query = query.order_by(WaterLevel.datetime)
    result = await db.execute(query)
    
    return {
        "basin_id": basin_id,
        "period_days": days,
        "data": [
            {
                "datetime": r[0].isoformat(),
                "level_m": r[1],
                "flow_rate": r[2],
                "station_name": r[3],
                "station_id": r[4],
            }
            for r in result
        ],
    }


@router.get("/rainfall/{basin_id}")
async def get_rainfall_data(
    basin_id: str,
    days: int = Query(default=30, ge=1, le=730),
    aggregate: str = Query(default="hourly", regex="^(hourly|daily|monthly)$"),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)

    # #region agent log
    try:
        bind = db.get_bind()
        dialect = getattr(getattr(bind, "dialect", None), "name", None)
    except Exception:
        dialect = None
    try:
        with open("/Users/macosx/Desktop/Riffai/Riffai-water-1/.cursor/debug-0ae64a.log", "a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "sessionId": "0ae64a",
                        "runId": "pre-fix",
                        "hypothesisId": "H5",
                        "location": "backend/app/api/endpoints/data.py:get_rainfall_data",
                        "message": "Rainfall request (aggregate/dialect)",
                        "data": {"basin_id": basin_id, "days": days, "aggregate": aggregate, "dialect": dialect},
                        "timestamp": int(datetime.utcnow().timestamp() * 1000),
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    except Exception:
        pass
    # #endregion
    
    if aggregate in ("daily", "monthly"):
        # Pick a date bucket function that matches the DB dialect.
        if dialect == "postgresql":
            bucket = func.date_trunc("day" if aggregate == "daily" else "month", Rainfall.datetime).label("date")
        else:
            # SQLite: use date()/strftime() instead of PostgreSQL date_trunc.
            bucket = (
                func.date(Rainfall.datetime).label("date")
                if aggregate == "daily"
                else func.strftime("%Y-%m-01", Rainfall.datetime).label("date")
            )
        query = (
            select(
                bucket,
                func.sum(Rainfall.amount_mm).label("total_mm"),
                func.avg(Rainfall.amount_mm).label("avg_mm"),
                func.max(Rainfall.amount_mm).label("max_mm"),
            )
            .join(Station, Rainfall.station_id == Station.id)
            .where(and_(Station.basin_id == basin_id, Rainfall.datetime >= since))
            .group_by("date")
            .order_by("date")
        )
    else:
        query = (
            select(Rainfall.datetime, Rainfall.amount_mm, Station.name)
            .join(Station, Rainfall.station_id == Station.id)
            .where(and_(Station.basin_id == basin_id, Rainfall.datetime >= since))
            .order_by(Rainfall.datetime)
        )

    try:
        result = await db.execute(query)
    except Exception as e:
        # #region agent log
        try:
            with open("/Users/macosx/Desktop/Riffai/Riffai-water-1/.cursor/debug-0ae64a.log", "a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "sessionId": "0ae64a",
                            "runId": "pre-fix",
                            "hypothesisId": "H6",
                            "location": "backend/app/api/endpoints/data.py:get_rainfall_data",
                            "message": "Rainfall query failed",
                            "data": {"errorType": type(e).__name__, "error": str(e), "aggregate": aggregate, "dialect": dialect},
                            "timestamp": int(datetime.utcnow().timestamp() * 1000),
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        raise
    
    if aggregate == "daily":
        data = [
            {"date": r[0].isoformat(), "total_mm": r[1], "avg_mm": r[2], "max_mm": r[3]}
            for r in result
        ]
    elif aggregate == "monthly":
        data = [
            {"date": (r[0].isoformat() if hasattr(r[0], "isoformat") else str(r[0])), "total_mm": r[1], "avg_mm": r[2], "max_mm": r[3]}
            for r in result
        ]
    else:
        data = [
            {"datetime": r[0].isoformat(), "amount_mm": r[1], "station": r[2]}
            for r in result
        ]
    
    return {"basin_id": basin_id, "aggregate": aggregate, "data": data}


@router.get("/satellite-indices/{basin_id}")
async def get_satellite_indices(
    basin_id: str,
    days: int = Query(default=365, ge=30, le=2555),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(
            SatelliteImage.acquisition_date,
            SatelliteImage.source,
            SatelliteImage.avg_ndvi,
            SatelliteImage.avg_ndwi,
            SatelliteImage.avg_mndwi,
            SatelliteImage.water_area_sqkm,
            SatelliteImage.cloud_coverage,
        )
        .where(and_(
            SatelliteImage.basin_id == basin_id,
            SatelliteImage.acquisition_date >= since,
        ))
        .order_by(SatelliteImage.acquisition_date)
    )
    
    return {
        "basin_id": basin_id,
        "data": [
            {
                "date": r[0].isoformat(),
                "source": r[1],
                "ndvi": r[2],
                "ndwi": r[3],
                "mndwi": r[4],
                "water_area_sqkm": r[5],
                "cloud_coverage": r[6],
            }
            for r in result
        ],
    }
