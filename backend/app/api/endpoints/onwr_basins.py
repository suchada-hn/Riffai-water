from fastapi import APIRouter, Depends, HTTPException, Query

from app.onwr_mapping import normalize_basin_key, pipeline_to_app_basin
from app.services.onwr_stats_service import OnwrStatsService, get_onwr_stats_service

router = APIRouter()


@router.get("/basins/{basin_en}/dates")
async def list_basin_dates(
    basin_en: str,
    svc: OnwrStatsService = Depends(get_onwr_stats_service),
):
    try:
        key = normalize_basin_key(basin_en)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    dates = svc.list_dates(key)
    return {
        "basin_en": key,
        "app_basin_id": pipeline_to_app_basin(key),
        "dates": dates,
    }


@router.get("/basins/{basin_en}/{date}/stats")
async def basin_date_stats(
    basin_en: str,
    date: str,
    svc: OnwrStatsService = Depends(get_onwr_stats_service),
):
    try:
        key = normalize_basin_key(basin_en)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if len(date) != 10 or date[4] != "-" or date[7] != "-":
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    try:
        fc = svc.build_feature_collection(key, date)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    fc.setdefault("properties", {})
    fc["properties"].update(
        {"basin_en": key, "app_basin_id": pipeline_to_app_basin(key), "date": date}
    )
    return fc


@router.get("/flood-alerts/latest")
async def flood_alerts_latest(
    limit: int = Query(200, ge=1, le=500),
    svc: OnwrStatsService = Depends(get_onwr_stats_service),
):
    return svc.latest_flood_alerts(limit=limit)
