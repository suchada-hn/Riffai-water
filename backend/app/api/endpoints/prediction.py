from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timedelta

from app.models.database import get_db
from app.models.models import Prediction, RiskLevel, SatelliteImage, WaterLevel, Rainfall, Station
from app.services.ai_service import AIService
from app.services.alert_service import AlertService
from app.config import get_settings

router = APIRouter()
settings = get_settings()
ai_service = AIService()
alert_service = AlertService()


@router.post("/flood")
async def predict_flood(
    basin_id: str,
    days_ahead: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    if basin_id not in settings.BASINS:
        raise HTTPException(400, f"Invalid basin. Valid: {list(settings.BASINS.keys())}")

    now = datetime.utcnow()
    lookback = now - timedelta(days=90)

    # ดึง input data
    sat_data = (await db.execute(
        select(SatelliteImage.acquisition_date, SatelliteImage.avg_ndvi, SatelliteImage.avg_ndwi, SatelliteImage.avg_mndwi, SatelliteImage.water_area_sqkm)
        .where(and_(SatelliteImage.basin_id == basin_id, SatelliteImage.acquisition_date >= lookback))
        .order_by(SatelliteImage.acquisition_date)
    )).all()

    water_data = (await db.execute(
        select(WaterLevel.datetime, WaterLevel.level_m)
        .join(Station, WaterLevel.station_id == Station.id)
        .where(and_(Station.basin_id == basin_id, WaterLevel.datetime >= lookback))
        .order_by(WaterLevel.datetime)
    )).all()

    rain_data = (await db.execute(
        select(Rainfall.datetime, Rainfall.amount_mm)
        .join(Station, Rainfall.station_id == Station.id)
        .where(and_(Station.basin_id == basin_id, Rainfall.datetime >= lookback))
        .order_by(Rainfall.datetime)
    )).all()

    # Run prediction
    result = ai_service.predict(
        basin_id=basin_id,
        satellite_data=sat_data,
        water_data=water_data,
        rainfall_data=rain_data,
        days_ahead=days_ahead,
    )

    # Evaluate risk
    risk = alert_service.evaluate_risk(
        flood_probability=result["flood_probability"],
        water_level=result.get("predicted_water_level"),
    )

    # Save to DB
    target_date = now + timedelta(days=days_ahead)
    pred = Prediction(
        basin_id=basin_id,
        predict_date=now,
        target_date=target_date,
        flood_probability=result["flood_probability"],
        risk_level=risk,
        predicted_water_level=result.get("predicted_water_level"),
        affected_area_sqkm=result.get("affected_area_sqkm"),
        confidence=result.get("confidence", 0),
        model_version=result.get("model_version", "rule-based-v1"),
        model_accuracy=result.get("model_accuracy"),
    )
    db.add(pred)
    await db.commit()
    await db.refresh(pred)

    return {
        "prediction_id": pred.id,
        "basin_id": basin_id,
        "basin_name": settings.BASINS[basin_id]["name"],
        "predict_date": now.isoformat(),
        "target_date": target_date.isoformat(),
        "days_ahead": days_ahead,
        "flood_probability": result["flood_probability"],
        "risk_level": risk.value,
        "predicted_water_level": result.get("predicted_water_level"),
        "affected_area_sqkm": result.get("affected_area_sqkm"),
        "confidence": result.get("confidence"),
        "model_version": result.get("model_version"),
        "input_summary": {
            "satellite_records": len(sat_data),
            "water_records": len(water_data),
            "rainfall_records": len(rain_data),
        },
    }


@router.get("/history/{basin_id}")
async def prediction_history(
    basin_id: str,
    days: int = Query(default=90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(Prediction)
        .where(and_(Prediction.basin_id == basin_id, Prediction.predict_date >= since))
        .order_by(Prediction.predict_date.desc())
    )
    return {
        "basin_id": basin_id,
        "predictions": [
            {
                "id": p.id,
                "predict_date": p.predict_date.isoformat(),
                "target_date": p.target_date.isoformat(),
                "flood_probability": p.flood_probability,
                "risk_level": p.risk_level.value if p.risk_level else "normal",
                "predicted_water_level": p.predicted_water_level,
                "affected_area_sqkm": p.affected_area_sqkm,
                "confidence": p.confidence,
                "model_version": p.model_version,
            }
            for p in result.scalars().all()
        ],
    }


@router.get("/accuracy")
async def model_accuracy(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import func
    result = await db.execute(
        select(
            Prediction.model_version,
            func.avg(Prediction.model_accuracy).label("avg_accuracy"),
            func.count(Prediction.id).label("count"),
            func.avg(Prediction.confidence).label("avg_confidence"),
        ).group_by(Prediction.model_version)
    )
    return {
        "models": [
            {"version": r[0], "avg_accuracy": round(r[1], 4) if r[1] else None, "predictions": r[2], "avg_confidence": round(r[3], 4) if r[3] else None}
            for r in result
        ]
    }


@router.get("/climate-forecast")
async def climate_forecast(
    basin_id: str = Query(..., description="Basin id (e.g. mekong_north)"),
    days_ahead: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Forecast summary for the next `days_ahead` window.

    This is derived from the latest matching/nearest `Prediction` row in the DB.
    """
    if basin_id not in settings.BASINS:
        raise HTTPException(400, f"Invalid basin. Valid: {list(settings.BASINS.keys())}")

    result = await db.execute(
        select(Prediction)
        .where(Prediction.basin_id == basin_id)
        .order_by(Prediction.predict_date.desc())
        .limit(200)
    )
    preds = result.scalars().all()
    if not preds:
        return {
            "basin_id": basin_id,
            "basin_name": settings.BASINS[basin_id]["name"],
            "days_ahead": days_ahead,
            "target_date": None,
            "flood_probability": 0.0,
            "risk_level": "normal",
            "predicted_water_level": None,
            "affected_area_sqkm": None,
            "confidence": None,
            "model_version": None,
            "model_accuracy": None,
        }

    def _pred_days(p: Prediction) -> int:
        if not p.predict_date or not p.target_date:
            return 0
        return int(round((p.target_date - p.predict_date).total_seconds() / 86400.0))

    # Pick the row with the closest days-ahead to the requested value.
    chosen = min(
        preds,
        key=lambda p: (
            abs(_pred_days(p) - days_ahead),
            # Tie-breaker: prefer most recent predict_date.
            -(p.predict_date.timestamp() if p.predict_date else 0),
        ),
    )

    chosen_days = _pred_days(chosen)
    risk_level = chosen.risk_level.value if chosen.risk_level else "normal"

    return {
        "basin_id": basin_id,
        "basin_name": settings.BASINS[basin_id]["name"],
        "days_ahead": chosen_days,
        "target_date": chosen.target_date.isoformat() if chosen.target_date else None,
        # Flood probability is stored as 0-1 in DB.
        "flood_probability": float(chosen.flood_probability or 0.0),
        "risk_level": risk_level,
        "predicted_water_level": chosen.predicted_water_level,
        "affected_area_sqkm": chosen.affected_area_sqkm,
        "confidence": chosen.confidence,
        "model_version": chosen.model_version,
        "model_accuracy": chosen.model_accuracy,
    }
