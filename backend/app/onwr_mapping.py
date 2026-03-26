"""
ONWR Jupyter pipeline basin names ↔ RIFFAI app basin ids.

Pipeline output paths use folder names like UpperMekong (see Model_Output_v2_Stats/).
"""
from __future__ import annotations

from typing import Dict, Optional

# Canonical pipeline folder names under GCS (PascalCase as produced by notebooks)
PIPELINE_BASIN_UPPER_MEKONG = "UpperMekong"
PIPELINE_BASIN_EAST_COAST = "EastCoast"
PIPELINE_BASIN_LOWER_SOUTH_EAST = "LowerSouthEast"

PIPELINE_TO_APP_BASIN: Dict[str, str] = {
    PIPELINE_BASIN_UPPER_MEKONG: "mekong_north",
    PIPELINE_BASIN_EAST_COAST: "eastern_coast",
    PIPELINE_BASIN_LOWER_SOUTH_EAST: "southern_east",
}

APP_TO_PIPELINE_BASIN: Dict[str, str] = {v: k for k, v in PIPELINE_TO_APP_BASIN.items()}

# Accept these URL path tokens (case-insensitive)
_BASIN_ALIASES: Dict[str, str] = {}
for _p, _a in PIPELINE_TO_APP_BASIN.items():
    _BASIN_ALIASES[_p.lower()] = _p
    _BASIN_ALIASES[_p.lower().replace("_", "")] = _p
_BASIN_ALIASES["uppermekong"] = PIPELINE_BASIN_UPPER_MEKONG
_BASIN_ALIASES["upper_mekong"] = PIPELINE_BASIN_UPPER_MEKONG
_BASIN_ALIASES["eastcoast"] = PIPELINE_BASIN_EAST_COAST
_BASIN_ALIASES["lowersoutheast"] = PIPELINE_BASIN_LOWER_SOUTH_EAST
_BASIN_ALIASES["lower_south_east"] = PIPELINE_BASIN_LOWER_SOUTH_EAST
# App ids also accepted for convenience
for _p, _a in PIPELINE_TO_APP_BASIN.items():
    _BASIN_ALIASES[_a.lower()] = _p


def normalize_basin_key(basin_en: str) -> str:
    """Return canonical pipeline basin folder name or raise ValueError."""
    if not basin_en:
        raise ValueError("empty basin")
    raw = basin_en.strip()
    # Exact pipeline name
    if raw in PIPELINE_TO_APP_BASIN:
        return raw
    key = raw.lower().replace("-", "_")
    if key in _BASIN_ALIASES:
        return _BASIN_ALIASES[key]
    raise ValueError(f"Unknown basin_en={basin_en!r}; use {list(PIPELINE_TO_APP_BASIN.keys())}")


def pipeline_to_app_basin(pipeline_basin: str) -> str:
    return PIPELINE_TO_APP_BASIN[pipeline_basin]


def try_app_basin_to_pipeline(app_basin_id: str) -> Optional[str]:
    return APP_TO_PIPELINE_BASIN.get(app_basin_id)
