"""Load tambon (sub-district) centroids [lon, lat] keyed by official tb_idn string.

Data file `tambon_centroids.json` is generated from
`kongvut/thai-province-data` sub_district.json (DOPA id + lat/long where present).
Regenerate with the same Python snippet used at integration time if boundaries update.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_DATA: Optional[Dict[str, List[float]]] = None


def _path() -> Path:
    return Path(__file__).resolve().parent / "tambon_centroids.json"


def _load() -> Dict[str, List[float]]:
    global _DATA
    if _DATA is not None:
        return _DATA
    p = _path()
    if not p.is_file():
        _DATA = {}
        return _DATA
    with open(p, encoding="utf-8") as f:
        _DATA = json.load(f)
    return _DATA


def get_lonlat(tb_idn: Any) -> Optional[Tuple[float, float]]:
    """Return (lon, lat) for GeoJSON coordinates, or None if unknown."""
    if tb_idn is None:
        return None
    try:
        key = str(int(tb_idn))
    except (TypeError, ValueError):
        key = str(tb_idn).strip()
    coords = _load().get(key)
    if not coords or len(coords) < 2:
        return None
    return float(coords[0]), float(coords[1])
