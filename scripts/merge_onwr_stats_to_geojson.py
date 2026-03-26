#!/usr/bin/env python3
"""
Merge zonal-stats CSV (HYBAS_ID + mean_z_score) with HydroBASIN GeoJSON for upload to GCS, e.g.:

  gs://onwr-data/Model_Output_v2_Stats_GeoJSON/{Basin}/{date}.geojson

Usage:
  python scripts/merge_onwr_stats_to_geojson.py \\
    --hydro path/to/hybas.geojson \\
    --csv path/to/stats.csv \\
    --out path/to/out.geojson \\
    --date 2026-01-15 \\
    --pipeline-basin UpperMekong \\
    --app-basin mekong_north
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

Z_FLOOD_THRESHOLD = -3.0


def _hid(v) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    try:
        x = float(v)
        return str(int(x)) if x == int(x) else str(x)
    except (TypeError, ValueError):
        return str(v).strip()


def main() -> int:
    ap = argparse.ArgumentParser(description="Merge ONWR CSV zonal stats into HydroBASIN GeoJSON")
    ap.add_argument("--hydro", required=True, type=Path, help="HydroBASIN polygons GeoJSON")
    ap.add_argument("--csv", required=True, type=Path, help="Zonal statistics CSV")
    ap.add_argument("--out", required=True, type=Path, help="Output FeatureCollection path")
    ap.add_argument("--date", required=True, help="Acquisition date YYYY-MM-DD")
    ap.add_argument("--pipeline-basin", required=True, help="e.g. UpperMekong")
    ap.add_argument("--app-basin", required=True, help="e.g. mekong_north")
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    df.columns = [str(c).strip() for c in df.columns]
    id_col = next((c for c in df.columns if c.upper().replace(" ", "") in ("HYBAS_ID", "HYBAS_ID9")), None)
    if not id_col:
        print("No HYBAS_ID column in CSV", file=sys.stderr)
        return 1
    z_col = next(
        (c for c in df.columns if c.lower() in ("mean_z_score", "mean_z", "mean", "z_mean")),
        None,
    )
    if not z_col:
        print("No mean_z_score-like column in CSV", file=sys.stderr)
        return 1

    by_id = {}
    for _, row in df.iterrows():
        k = _hid(row[id_col])
        if k:
            try:
                mz = float(row[z_col])
            except (TypeError, ValueError):
                mz = None
            by_id[k] = mz

    with open(args.hydro, encoding="utf-8") as f:
        hydro = json.load(f)

    feats = []
    for feat in hydro.get("features", []):
        props = dict(feat.get("properties") or {})
        hid = ""
        for key in ("HYBAS_ID", "HYBAS_ID9", "PFAF_ID", "hybas_id"):
            if key in props and props[key] is not None:
                hid = _hid(props[key])
                break
        mz = by_id.get(hid)
        flood = mz is not None and mz < Z_FLOOD_THRESHOLD
        props.update(
            {
                "basin_app_id": args.app_basin,
                "pipeline_basin": args.pipeline_basin,
                "date": args.date,
                "mean_z_score": mz,
                "flood_detected": flood,
                "z_flood_threshold": Z_FLOOD_THRESHOLD,
            }
        )
        if hid:
            props.setdefault("HYBAS_ID", int(hid) if hid.isdigit() else hid)
        feats.append({"type": "Feature", "geometry": feat.get("geometry"), "properties": props})

    out = {
        "type": "FeatureCollection",
        "features": feats,
        "properties": {
            "date": args.date,
            "pipeline_basin": args.pipeline_basin,
            "app_basin_id": args.app_basin,
        },
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"Wrote {args.out} ({len(feats)} features)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
