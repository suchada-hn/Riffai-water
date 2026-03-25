from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from datetime import date

from app.config import get_settings
from app.services.gcs_service import GCSService


router = APIRouter()
settings = get_settings()
gcs = GCSService()


def _region_for_basin(basin_id: str) -> str:
    region = settings.ZSCORE_REGION_BY_BASIN_ID.get(basin_id)
    if not region:
        raise HTTPException(status_code=400, detail=f"Unknown basin_id: {basin_id}")
    return region


def _date_parts(d: date):
    return f"{d.year:04d}", f"{d.month:02d}", f"{d.day:02d}"


@router.get("/zscore/vv/dates")
async def list_zscore_dates(
    basin_id: str = Query(...),
    year: int = Query(..., ge=2000, le=2100),
):
    """
    List available dates for Z-score VV for a basin/year.

    Prefers a precomputed index JSON, falls back to listing summary prefixes.
    """
    region = _region_for_basin(basin_id)

    index_gcs_path = (
        f"gs://{settings.ONWR_DATA_BUCKET}/"
        f"{settings.ZSCORE_VV_INDEX_PREFIX}/{region}/{year:04d}/dates.json"
    )

    try:
        payload = gcs.download_json(index_gcs_path)
        dates = payload.get("dates")
        if isinstance(dates, list):
            return {"basin_id": basin_id, "region": region, "year": year, "dates": dates, "source": "index"}
    except Exception:
        # fall back below
        pass

    # Fallback: infer dates from summary files present in GCS
    prefix = f"{settings.ZSCORE_VV_SUMMARY_PREFIX}/{region}/{year:04d}/"
    files = gcs.list_files(settings.ONWR_DATA_BUCKET, prefix=prefix)

    # Expect paths like summary/zscore_vv/Region/YYYY/MM/DD/tiles.geojson
    inferred = set()
    for name in files:
        parts = name.split("/")
        # ... summary,zscore_vv,Region,YYYY,MM,DD,tiles.geojson
        if len(parts) >= 7 and parts[-1] == "tiles.geojson":
            yyyy, mm, dd = parts[-4], parts[-3], parts[-2]
            if yyyy.isdigit() and mm.isdigit() and dd.isdigit():
                inferred.add(f"{yyyy}-{mm}-{dd}")

    return {
        "basin_id": basin_id,
        "region": region,
        "year": year,
        "dates": sorted(inferred),
        "source": "gcs_list",
    }


@router.get("/zscore/vv/summary/tiles")
async def get_zscore_tile_summary(
    basin_id: str = Query(...),
    date_str: str = Query(..., alias="date"),
):
    """Return precomputed per-tile summary GeoJSON for a basin and date."""
    try:
        d = date.fromisoformat(date_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date; expected YYYY-MM-DD")

    region = _region_for_basin(basin_id)
    yyyy, mm, dd = _date_parts(d)
    gcs_path = (
        f"gs://{settings.ONWR_DATA_BUCKET}/"
        f"{settings.ZSCORE_VV_SUMMARY_PREFIX}/{region}/{yyyy}/{mm}/{dd}/tiles.geojson"
    )
    try:
        geojson = gcs.download_json(gcs_path)
    except Exception:
        # Consider logging the full exception 'e' here for debugging purposes.
        raise HTTPException(status_code=404, detail="Summary not found")

    return geojson


@router.get("/zscore/vv/tiles/{basin_id}/{yyyy}/{mm}/{dd}/{z}/{x}/{y}.png")
async def get_zscore_tile_png(
    basin_id: str,
    yyyy: str,
    mm: str,
    dd: str,
    z: int,
    x: int,
    y: int,
):
    """Proxy a private XYZ tile stored in GCS."""
    region = _region_for_basin(basin_id)

    # Basic validation
    if not (yyyy.isdigit() and len(yyyy) == 4 and mm.isdigit() and len(mm) == 2 and dd.isdigit() and len(dd) == 2):
        raise HTTPException(status_code=400, detail="Invalid date path; expected /YYYY/MM/DD/")
    if z < settings.ZSCORE_VV_ZOOM_MIN or z > settings.ZSCORE_VV_ZOOM_MAX:
        raise HTTPException(status_code=400, detail=f"Zoom must be between {settings.ZSCORE_VV_ZOOM_MIN} and {settings.ZSCORE_VV_ZOOM_MAX}")

    tile_rel = f"{settings.ZSCORE_VV_TILES_PREFIX}/{region}/{yyyy}/{mm}/{dd}/{z}/{x}/{y}.png"
    gcs_path = f"gs://{settings.ONWR_DATA_BUCKET}/{tile_rel}"

    try:
        data = gcs.download_bytes(gcs_path)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Tile not found: {str(e)}")

    headers = {
        "Cache-Control": "public, max-age=3600",
    }
    return Response(content=data, media_type="image/png", headers=headers)

