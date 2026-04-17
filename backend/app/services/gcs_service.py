import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from google.cloud import storage

from app.config import get_settings

settings = get_settings()


@dataclass(frozen=True)
class GcsBlobInfo:
    bucket: str
    name: str
    updated: Optional[datetime] = None
    size: Optional[int] = None
    content_type: Optional[str] = None
    generation: Optional[int] = None

    def gcs_path(self) -> str:
        return f"gs://{self.bucket}/{self.name}"


class GCSService:
    """
    Thin GCS adapter used across the backend.

    Design rules:
    - Gracefully degrade when GCS is not configured (local dev).
    - Centralize blob discovery (list/latest) and safe parsing helpers.
    - Keep existing public methods stable for backward compatibility.
    """

    def __init__(self):
        try:
            self.client = storage.Client(project=settings.GCP_PROJECT_ID)
        except Exception as e:
            print(f"⚠️ GCS Client not initialized (local dev mode): {e}")
            self.client = None
    
    def upload_file(self, bucket_name: str, source_path: str, dest_path: str):
        if not self.client:
            print(f"[GCS Mock] Upload: {source_path} -> gs://{bucket_name}/{dest_path}")
            return f"gs://{bucket_name}/{dest_path}"
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(dest_path)
        blob.upload_from_filename(source_path)
        return f"gs://{bucket_name}/{dest_path}"
    
    def upload_bytes(self, bucket_name: str, data: bytes, dest_path: str, content_type: str = "application/octet-stream"):
        if not self.client:
            print(f"[GCS Mock] Upload bytes -> gs://{bucket_name}/{dest_path}")
            return f"gs://{bucket_name}/{dest_path}"
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(dest_path)
        blob.upload_from_string(data, content_type=content_type)
        return f"gs://{bucket_name}/{dest_path}"
    
    def download_json(self, gcs_path: str) -> dict:
        if not self.client:
            print(f"[GCS Mock] Download: {gcs_path}")
            return {}
        bucket_name, blob_path = self._parse_gcs_path(gcs_path)
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        content = blob.download_as_text()
        return json.loads(content)
    
    def get_signed_url(self, gcs_path: str, expiration_hours: int = 1) -> str:
        if not gcs_path or not self.client:
            return None
        bucket_name, blob_path = self._parse_gcs_path(gcs_path)
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        url = blob.generate_signed_url(
            expiration=timedelta(hours=expiration_hours),
            method="GET"
        )
        return url
    
    def list_files(self, bucket_name: str, prefix: str) -> list:
        if not self.client:
            return []
        bucket = self.client.bucket(bucket_name)
        blobs = bucket.list_blobs(prefix=prefix)
        return [blob.name for blob in blobs]

    def list_blobs_info(
        self,
        bucket_name: str,
        prefix: str,
        *,
        suffixes: Optional[Sequence[str]] = None,
        limit: int = 5000,
    ) -> List[GcsBlobInfo]:
        """
        List blobs with metadata (name/updated/size/contentType/generation).
        Returns [] when GCS isn't configured.
        """
        if not self.client:
            return []
        bucket = self.client.bucket(bucket_name)
        infos: List[GcsBlobInfo] = []
        suffixes_norm = tuple(s.lower() for s in suffixes) if suffixes else None

        for i, blob in enumerate(bucket.list_blobs(prefix=prefix)):
            if i >= limit:
                break
            name = getattr(blob, "name", None)
            if not name:
                continue
            if suffixes_norm and not any(name.lower().endswith(s) for s in suffixes_norm):
                continue
            infos.append(
                GcsBlobInfo(
                    bucket=bucket_name,
                    name=name,
                    updated=getattr(blob, "updated", None),
                    size=getattr(blob, "size", None),
                    content_type=getattr(blob, "content_type", None),
                    generation=int(getattr(blob, "generation", 0) or 0) or None,
                )
            )
        return infos

    def get_latest_blob(
        self,
        bucket_name: str,
        prefix: str,
        *,
        suffixes: Optional[Sequence[str]] = None,
    ) -> Optional[GcsBlobInfo]:
        """
        Return newest blob under prefix based on updated timestamp.
        Returns None when no blobs found or GCS isn't configured.
        """
        blobs = self.list_blobs_info(bucket_name, prefix, suffixes=suffixes)
        if not blobs:
            return None

        def _key(b: GcsBlobInfo):
            # If updated is missing, treat as old.
            if not b.updated:
                return datetime.fromtimestamp(0, tz=timezone.utc)
            if b.updated.tzinfo is None:
                return b.updated.replace(tzinfo=timezone.utc)
            return b.updated

        return max(blobs, key=_key)

    def download_text(self, bucket_name: str, blob_name: str) -> str:
        if not self.client:
            raise RuntimeError("GCS client not available")
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        return blob.download_as_text()

    def download_bytes(self, bucket_name: str, blob_name: str) -> bytes:
        if not self.client:
            raise RuntimeError("GCS client not available")
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        return blob.download_as_bytes()

    def blob_exists(self, bucket_name: str, blob_name: str) -> bool:
        if not self.client:
            return False
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        return blob.exists()

    def download_geojson_dict(self, bucket_name: str, blob_name: str) -> dict:
        text = self.download_text(bucket_name, blob_name)
        return json.loads(text)

    def download_json_dict(self, bucket_name: str, blob_name: str) -> Dict[str, Any]:
        text = self.download_text(bucket_name, blob_name)
        return json.loads(text)

    def try_download_parsed(
        self,
        bucket_name: str,
        blob_name: str,
        *,
        max_bytes: int = 25 * 1024 * 1024,
    ) -> Optional[Dict[str, Any]]:
        """
        Best-effort parse helper for unknown artifacts:
        - .json / .geojson: json.loads()
        - .csv: returns {'type': 'csv', 'rows': [...], 'columns': [...]}

        Returns None when unsupported or too large.
        """
        if not self.client:
            return None

        # quick size guard (avoid pulling huge objects through API)
        try:
            bucket = self.client.bucket(bucket_name)
            blob = bucket.blob(blob_name)
            blob.reload()
            if getattr(blob, "size", None) and int(blob.size) > int(max_bytes):
                return None
        except Exception:
            # If metadata fails, fall back to attempting download.
            pass

        lower = blob_name.lower()
        if lower.endswith(".json") or lower.endswith(".geojson"):
            try:
                return self.download_json_dict(bucket_name, blob_name)
            except Exception:
                return None
        if lower.endswith(".csv"):
            try:
                import csv
                import io

                body = self.download_text(bucket_name, blob_name)
                reader = csv.DictReader(io.StringIO(body))
                rows = list(reader)
                return {"type": "csv", "columns": list(reader.fieldnames or []), "rows": rows}
            except Exception:
                return None
        return None

    def pick_latest_parseable(
        self,
        bucket_name: str,
        prefix: str,
        *,
        suffixes: Sequence[str] = (".json", ".geojson", ".csv"),
        max_bytes: int = 25 * 1024 * 1024,
    ) -> Tuple[Optional[GcsBlobInfo], Optional[Dict[str, Any]]]:
        """
        Choose latest blob under prefix (by updated time) among suffixes and return parsed content.
        If parsing fails, will try next-latest candidate.
        """
        blobs = self.list_blobs_info(bucket_name, prefix, suffixes=suffixes)
        if not blobs:
            return None, None

        def _key(b: GcsBlobInfo):
            if not b.updated:
                return datetime.fromtimestamp(0, tz=timezone.utc)
            if b.updated.tzinfo is None:
                return b.updated.replace(tzinfo=timezone.utc)
            return b.updated

        for info in sorted(blobs, key=_key, reverse=True):
            parsed = self.try_download_parsed(bucket_name, info.name, max_bytes=max_bytes)
            if parsed is not None:
                return info, parsed
        return None, None
    
    def _parse_gcs_path(self, gcs_path: str):
        path = gcs_path.replace("gs://", "")
        parts = path.split("/", 1)
        return parts[0], parts[1]
