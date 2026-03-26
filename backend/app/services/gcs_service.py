import json
from datetime import timedelta

from google.cloud import storage
from app.config import get_settings

settings = get_settings()


class GCSService:
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

    def download_text(self, bucket_name: str, blob_name: str) -> str:
        if not self.client:
            raise RuntimeError("GCS client not available")
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        return blob.download_as_text()

    def blob_exists(self, bucket_name: str, blob_name: str) -> bool:
        if not self.client:
            return False
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        return blob.exists()

    def download_geojson_dict(self, bucket_name: str, blob_name: str) -> dict:
        text = self.download_text(bucket_name, blob_name)
        return json.loads(text)
    
    def _parse_gcs_path(self, gcs_path: str):
        path = gcs_path.replace("gs://", "")
        parts = path.split("/", 1)
        return parts[0], parts[1]
