#!/usr/bin/env python3
"""
One-time converter: Folium-exported flood_v3_daily.html -> GeoJSON FeatureCollection.
Usage:
  python scripts/flood_v3_html_to_geojson.py [input.html] [output.geojson]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

FILL_TO_CONFUSION = {
    "#2ecc71": "TP",
    "#3498db": "TN",
    "#f39c12": "FP",
    "#e74c3c": "FN",
}

# Tooltip: "… | … | actual:0 pred:0 (0%)"
TOOLTIP_RE = re.compile(
    r"actual:\s*(\d+)\s+pred:\s*(\d+)\s+\((\d+)%\)",
    re.DOTALL,
)


def _strip_html(s: str) -> str:
    return " ".join(re.sub(r"<[^>]+>", " ", s).split())

MARKER_BLOCK = re.compile(
    r"L\.circleMarker\(\s*\[([\d.+-]+),\s*([\d.+-]+)\],\s*\{[^}]*\"fillColor\":\s*\"(#[0-9a-fA-F]{6})\"[^}]*\}\s*\)[^;]*;\s*"
    r"\s*\n\s*[^\n]*bindTooltip\(\s*`([^`]+)`",
    re.MULTILINE | re.DOTALL,
)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    in_path = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "flood_v3_daily.html"
    out_path = (
        Path(sys.argv[2])
        if len(sys.argv) > 2
        else root / "frontend" / "public" / "geojson" / "flood_v3_daily_validation.geojson"
    )

    if not in_path.is_file():
        print(f"Input not found: {in_path}", file=sys.stderr)
        return 1

    text = in_path.read_text(encoding="utf-8", errors="replace")
    matches = MARKER_BLOCK.findall(text)
    if not matches:
        print("No circle markers matched; check Folium HTML format.", file=sys.stderr)
        return 1

    features = []
    for lat_s, lon_s, fill, tip_raw in matches:
        lat, lon = float(lat_s), float(lon_s)
        fill_l = fill.lower()
        confusion = FILL_TO_CONFUSION.get(fill_l)
        if confusion is None:
            confusion = "UNKNOWN"

        tip_clean = _strip_html(tip_raw)
        m = TOOLTIP_RE.search(tip_clean)
        actual = int(m.group(1)) if m else None
        pred = int(m.group(2)) if m else None
        prob_pct = int(m.group(3)) if m else None

        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "confusion": confusion,
                    "fill": fill_l,
                    "actual": actual,
                    "pred": pred,
                    "prob_pct": prob_pct,
                    "label": tip_clean,
                },
            }
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fc = {
        "type": "FeatureCollection",
        "features": features,
        "properties": {
            "model": "V3 DAILY",
            "cv_auc": 0.9609,
            "tb_auc": 0.9973,
            "threshold": 0.2,
            "tp": 213,
            "fn": 8,
            "fp": 46,
            "tn": 6096,
            "source": "flood_v3_daily Folium export",
        },
    }
    out_path.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(features)} features -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
