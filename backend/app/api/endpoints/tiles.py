"""
API endpoints for grid-based tile system
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.database import get_db
from app.models.models import Station, WaterLevel, Rainfall, Prediction
from app.config import get_settings
from app.data.grid_tiles import (
    THAILAND_BOUNDS,
    TILE_SIZE,
    is_tile_in_thailand,
    generate_tile_id,
    get_tile_bounds,
    tile_polygon_coordinates,
    calculate_risk_level,
    TILE_PROVINCES,
)

router = APIRouter()
settings = get_settings()


def _parse_date(date: Optional[str]) -> datetime:
    if not date:
        return datetime.utcnow()
    try:
        # Accept YYYY-MM-DD or ISO-8601
        if len(date) == 10:
            return datetime.fromisoformat(date)
        return datetime.fromisoformat(date.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD or ISO-8601.")


def _tile_key_for_station(lat: float, lon: float) -> Optional[str]:
    """
    Return tile id for a station point based on its containing tile origin,
    or None if outside Thailand tile grid.
    """
    if lat is None or lon is None:
        return None
    origin_lat = THAILAND_BOUNDS["lat_min"] + (int((lat - THAILAND_BOUNDS["lat_min"]) / TILE_SIZE) * TILE_SIZE)
    origin_lon = THAILAND_BOUNDS["lon_min"] + (int((lon - THAILAND_BOUNDS["lon_min"]) / TILE_SIZE) * TILE_SIZE)
    origin_lat = round(origin_lat, 1)
    origin_lon = round(origin_lon, 1)
    if not is_tile_in_thailand(origin_lat, origin_lon):
        return None
    return generate_tile_id(origin_lat, origin_lon)


async def _load_station_snapshots(
    db: AsyncSession,
    as_of: datetime,
) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, float], Dict[str, float]]:
    """
    Load station metadata plus recent water/rain measurements in [as_of-24h, as_of].

    Returns:
      - stations: station_id -> {lat, lon, basin_id, station_type}
      - water_avg: station_id -> avg level_m over window (water stations)
      - rain_sum: station_id -> sum amount_mm over window (rain stations)
    """
    window_start = as_of - timedelta(hours=24)

    stations_rows = (await db.execute(
        select(Station.id, Station.lat, Station.lon, Station.basin_id, Station.station_type)
        .where(Station.is_active == True)
    )).all()
    stations: Dict[str, Dict[str, Any]] = {
        r[0]: {"lat": r[1], "lon": r[2], "basin_id": r[3], "station_type": r[4]}
        for r in stations_rows
    }

    # Aggregate water levels for the last 24 hours
    wl_rows = (await db.execute(
        select(WaterLevel.station_id, WaterLevel.level_m)
        .where(and_(WaterLevel.datetime >= window_start, WaterLevel.datetime <= as_of))
    )).all()
    water_bucket: Dict[str, List[float]] = {}
    for sid, lvl in wl_rows:
        if lvl is None:
            continue
        water_bucket.setdefault(sid, []).append(float(lvl))
    water_avg: Dict[str, float] = {sid: (sum(vals) / len(vals)) for sid, vals in water_bucket.items() if vals}

    # Aggregate rainfall for the last 24 hours
    rf_rows = (await db.execute(
        select(Rainfall.station_id, Rainfall.amount_mm)
        .where(and_(Rainfall.datetime >= window_start, Rainfall.datetime <= as_of))
    )).all()
    rain_bucket: Dict[str, float] = {}
    for sid, amt in rf_rows:
        if amt is None:
            continue
        rain_bucket[sid] = rain_bucket.get(sid, 0.0) + float(amt)

    return stations, water_avg, rain_bucket


@router.get("/tiles")
async def get_tiles(
    risk_level: Optional[str] = Query(None, regex="^(safe|normal|watch|warning|critical)$"),
    basin_id: Optional[str] = Query(None, description="Filter tiles by basin_id"),
    date: Optional[str] = Query(None, description="As-of date (YYYY-MM-DD or ISO)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all tiles or filter by risk level
    """
    as_of = _parse_date(date)
    stations, water_avg, rain_sum = await _load_station_snapshots(db, as_of)

    # Preload latest per-basin predictions for the tile-level AI panel.
    # NOTE: This avoids per-tile DB queries inside the nested tile loops.
    basin_ids = list(settings.BASINS.keys())
    pred_rows = (
        await db.execute(
            select(Prediction)
            .where(Prediction.basin_id.in_(basin_ids))
            .order_by(Prediction.basin_id, Prediction.predict_date.desc())
        )
    ).scalars().all()
    latest_predictions: Dict[str, Dict[str, Any]] = {}
    for p in pred_rows:
        if not p.basin_id or p.basin_id in latest_predictions:
            continue
        # Convert ML probability (0-1) into percent (0-100) for the existing UI.
        flood_probability_percent = (float(p.flood_probability or 0.0) * 100.0)
        days_ahead = 0
        if p.predict_date and p.target_date:
            days_ahead = int(round((p.target_date - p.predict_date).total_seconds() / 86400.0))
            days_ahead = max(0, days_ahead)

        latest_predictions[p.basin_id] = {
            "floodProbability": flood_probability_percent,
            "daysAhead": days_ahead,
        }

    # Build per-tile aggregations from real station readings.
    tile_water_vals: Dict[str, List[float]] = {}
    tile_rain_vals: Dict[str, List[float]] = {}
    tile_station_count: Dict[str, int] = {}
    tile_basin_votes: Dict[str, Dict[str, int]] = {}

    for sid, meta in stations.items():
        tid = _tile_key_for_station(meta["lat"], meta["lon"])
        if not tid:
            continue
        tile_station_count[tid] = tile_station_count.get(tid, 0) + 1
        bid = meta.get("basin_id")
        if bid:
            tile_basin_votes.setdefault(tid, {})
            tile_basin_votes[tid][bid] = tile_basin_votes[tid].get(bid, 0) + 1

        if sid in water_avg:
            tile_water_vals.setdefault(tid, []).append(water_avg[sid])
        if sid in rain_sum:
            tile_rain_vals.setdefault(tid, []).append(rain_sum[sid])

    features: List[Dict[str, Any]] = []
    lat = THAILAND_BOUNDS["lat_min"]
    while lat < THAILAND_BOUNDS["lat_max"]:
        lon = THAILAND_BOUNDS["lon_min"]
        while lon < THAILAND_BOUNDS["lon_max"]:
            if not is_tile_in_thailand(lat, lon):
                lon += TILE_SIZE
                continue

            tid = generate_tile_id(lat, lon)
            waters = tile_water_vals.get(tid, [])
            rains = tile_rain_vals.get(tid, [])
            avg_water = (sum(waters) / len(waters)) if waters else 0.0
            rain_24h = sum(rains) if rains else 0.0
            risk = calculate_risk_level(avg_water, rain_24h)

            votes = tile_basin_votes.get(tid, {})
            inferred_basin_id = max(votes.items(), key=lambda kv: kv[1])[0] if votes else None

            props: Dict[str, Any] = {
                "id": tid,
                "bounds": None,
                "center": [lat + TILE_SIZE / 2, lon + TILE_SIZE / 2],
                "riskLevel": risk,
                "basin_id": inferred_basin_id,
                "stats": {
                    "avgWaterLevel": round(avg_water, 2),
                    "rainfall24h": round(rain_24h, 1),
                    "stationCount": tile_station_count.get(tid, 0),
                    "populationAtRisk": 0,
                    "trend": "stable",
                    "trendPercent": 0.0,
                },
                "provinces": TILE_PROVINCES.get(tid, ["ไม่ระบุ"]),
                "rivers": [],
                "dams": [],
                "aiPrediction": {
                    "floodProbability": (latest_predictions.get(inferred_basin_id or "", {}).get("floodProbability") or 0.0),
                    "daysAhead": (latest_predictions.get(inferred_basin_id or "", {}).get("daysAhead") or 0),
                },
                "lastUpdate": as_of.isoformat(),
            }

            if basin_id and inferred_basin_id and inferred_basin_id != basin_id:
                lon += TILE_SIZE
                continue
            if basin_id and inferred_basin_id is None:
                # If filtering by basin, keep only tiles with a basin assignment.
                lon += TILE_SIZE
                continue
            if risk_level and risk != risk_level:
                lon += TILE_SIZE
                continue

            features.append({
                "type": "Feature",
                "id": tid,
                "properties": props,
                "geometry": {"type": "Polygon", "coordinates": tile_polygon_coordinates(lat, lon)},
            })

            lon += TILE_SIZE
        lat += TILE_SIZE
    
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {
            "dataSource": "database",
            "asOf": as_of.isoformat(),
            "basinFilter": basin_id,
            "riskFilter": risk_level,
        },
    }


@router.get("/tiles/summary")
async def get_summary(
    basin_id: Optional[str] = Query(None, description="Filter by basin_id"),
    date: Optional[str] = Query(None, description="As-of date (YYYY-MM-DD or ISO)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get summary statistics of all tiles
    """
    fc = await get_tiles(risk_level=None, basin_id=basin_id, date=date, db=db)
    risk_counts = {"safe": 0, "normal": 0, "watch": 0, "warning": 0, "critical": 0}
    total_pop = 0
    for f in fc.get("features", []):
        rl = (f.get("properties") or {}).get("riskLevel") or "safe"
        if rl in risk_counts:
            risk_counts[rl] += 1
        total_pop += ((f.get("properties") or {}).get("stats") or {}).get("populationAtRisk") or 0
    return {
        "totalTiles": len(fc.get("features", [])),
        "riskCounts": risk_counts,
        "totalPopulationAtRisk": total_pop,
        "lastUpdate": (fc.get("meta") or {}).get("asOf"),
        "meta": {**(fc.get("meta") or {}), "dataSource": "database"},
    }


@router.get("/flood-risk")
async def get_flood_risk(
    basin_id: Optional[str] = Query(None, description="Filter tiles by basin_id"),
    date: Optional[str] = Query(None, description="As-of date (YYYY-MM-DD or ISO)"),
    risk_level: Optional[str] = Query(
        None,
        regex="^(safe|normal|watch|warning|critical)$",
        description="Optional filter by risk level",
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Flood-risk polygons used by the Mapbox project-dashboard overlay.
    Returns a FeatureCollection compatible with mapbox-gl fill layers.
    """
    # Reuse the tile generator; the frontend styles by `properties.riskLevel`.
    fc = await get_tiles(
        risk_level=risk_level,
        basin_id=basin_id,
        date=date,
        db=db,
    )
    return fc


@router.get("/tiles/{tile_id}")
async def get_tile(tile_id: str):
    """Get detailed information for a specific tile"""
    raise HTTPException(status_code=501, detail="Use /tiles and filter by id client-side for now.")


@router.get("/tiles/{tile_id}/history")
async def get_history(
    tile_id: str,
    days: int = Query(default=7, ge=1, le=30),
):
    """Get historical data for a tile"""
    raise HTTPException(status_code=501, detail="Use /tiles with ?date=YYYY-MM-DD for timelapse/history.")


@router.get("/tiles/{tile_id}/satellite")
async def get_tile_satellite_data(tile_id: str):
    """
    Get satellite data for a specific tile
    
    Returns NDVI, NDWI, MNDWI, LSWI, NDBI indices and water area analysis
    """
    from app.services.earth_engine_service import get_earth_engine_service
    from datetime import datetime, timedelta
    
    # Parse tile ID to get coordinates
    # Format: tile_LAT_LON (e.g., tile_15.5_100.5)
    try:
        parts = tile_id.split("_")
        lat = float(parts[1])
        lon = float(parts[2])
    except:
        return {"error": "Invalid tile ID format"}, 400
    
    # Create bounding box (0.5 degree tile)
    tile_size = 0.5
    bbox = [lon, lat, lon + tile_size, lat + tile_size]
    
    # Get data for last 7 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    ee_service = get_earth_engine_service()
    data = ee_service.get_sentinel2_data(
        bbox,
        start_date.strftime('%Y-%m-%d'),
        end_date.strftime('%Y-%m-%d')
    )
    
    if not data:
        return {
            "error": "No satellite data available",
            "tileId": tile_id,
            "bbox": bbox
        }
    
    return {
        "tileId": tile_id,
        "bbox": bbox,
        "center": [lat + tile_size/2, lon + tile_size/2],
        "ndvi": data.get("avg_ndvi", 0),
        "ndwi": data.get("avg_ndwi", 0),
        "mndwi": data.get("avg_mndwi", 0),
        "lswi": data.get("avg_lswi", 0),
        "ndbi": data.get("avg_ndbi", 0),
        "waterArea": data.get("water_area_sqkm", 0),
        "date": data.get("acquisition_date", datetime.now().isoformat()),
        "cloudCoverage": data.get("cloud_coverage", 0),
        "source": data.get("source", "unknown"),
        "resolution": data.get("resolution_m", 10),
        "meta": {
            "dataSource": "sentinel-2" if not ee_service.mock_mode else "simulated",
            "warning": "This data is simulated for demonstration purposes" if ee_service.mock_mode else None
        }
    }
