"""
Read ONWR zonal statistics from GCS (or local dev fixtures) and expose GeoJSON FeatureCollections.

Expected CSV columns (flexible names):

- Sub-basin id: HYBAS_ID, HYBAS_ID9, hybas_id
- Z-score aggregate: mean_z_score, mean_z, mean, MEAN, z_mean (first numeric found)
- Optional flood pixel count: flood_count, flood_pixels, count_flood

Flood flag: mean_z_score < -3 (Sentinel-1 VV logic from pipeline) if no explicit flood column.
"""
from __future__ import annotations

import io
import json
import os
import re
import time
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from app.config import get_settings
from app.onwr_mapping import PIPELINE_TO_APP_BASIN, pipeline_to_app_basin
from app.services.gcs_service import GCSService

ISO_DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")
Z_FLOOD_THRESHOLD = -3.0
_CACHE_TTL_SEC = 120.0
_stats_cache: Dict[str, Tuple[float, Any]] = {}
_dates_cache: Dict[str, Tuple[float, List[str]]] = {}


def clear_onwr_response_caches() -> None:
    _stats_cache.clear()
    _dates_cache.clear()


def _cache_get(store: Dict[str, Tuple[float, Any]], key: str) -> Optional[Any]:
    ent = store.get(key)
    if ent and time.monotonic() - ent[0] < _CACHE_TTL_SEC:
        return ent[1]
    return None


def _cache_set(store: Dict[str, Tuple[float, Any]], key: str, val: Any) -> None:
    store[key] = (time.monotonic(), val)


class OnwrStatsService:
    def __init__(self):
        self.settings = get_settings()
        self.gcs = GCSService()

    def _bucket(self) -> str:
        return self.settings.GCS_BUCKET_ONWR

    def _stats_prefix(self) -> str:
        p = self.settings.ONWR_STATS_PREFIX
        return p if p.endswith("/") else f"{p}/"

    def _geojson_prefix(self) -> str:
        p = self.settings.ONWR_STATS_GEOJSON_PREFIX
        return p if p.endswith("/") else f"{p}/"

    def _fixture_base(self, pipeline_basin: str) -> Optional[str]:
        root = (self.settings.ONWR_DEV_FIXTURES_DIR or "").strip()
        if not root:
            return None
        return os.path.join(root, pipeline_basin)

    def _hydro_geojson_path(self, pipeline_basin: str) -> Optional[str]:
        custom = (self.settings.ONWR_HYDRO_LOCAL_DIR or "").strip()
        candidates = []
        if custom:
            candidates.append(os.path.join(custom, f"hybas_{pipeline_basin}.geojson"))
        here = os.path.dirname(os.path.dirname(__file__))
        candidates.append(
            os.path.join(here, "data", "boundaries", "onwr", f"hybas_{pipeline_basin}.geojson")
        )
        for c in candidates:
            if c and os.path.isfile(c):
                return c
        return None

    def _iter_stat_csv_sources(self, pipeline_basin: str) -> List[Tuple[str, Any]]:
        """
        Return list of (label, opener) where opener() -> str CSV text.
        label is 'gcs:<blob>' or 'file:<path>' for debugging.
        """
        out: List[Tuple[str, Any]] = []
        fix = self._fixture_base(pipeline_basin)
        if fix and os.path.isdir(fix):
            for fn in sorted(os.listdir(fix)):
                if fn.lower().endswith(".csv"):
                    path = os.path.join(fix, fn)

                    def _opener(p=path):
                        with open(p, encoding="utf-8", errors="replace") as f:
                            return f.read()

                    out.append((f"file:{fn}", _opener))

        prefix = f"{self._stats_prefix()}{pipeline_basin}/"
        if self.gcs.client:
            for name in self.gcs.list_files(self._bucket(), prefix):
                if name.lower().endswith(".csv"):

                    def _opener(b=name):
                        return self.gcs.download_text(self._bucket(), b)

                    out.append((f"gcs:{name}", _opener))
        return out

    def _dates_from_sources(self, pipeline_basin: str) -> List[str]:
        ck = f"dates:{pipeline_basin}"
        hit = _cache_get(_dates_cache, ck)
        if hit is not None:
            return hit

        dates: set[str] = set()
        for label, opener in self._iter_stat_csv_sources(pipeline_basin):
            if label.startswith("file:"):
                m = ISO_DATE_RE.search(label)
                if m:
                    dates.add(m.group(1))
            elif label.startswith("gcs:"):
                m = ISO_DATE_RE.search(label.split("/", 1)[-1])
                if m:
                    dates.add(m.group(1))
            try:
                body = opener()
            except Exception:
                continue
            for m in ISO_DATE_RE.finditer(body[: min(5000, len(body))]):
                dates.add(m.group(1))

        result = sorted(dates)
        _cache_set(_dates_cache, ck, result)
        return result

    def list_dates(self, pipeline_basin: str) -> List[str]:
        return self._dates_from_sources(pipeline_basin)

    def _parse_csv_rows(self, csv_text: str) -> List[Dict[str, Any]]:
        df = pd.read_csv(io.StringIO(csv_text))
        df.columns = [str(c).strip() for c in df.columns]
        return df.to_dict(orient="records")

    def _hybas_key_from_row(self, row: Dict[str, Any]) -> Optional[str]:
        for k in ("HYBAS_ID", "HYBAS_ID9", "hybas_id", "HYBASID", "HYBAS"):
            if k in row and row[k] is not None and str(row[k]).strip() != "":
                try:
                    v = float(row[k])
                    return str(int(v)) if v == int(v) else str(v)
                except (TypeError, ValueError):
                    return str(row[k]).strip()
        return None

    def _mean_z_from_row(self, row: Dict[str, Any]) -> Optional[float]:
        for k in ("mean_z_score", "mean_z", "MEAN_Z", "z_mean", "mean", "MEAN", "median_z", "median"):
            if k in row and row[k] is not None and str(row[k]).strip() != "":
                try:
                    return float(row[k])
                except (TypeError, ValueError):
                    continue
        return None

    def _flood_count_from_row(self, row: Dict[str, Any]) -> Optional[float]:
        for k in ("flood_count", "flood_pixels", "count_flood", "flood_mask_count", "flooded_pixels"):
            if k in row and row[k] is not None and str(row[k]).strip() != "":
                try:
                    return float(row[k])
                except (TypeError, ValueError):
                    continue
        return None

    def _rows_by_hybas(self, rows: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        by: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            hid = self._hybas_key_from_row(row)
            if hid:
                by[hid] = row
        return by

    def _try_load_premade_geojson(self, pipeline_basin: str, date_iso: str) -> Optional[dict]:
        blob = f"{self._geojson_prefix()}{pipeline_basin}/{date_iso}.geojson"
        if self.gcs.client and self.gcs.blob_exists(self._bucket(), blob):
            return self.gcs.download_geojson_dict(self._bucket(), blob)
        fix = self._fixture_base(pipeline_basin)
        if fix:
            fp = os.path.join(fix, f"{date_iso}.geojson")
            if os.path.isfile(fp):
                with open(fp, encoding="utf-8") as f:
                    return json.load(f)
        return None

    def _load_csv_for_date(self, pipeline_basin: str, date_iso: str) -> Optional[List[Dict[str, Any]]]:
        openers = []
        for label, opener in self._iter_stat_csv_sources(pipeline_basin):
            m = ISO_DATE_RE.search(label)
            if m and m.group(1) == date_iso:
                openers.append(opener)
            elif date_iso in label:
                openers.append(opener)
        for op in openers:
            try:
                return self._parse_csv_rows(op())
            except Exception:
                continue

        # Single-file fixture folders (filename without date)
        all_src = self._iter_stat_csv_sources(pipeline_basin)
        if len(all_src) == 1:
            try:
                rows = self._parse_csv_rows(all_src[0][1]())
                if rows and self._hybas_key_from_row(rows[0]):
                    return rows
            except Exception:
                pass
        return None

    def build_feature_collection(
        self, pipeline_basin: str, date_iso: str
    ) -> dict:
        ck = f"fc:{pipeline_basin}:{date_iso}"
        hit = _cache_get(_stats_cache, ck)
        if hit is not None:
            return hit

        premade = self._try_load_premade_geojson(pipeline_basin, date_iso)
        if premade and premade.get("type") == "FeatureCollection":
            _cache_set(_stats_cache, ck, premade)
            return premade

        rows = self._load_csv_for_date(pipeline_basin, date_iso)
        if not rows:
            raise FileNotFoundError(
                f"No CSV stats found for basin={pipeline_basin} date={date_iso}"
            )

        by_hybas = self._rows_by_hybas(rows)
        hydro_path = self._hydro_geojson_path(pipeline_basin)
        if not hydro_path:
            raise FileNotFoundError(
                f"No pre-merged GeoJSON and no local hybas file for {pipeline_basin}. "
                f"Set ONWR_HYDRO_LOCAL_DIR or add app/data/boundaries/onwr/hybas_{pipeline_basin}.geojson "
                f"or upload {self._geojson_prefix()}{pipeline_basin}/{date_iso}.geojson"
            )

        with open(hydro_path, encoding="utf-8") as f:
            hydro = json.load(f)

        app_basin = pipeline_to_app_basin(pipeline_basin)
        features_out = []
        for feat in hydro.get("features", []):
            props = dict(feat.get("properties") or {})
            hid = None
            for k in ("HYBAS_ID", "HYBAS_ID9", "PFAF_ID", "hybas_id"):
                if k in props and props[k] is not None:
                    try:
                        v = float(props[k])
                        hid = str(int(v)) if v == int(v) else str(v)
                    except (TypeError, ValueError):
                        hid = str(props[k]).strip()
                    break
            row = by_hybas.get(hid or "") if hid else None
            mz = self._mean_z_from_row(row) if row else None
            fc = self._flood_count_from_row(row) if row else None
            flood = False
            if mz is not None:
                flood = mz < Z_FLOOD_THRESHOLD
            if fc is not None and fc > 0:
                flood = True
            props.update(
                {
                    "basin_app_id": app_basin,
                    "pipeline_basin": pipeline_basin,
                    "date": date_iso,
                    "mean_z_score": mz,
                    "flood_pixel_count": fc,
                    "flood_detected": flood,
                    "z_flood_threshold": Z_FLOOD_THRESHOLD,
                }
            )
            if hid:
                props.setdefault("HYBAS_ID", hid)
            features_out.append({"type": "Feature", "geometry": feat.get("geometry"), "properties": props})

        fc_out = {"type": "FeatureCollection", "features": features_out}
        _cache_set(_stats_cache, ck, fc_out)
        return fc_out

    def latest_flood_alerts(self, limit: int = 200) -> dict:
        alerts = []
        for pipeline_basin in PIPELINE_TO_APP_BASIN:
            dates = self.list_dates(pipeline_basin)
            if not dates:
                continue
            latest = dates[-1]
            try:
                fc = self.build_feature_collection(pipeline_basin, latest)
            except FileNotFoundError:
                continue
            for feat in fc.get("features", []):
                p = feat.get("properties") or {}
                if not p.get("flood_detected"):
                    continue
                alerts.append(
                    {
                        "pipeline_basin": pipeline_basin,
                        "app_basin_id": p.get("basin_app_id"),
                        "HYBAS_ID": p.get("HYBAS_ID"),
                        "name": p.get("NAME") or p.get("name") or p.get("SUB_NAME"),
                        "date": latest,
                        "mean_z_score": p.get("mean_z_score"),
                        "flood_detected": True,
                    }
                )

        alerts.sort(
            key=lambda x: (
                float(x["mean_z_score"]) if x["mean_z_score"] is not None else 0.0
            )
        )
        return {"alerts": alerts[:limit], "count": min(len(alerts), limit)}


@lru_cache
def get_onwr_stats_service() -> OnwrStatsService:
    return OnwrStatsService()
