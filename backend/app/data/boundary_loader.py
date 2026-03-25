import json
import os
from functools import lru_cache
from typing import Any, Dict, Optional


BOUNDARIES_DIR = os.path.join(os.path.dirname(__file__), "boundaries")


def _safe_read_json(path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def _ensure_feature_collection(obj: Dict[str, Any], *, name: str) -> Dict[str, Any]:
    if not isinstance(obj, dict) or obj.get("type") != "FeatureCollection":
        raise ValueError(f"{name} must be a GeoJSON FeatureCollection")
    features = obj.get("features")
    if not isinstance(features, list):
        raise ValueError(f"{name}.features must be a list")
    return obj


@lru_cache(maxsize=1)
def load_basins_geojson() -> Optional[Dict[str, Any]]:
    path = os.path.join(BOUNDARIES_DIR, "basins.geojson")
    obj = _safe_read_json(path)
    if not obj:
        return None
    return _ensure_feature_collection(obj, name="basins.geojson")


@lru_cache(maxsize=32)
def load_subbasins_geojson(basin_id: str) -> Optional[Dict[str, Any]]:
    filename = f"subbasins_{basin_id}.geojson"
    path = os.path.join(BOUNDARIES_DIR, filename)
    obj = _safe_read_json(path)
    if not obj:
        return None
    fc = _ensure_feature_collection(obj, name=filename)
    # Normalize/validate minimal properties used by frontend filtering.
    for f in fc.get("features", []):
        props = f.get("properties") or {}
        if "basin_id" not in props:
            props["basin_id"] = basin_id
        f["properties"] = props
    return fc

