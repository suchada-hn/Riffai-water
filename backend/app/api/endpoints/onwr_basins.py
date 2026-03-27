from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.onwr_mapping import normalize_basin_key, pipeline_to_app_basin
from app.services.gcs_service import GCSService
from app.services.onwr_stats_service import OnwrStatsService, get_onwr_stats_service

router = APIRouter()
_settings = get_settings()
_gcs = GCSService()


def _normalize_raster_date(date: str) -> tuple[str, str]:
    """Return (year_folder, date_underscores) for Model_Output_test/.../Z_Score filenames."""
    date = date.strip()
    if len(date) == 10 and date[4] == "-" and date[7] == "-":
        y, m, d = date.split("-")
        return y, f"{y}_{m}_{d}"
    if len(date) == 10 and date[4] == "_" and date[7] == "_":
        y, m, d = date.split("_")
        return y, date
    raise ValueError("date must be YYYY-MM-DD or YYYY_MM_DD")


@router.get("/basins/onwr/thailand-subbasin-stats-url")
async def thailand_subbasin_stats_signed_url(
    expiration_hours: int = Query(2, ge=1, le=24),
):
    """
    Short-lived signed URL for the national aggregate GeoJSON on GCS (~26 MB).
    Fetch that URL from the browser to avoid loading the file through this API.
    """
    blob = _settings.ONWR_THAILAND_SUBBASIN_STATS_BLOB
    if not _gcs.client:
        raise HTTPException(status_code=503, detail="GCS not configured")
    if not _gcs.blob_exists(_settings.GCS_BUCKET_ONWR, blob):
        raise HTTPException(status_code=404, detail="thailand_subbasin_stats.geojson not found in bucket")
    gcs_path = f"gs://{_settings.GCS_BUCKET_ONWR}/{blob}"
    url = _gcs.get_signed_url(gcs_path, expiration_hours=expiration_hours)
    if not url:
        raise HTTPException(status_code=503, detail="Could not generate signed URL")
    return {"url": url, "expiration_hours": expiration_hours, "blob": blob}


@router.get("/basins/onwr/thailand-subbasin-stats")
async def thailand_subbasin_stats_redirect(
    expiration_hours: int = Query(2, ge=1, le=24),
):
    """302 redirect to GCS signed URL for the national aggregate GeoJSON."""
    blob = _settings.ONWR_THAILAND_SUBBASIN_STATS_BLOB
    if not _gcs.client:
        raise HTTPException(status_code=503, detail="GCS not configured")
    if not _gcs.blob_exists(_settings.GCS_BUCKET_ONWR, blob):
        raise HTTPException(status_code=404, detail="thailand_subbasin_stats.geojson not found in bucket")
    gcs_path = f"gs://{_settings.GCS_BUCKET_ONWR}/{blob}"
    url = _gcs.get_signed_url(gcs_path, expiration_hours=expiration_hours)
    if not url:
        raise HTTPException(status_code=503, detail="Could not generate signed URL")
    return RedirectResponse(url=url, status_code=302)


@router.get("/basins/onwr/zscore-raster-url")
async def zscore_raster_signed_url(
    basin_en: str = Query(..., description="Pipeline basin: EastCoast, UpperMekong, LowerSouthEast"),
    date: str = Query(..., description="YYYY-MM-DD or YYYY_MM_DD"),
    band: str = Query("VV", description="VV or VH"),
    tile: str = Query("0000000000-0000000000"),
    expiration_hours: int = Query(2, ge=1, le=24),
):
    """
    Signed URL for a Z-score GeoTIFF tile under Model_Output_test/{basin}/{year}/Z_Score/.
    Raw GeoTIFFs are not XYZ tiles; use georaster-layer-for-leaflet, TiTiler, or similar to display on a map.
    """
    try:
        key = normalize_basin_key(basin_en)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    b = band.strip().upper()
    if b not in ("VV", "VH"):
        raise HTTPException(status_code=400, detail="band must be VV or VH")
    try:
        year, date_us = _normalize_raster_date(date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    pfx = _settings.ONWR_ZSCORE_RASTER_PREFIX.strip().strip("/")
    blob = f"{pfx}/{key}/{year}/Z_Score/Z_Score_{b}_{date_us}_{tile}.tif"
    if not _gcs.client:
        raise HTTPException(status_code=503, detail="GCS not configured")
    if not _gcs.blob_exists(_settings.GCS_BUCKET_ONWR, blob):
        raise HTTPException(status_code=404, detail=f"Raster not found: {blob}")
    gcs_path = f"gs://{_settings.GCS_BUCKET_ONWR}/{blob}"
    url = _gcs.get_signed_url(gcs_path, expiration_hours=expiration_hours)
    if not url:
        raise HTTPException(status_code=503, detail="Could not generate signed URL")
    return {
        "url": url,
        "expiration_hours": expiration_hours,
        "basin_en": key,
        "band": b,
        "date": date_us,
        "tile": tile,
        "note": "GeoTIFF is not a slippy Map tile source; use a GeoTIFF-capable Leaflet layer or a tile server.",
    }


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
