from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from app.config import get_settings
from app.services.gcs_service import GCSService, GcsBlobInfo


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _maybe_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        if isinstance(v, bool):
            return None
        s = str(v).strip()
        if s == "":
            return None
        return float(s)
    except Exception:
        return None


@dataclass(frozen=True)
class ForecastArtifact:
    bucket: str
    prefix: str
    blob: Optional[GcsBlobInfo]
    updated: Optional[datetime]
    parsed: Optional[Dict[str, Any]]

    def to_meta(self) -> Dict[str, Any]:
        return {
            "bucket": self.bucket,
            "prefix": self.prefix,
            "blob": self.blob.name if self.blob else None,
            "gcs_path": self.blob.gcs_path() if self.blob else None,
            "updated": self.updated.isoformat() if self.updated else None,
            "generation": self.blob.generation if self.blob else None,
            "size": self.blob.size if self.blob else None,
            "content_type": self.blob.content_type if self.blob else None,
        }


@dataclass(frozen=True)
class NormalizedForecast:
    basin_id: str
    flood_probability: float
    predicted_water_level: Optional[float] = None
    affected_area_sqkm: Optional[float] = None
    confidence: Optional[float] = None
    model_version: str = "onwr-forecast"
    forecast_time: Optional[datetime] = None
    artifact: Optional[ForecastArtifact] = None

    def to_prediction_fields(self) -> Dict[str, Any]:
        return {
            "flood_probability": self.flood_probability,
            "predicted_water_level": self.predicted_water_level,
            "affected_area_sqkm": self.affected_area_sqkm,
            "confidence": self.confidence,
            "model_version": self.model_version,
            "forecast_time": self.forecast_time.isoformat() if self.forecast_time else None,
            "artifact": self.artifact.to_meta() if self.artifact else None,
        }


class ForecastIntegrationService:
    """
    Integrates existing ONWR flood forecast outputs from GCS.

    Artifact formats are unknown/mixed, so we:
    - discover the newest parseable object under ONWR_FORECAST_RESULTS_PREFIX
    - attempt JSON/GeoJSON/CSV parsing via GCSService helper
    - normalize into a minimal basin-level DTO (probability + optional extras)
    """

    def __init__(self):
        self.settings = get_settings()
        self.gcs = GCSService()

    def _bucket(self) -> str:
        return self.settings.GCS_BUCKET_ONWR

    def _prefix(self) -> str:
        p = (self.settings.ONWR_FORECAST_RESULTS_PREFIX or "").strip()
        if not p:
            p = "flood_forecast_results/"
        return p if p.endswith("/") else f"{p}/"

    def _max_age(self) -> timedelta:
        try:
            hrs = int(self.settings.ONWR_FORECAST_MAX_AGE_HOURS)
        except Exception:
            hrs = 12
        return timedelta(hours=max(1, hrs))

    def resolve_latest_artifact(self) -> ForecastArtifact:
        bucket = self._bucket()
        prefix = self._prefix()

        if not self.gcs.client:
            return ForecastArtifact(bucket=bucket, prefix=prefix, blob=None, updated=None, parsed=None)

        info, parsed = self.gcs.pick_latest_parseable(bucket, prefix)
        updated = _as_utc(info.updated) if info else None
        return ForecastArtifact(bucket=bucket, prefix=prefix, blob=info, updated=updated, parsed=parsed)

    def is_fresh(self, artifact: ForecastArtifact) -> bool:
        if not artifact.updated:
            return False
        return (_utcnow() - artifact.updated) <= self._max_age()

    def _extract_for_basin_from_json(self, basin_id: str, obj: Dict[str, Any]) -> Optional[NormalizedForecast]:
        """
        Heuristics-based normalizer. We do NOT assume a strict schema.

        Supported patterns:
        - { basins: { mekong_north: {...} } }
        - { basins: [ { basin_id: 'mekong_north', flood_probability: 0.3, ... }, ... ] }
        - { mekong_north: {...}, eastern_coast: {...} } (top-level map)
        - { data: {...} } wrapper
        """
        candidate = None

        def _unwrap(o: Dict[str, Any]) -> Dict[str, Any]:
            for k in ("data", "result", "results", "forecast"):
                v = o.get(k)
                if isinstance(v, dict):
                    return v
            return o

        root = _unwrap(obj)

        # 1) basins as dict
        basins_dict = root.get("basins")
        if isinstance(basins_dict, dict) and basin_id in basins_dict and isinstance(basins_dict[basin_id], dict):
            candidate = basins_dict[basin_id]

        # 2) basins as list of objects
        if candidate is None and isinstance(basins_dict, list):
            for item in basins_dict:
                if not isinstance(item, dict):
                    continue
                bid = str(item.get("basin_id") or item.get("basin") or item.get("id") or "").strip()
                if bid == basin_id:
                    candidate = item
                    break

        # 3) top-level map keyed by basin id
        if candidate is None and basin_id in root and isinstance(root[basin_id], dict):
            candidate = root[basin_id]

        if not isinstance(candidate, dict):
            return None

        # Probabilities can appear as 0-1 or 0-100.
        prob = (
            _maybe_float(candidate.get("flood_probability"))
            or _maybe_float(candidate.get("probability"))
            or _maybe_float(candidate.get("flood_prob"))
            or _maybe_float(candidate.get("prob"))
        )
        if prob is None:
            # sometimes nested under 'prediction'
            pred = candidate.get("prediction")
            if isinstance(pred, dict):
                prob = _maybe_float(pred.get("flood_probability")) or _maybe_float(pred.get("probability"))

        if prob is None:
            return None

        if prob > 1.0:
            # assume percent
            prob = prob / 100.0
        prob = max(0.0, min(float(prob), 0.9999))

        wl = (
            _maybe_float(candidate.get("predicted_water_level"))
            or _maybe_float(candidate.get("water_level"))
            or _maybe_float(candidate.get("water_level_m"))
        )
        area = (
            _maybe_float(candidate.get("affected_area_sqkm"))
            or _maybe_float(candidate.get("affected_area"))
            or _maybe_float(candidate.get("area_sqkm"))
        )
        conf = _maybe_float(candidate.get("confidence")) or _maybe_float(candidate.get("conf"))

        mv = str(candidate.get("model_version") or candidate.get("source") or "onwr-forecast").strip()
        if not mv:
            mv = "onwr-forecast"

        ft = None
        for k in ("forecast_time", "timestamp", "generated_at", "created_at", "run_time"):
            v = candidate.get(k) or root.get(k)
            if isinstance(v, str) and v:
                try:
                    s = v.strip().replace("Z", "+00:00")
                    ft = datetime.fromisoformat(s)
                    if ft.tzinfo is None:
                        ft = ft.replace(tzinfo=timezone.utc)
                    else:
                        ft = ft.astimezone(timezone.utc)
                    break
                except Exception:
                    continue

        return NormalizedForecast(
            basin_id=basin_id,
            flood_probability=float(prob),
            predicted_water_level=wl,
            affected_area_sqkm=area,
            confidence=conf,
            model_version=mv,
            forecast_time=ft,
        )

    def _extract_for_basin_from_csv(self, basin_id: str, parsed: Dict[str, Any]) -> Optional[NormalizedForecast]:
        """
        CSV parsing returns {type:'csv', columns:[...], rows:[...]}.
        We heuristically find a row for the basin and a probability column.
        """
        if parsed.get("type") != "csv":
            return None
        rows = parsed.get("rows")
        if not isinstance(rows, list) or not rows:
            return None

        def _norm(s: Any) -> str:
            return str(s or "").strip().lower()

        basin_row = None
        for r in rows:
            if not isinstance(r, dict):
                continue
            bid = r.get("basin_id") or r.get("basin") or r.get("id") or r.get("BASIN_ID") or r.get("basinId")
            if _norm(bid) == _norm(basin_id):
                basin_row = r
                break
        if not basin_row:
            return None

        # Try multiple possible probability column names
        prob = None
        for k in (
            "flood_probability",
            "probability",
            "flood_prob",
            "prob",
            "flood_probability_pct",
            "flood_probability_percent",
        ):
            if k in basin_row:
                prob = _maybe_float(basin_row.get(k))
                if prob is not None:
                    break
        if prob is None:
            return None
        if prob > 1.0:
            prob = prob / 100.0
        prob = max(0.0, min(float(prob), 0.9999))

        wl = _maybe_float(basin_row.get("predicted_water_level")) or _maybe_float(basin_row.get("water_level_m"))
        area = _maybe_float(basin_row.get("affected_area_sqkm")) or _maybe_float(basin_row.get("affected_area"))
        conf = _maybe_float(basin_row.get("confidence"))

        return NormalizedForecast(
            basin_id=basin_id,
            flood_probability=float(prob),
            predicted_water_level=wl,
            affected_area_sqkm=area,
            confidence=conf,
            model_version="onwr-forecast",
        )

    def latest_forecast_for_basin(self, basin_id: str) -> Tuple[Optional[NormalizedForecast], ForecastArtifact]:
        artifact = self.resolve_latest_artifact()
        if not artifact.parsed:
            return None, artifact

        parsed = artifact.parsed
        fc: Optional[NormalizedForecast] = None

        if parsed.get("type") == "csv":
            fc = self._extract_for_basin_from_csv(basin_id, parsed)
        else:
            # JSON/GeoJSON are both JSON objects at this stage
            if isinstance(parsed, dict):
                fc = self._extract_for_basin_from_json(basin_id, parsed)

        if fc:
            # Attach artifact + prefer artifact updated as forecast time when missing
            ft = fc.forecast_time or artifact.updated
            fc = NormalizedForecast(
                basin_id=fc.basin_id,
                flood_probability=fc.flood_probability,
                predicted_water_level=fc.predicted_water_level,
                affected_area_sqkm=fc.affected_area_sqkm,
                confidence=fc.confidence,
                model_version=fc.model_version,
                forecast_time=ft,
                artifact=artifact,
            )
        return fc, artifact


_svc: Optional[ForecastIntegrationService] = None


def get_forecast_integration_service() -> ForecastIntegrationService:
    global _svc
    if _svc is None:
        _svc = ForecastIntegrationService()
    return _svc

