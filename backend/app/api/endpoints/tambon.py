"""
Tambon Flood Prediction Endpoints
Integration with XGBoost model API
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Any, Dict, List

from app.data.tambon_centroids import get_lonlat
from app.services.flood_prediction_service import get_flood_prediction_service

router = APIRouter()


def _flood_props(tambon: Dict[str, Any]) -> Dict[str, Any]:
    fp = tambon.get("flood_probability")
    pct = tambon.get("flood_percent")
    if pct is None and fp is not None:
        try:
            pct = round(float(fp) * 100, 1)
        except (TypeError, ValueError):
            pct = None
    return {
        "tb_idn": tambon.get("tb_idn"),
        "tb_tn": tambon.get("tb_tn"),
        "ap_tn": tambon.get("ap_tn"),
        "pv_tn": tambon.get("pv_tn"),
        "flood_probability": fp,
        "flood_percent": pct,
        "risk_level": tambon.get("risk_level"),
    }


@router.get("/tambon/{tb_idn}")
async def get_tambon_prediction(tb_idn: str):
    """
    Get flood prediction for a specific tambon
    
    Args:
        tb_idn: Tambon ID (e.g., "800203")
    
    Returns:
        Tambon prediction with flood probability and risk level
    """
    service = get_flood_prediction_service()
    prediction = await service.get_tambon_prediction(tb_idn)
    
    if not prediction:
        raise HTTPException(status_code=404, detail=f"Tambon {tb_idn} not found")
    
    return prediction


@router.get("/tambon/province/{province_name}")
async def get_province_tambons(province_name: str):
    """
    Get all tambon predictions in a province
    
    Args:
        province_name: Province name in Thai (e.g., "นครศรีธรรมราช" or "จ.นครศรีธรรมราช")
    
    Returns:
        List of tambon predictions
    """
    service = get_flood_prediction_service()
    
    # Add "จ." prefix if not present
    if not province_name.startswith("จ."):
        province_name = f"จ.{province_name}"
    
    predictions = await service.get_province_predictions(province_name)
    
    return {
        "province": province_name,
        "total": len(predictions),
        "tambons": predictions
    }


@router.get("/tambon/top-risk")
async def get_top_risk_tambons(
    limit: int = Query(default=100, ge=1, le=1000)
):
    """
    Get top N highest risk tambons nationwide
    
    Args:
        limit: Number of tambons to return (1-1000)
    
    Returns:
        List of highest risk tambons
    """
    service = get_flood_prediction_service()
    tambons = await service.get_top_risk_tambons(limit)
    
    return {
        "total": len(tambons),
        "tambons": tambons
    }


@router.get("/tambon/search")
async def search_tambons(
    q: str = Query(..., min_length=1, description="Search keyword")
):
    """
    Search tambons by name
    
    Args:
        q: Search keyword (tambon, district, or province name)
    
    Returns:
        List of matching tambons
    """
    service = get_flood_prediction_service()
    results = await service.search_tambons(q)
    
    return {
        "query": q,
        "total": len(results),
        "results": results
    }


@router.get("/tambon/stats")
async def get_risk_statistics():
    """
    Get nationwide flood risk statistics
    
    Returns:
        Risk distribution and summary statistics
    """
    service = get_flood_prediction_service()
    stats = await service.get_risk_stats()
    
    return stats


@router.get("/tambon/basin/{basin_id}/summary")
async def get_basin_tambon_summary(basin_id: str):
    """
    Get aggregated tambon flood risk for a basin
    
    Args:
        basin_id: Basin identifier (e.g., "chao-phraya", "mekong")
    
    Returns:
        Basin-level summary with top risk tambons
    """
    service = get_flood_prediction_service()
    summary = await service.get_basin_tambons_summary(basin_id)
    
    return summary


@router.get("/tambon/map/geojson")
async def get_tambon_flood_geojson(
    risk_level: Optional[str] = Query(
        None, pattern="^(VERY_HIGH|HIGH|MEDIUM|LOW|VERY_LOW)$"
    ),
    min_probability: Optional[float] = Query(None, ge=0, le=1),
    limit: int = Query(default=1000, ge=1, le=6363)
):
    """
    Get tambon flood predictions as GeoJSON for map display
    
    Args:
        risk_level: Filter by risk level
        min_probability: Minimum flood probability (0-1)
        limit: Maximum number of tambons to return
    
    Returns:
        GeoJSON FeatureCollection
    """
    service = get_flood_prediction_service()
    
    # Get top risk tambons (they're most important to display)
    raw: List[Dict[str, Any]] = await service.get_top_risk_tambons(limit)
    if not isinstance(raw, list):
        raw = []
    
    # Apply filters
    if risk_level:
        raw = [t for t in raw if t.get("risk_level") == risk_level]
    
    if min_probability is not None:
        raw = [t for t in raw if t.get("flood_probability", 0) >= min_probability]
    
    features: List[Dict[str, Any]] = []
    skipped_no_coord = 0
    for tambon in raw:
        ll = get_lonlat(tambon.get("tb_idn"))
        if ll is None:
            skipped_no_coord += 1
            continue
        lon, lat = ll
        features.append({
            "type": "Feature",
            "id": tambon.get("tb_idn"),
            "properties": _flood_props(tambon),
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],
            },
        })
    
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {
            "total": len(features),
            "skipped_no_centroid": skipped_no_coord,
            "filtered_by": {
                "risk_level": risk_level,
                "min_probability": min_probability,
            },
        },
    }
