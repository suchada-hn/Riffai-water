from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime
from typing import Optional

from app.models.database import get_db
from app.models.models import Basin, Station, SatelliteImage, Prediction, WaterLevel
from app.services.gcs_service import GCSService
from app.config import get_settings
from app.data.rivers import get_rivers_geojson
from app.data.dams import get_dams_geojson
from app.data.boundary_loader import load_basins_geojson, load_subbasins_geojson
from app.onwr_mapping import try_app_basin_to_pipeline
from app.services.onwr_stats_service import OnwrStatsService, get_onwr_stats_service

router = APIRouter()
settings = get_settings()
gcs = GCSService()


@router.get("/basins")
async def get_basins_geojson(db: AsyncSession = Depends(get_db)):
    """ขอบเขต GeoJSON ของ 3 ลุ่มน้ำ"""
    try:
        # Prefer real boundaries from GeoJSON (downloaded from GCS)
        fc = load_basins_geojson()
        if fc:
            return fc

        result = await db.execute(
            select(Basin.id, Basin.name, Basin.provinces, Basin.area_sqkm, Basin.bbox)
        )
        basins = result.all()
        
        features = []
        for basin in basins:
            features.append({
                "type": "Feature",
                "properties": {
                    "id": basin[0],
                    "name": basin[1],
                    "provinces": basin[2],
                    "area_sqkm": basin[3],
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": _bbox_to_polygon(basin[4])
                }
            })
        
        return {
            "type": "FeatureCollection",
            "features": features
        }
    except Exception as e:
        print(f"Error in get_basins_geojson: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load basins: {str(e)}")


def _annotate_subbasin_fc(fc: dict, basin_id: str) -> dict:
    for f in fc.get("features", []):
        props = f.get("properties") or {}
        props.setdefault("basin_id", basin_id)
        props.setdefault(
            "subbasin_id",
            props.get("id") or props.get("sub_id") or props.get("HYBAS_ID") or props.get("name") or None,
        )
        f["properties"] = props
    return fc


@router.get("/subbasins")
async def get_subbasins_geojson(
    basin_id: str = Query(..., description="Basin id (e.g. mekong_north)"),
    svc: OnwrStatsService = Depends(get_onwr_stats_service),
):
    """
    Sub-basin boundaries as GeoJSON FeatureCollection.

    Prefer local file backend/app/data/boundaries/subbasins_<basin_id>.geojson;
    otherwise latest ONWR SubBasin_ZScore GeoJSON from GCS (same source as /api/basins/.../stats).
    """
    try:
        fc = load_subbasins_geojson(basin_id)
        if not fc:
            pipeline = try_app_basin_to_pipeline(basin_id)
            if pipeline:
                dates = svc.list_dates(pipeline)
                if dates:
                    try:
                        fc = svc.build_feature_collection(pipeline, dates[-1])
                    except FileNotFoundError:
                        fc = None
            if not fc:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        f"Subbasins not found for basin_id={basin_id}. "
                        "No local subbasins_*.geojson and no GCS stats for this basin."
                    ),
                )

        _annotate_subbasin_fc(fc, basin_id)
        return fc
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_subbasins_geojson: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load subbasins: {str(e)}")


@router.get("/stations")
async def get_stations(
    basin_id: Optional[str] = None,
    station_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """สถานีตรวจวัดทั้งหมด"""
    try:
        query = select(Station).where(Station.is_active == True)
        
        if basin_id:
            query = query.where(Station.basin_id == basin_id)
        if station_type:
            query = query.where(Station.station_type == station_type)
        
        result = await db.scalars(query)
        stations = result.all()
        
        features = []
        for s in stations:
            features.append({
                "type": "Feature",
                "properties": {
                    "id": s.id,
                    "name": s.name,
                    "type": s.station_type,
                    "province": s.province,
                    "basin_id": s.basin_id,
                    "source": s.source,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [s.lon, s.lat]
                }
            })
        
        return {"type": "FeatureCollection", "features": features}
    except Exception as e:
        print(f"Error in get_stations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load stations: {str(e)}")


@router.get("/water-level-map")
async def get_water_level_map(
    basin_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """แผนที่ระดับน้ำปัจจุบัน ทุกสถานี"""
    
    query = (
        select(
            Station.id, Station.name, Station.lat, Station.lon,
            Station.province, Station.basin_id,
            WaterLevel.level_m, WaterLevel.datetime
        )
        .join(WaterLevel, WaterLevel.station_id == Station.id)
        .where(Station.station_type == "water_level")
        .where(Station.is_active == True)
        .order_by(Station.id, WaterLevel.datetime.desc())
        .distinct(Station.id)
    )
    
    if basin_id:
        query = query.where(Station.basin_id == basin_id)
    
    result = await db.execute(query)
    
    features = []
    for row in result:
        level = row[6]
        risk = "normal"
        if level and level > settings.ALERT_WATER_LEVEL_CRITICAL:
            risk = "critical"
        elif level and level > settings.ALERT_WATER_LEVEL_WARNING:
            risk = "warning"
        elif level and level > settings.ALERT_WATER_LEVEL_WARNING * 0.8:
            risk = "watch"
        
        features.append({
            "type": "Feature",
            "properties": {
                "station_id": row[0],
                "name": row[1],
                "province": row[4],
                "basin_id": row[5],
                "water_level_m": row[6],
                "datetime": row[7].isoformat() if row[7] else None,
                "risk_level": risk,
            },
            "geometry": {
                "type": "Point",
                "coordinates": [row[3], row[2]]
            }
        })
    
    return {"type": "FeatureCollection", "features": features}


def _bbox_to_polygon(bbox):
    """Convert [min_lon, min_lat, max_lon, max_lat] to Polygon coordinates"""
    if not bbox:
        return None
    min_lon, min_lat, max_lon, max_lat = bbox
    return [[
        [min_lon, min_lat],
        [max_lon, min_lat],
        [max_lon, max_lat],
        [min_lon, max_lat],
        [min_lon, min_lat],
    ]]


@router.get("/rivers")
async def get_rivers():
    """แม่น้ำสายหลักในประเทศไทย"""
    try:
        return get_rivers_geojson()
    except Exception as e:
        print(f"Error in get_rivers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load rivers: {str(e)}")


@router.get("/dams")
async def get_dams():
    """เขื่อนและอ่างเก็บน้ำสำคัญ"""
    try:
        return get_dams_geojson()
    except Exception as e:
        print(f"Error in get_dams: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load dams: {str(e)}")


@router.get("/flood-layer/{basin_id}")
async def get_flood_layer_sar(
    basin_id: str,
    date: Optional[str] = Query(
        default=None,
        description="YYYY-MM-DD; defaults to latest available ONWR stats date",
    ),
    svc: OnwrStatsService = Depends(get_onwr_stats_service),
):
    """
    Sub-basin SAR z-score / flood mask aggregates (ONWR pipeline) as GeoJSON for map overlay.
    basin_id uses app ids: mekong_north, eastern_coast, southern_east.
    """
    pipeline = try_app_basin_to_pipeline(basin_id)
    if not pipeline:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid basin_id={basin_id!r}; expected one of app basin ids mapped to ONWR",
        )
    dates = svc.list_dates(pipeline)
    if not dates:
        raise HTTPException(
            status_code=404,
            detail="No ONWR stats CSV found for this basin (check GCS or ONWR_DEV_FIXTURES_DIR)",
        )
    if date:
        if date not in dates:
            raise HTTPException(
                status_code=404,
                detail=f"No stats for date={date!r}. Available: {dates[:20]}{'...' if len(dates) > 20 else ''}",
            )
        use_date = date
    else:
        use_date = dates[-1]
    try:
        fc = svc.build_feature_collection(pipeline, use_date)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    fc.setdefault("properties", {})
    fc["properties"].update(
        {"basin_id": basin_id, "pipeline_basin": pipeline, "date": use_date, "source": "onwr_stats"}
    )
    return fc
