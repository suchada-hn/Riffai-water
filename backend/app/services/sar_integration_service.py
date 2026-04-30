from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Sequence, Tuple

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


@dataclass(frozen=True)
class SarArtifact:
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


class SarIntegrationService:
    """
    Integrates SAR flood outputs from a dedicated bucket.

    The bucket content structure is not guaranteed, so we:
    - allow configurable prefix (SAR_RESULTS_PREFIX)
    - discover the newest parseable object under that prefix (GeoJSON/JSON/CSV)
    - provide metadata for map overlays (later we can add endpoints that return GeoJSON or signed URLs)
    """

    def __init__(self):
        self.settings = get_settings()
        self.gcs = GCSService()

    def _bucket(self) -> str:
        return self.settings.GCS_BUCKET_SAR

    def _prefix(self) -> str:
        p = (self.settings.SAR_RESULTS_PREFIX or "").strip()
        if not p:
            # default: root
            return ""
        return p if p.endswith("/") else f"{p}/"

    def _max_age(self) -> timedelta:
        try:
            hrs = int(self.settings.SAR_MAX_AGE_HOURS)
        except Exception:
            hrs = 48
        return timedelta(hours=max(1, hrs))

    def resolve_latest_artifact(self) -> SarArtifact:
        bucket = self._bucket()
        prefix = self._prefix()

        if not self.gcs.client:
            return SarArtifact(bucket=bucket, prefix=prefix, blob=None, updated=None, parsed=None)

        # Prefer GeoJSON, then JSON, then CSV for map overlays
        info, parsed = self.gcs.pick_latest_parseable(
            bucket,
            prefix,
            suffixes=(".geojson", ".json", ".csv"),
        )
        updated = _as_utc(info.updated) if info else None
        return SarArtifact(bucket=bucket, prefix=prefix, blob=info, updated=updated, parsed=parsed)

    def is_fresh(self, artifact: SarArtifact) -> bool:
        if not artifact.updated:
            return False
        return (_utcnow() - artifact.updated) <= self._max_age()

    def latest_overlay_geojson(self) -> Tuple[Optional[Dict[str, Any]], SarArtifact]:
        """
        Return GeoJSON dict if the latest artifact is JSON/GeoJSON and appears FeatureCollection-like.
        For large artifacts, callers should prefer signed URL endpoints (future).
        """
        artifact = self.resolve_latest_artifact()
        if not artifact.parsed:
            return None, artifact
        obj = artifact.parsed
        if isinstance(obj, dict) and obj.get("type") == "FeatureCollection" and isinstance(obj.get("features"), list):
            return obj, artifact
        # If parsed is CSV, no overlay available
        return None, artifact


_svc: Optional[SarIntegrationService] = None


def get_sar_integration_service() -> SarIntegrationService:
    global _svc
    if _svc is None:
        _svc = SarIntegrationService()
    return _svc

