from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
import google.auth
from google.auth.transport.requests import Request

from app.config import get_settings


RFC3339_Z_RE = re.compile(r"Z$")


def _parse_rfc3339(ts: Optional[str]) -> Optional[datetime]:
    if not ts or not isinstance(ts, str):
        return None
    s = ts.strip()
    if not s:
        return None
    # Python fromisoformat doesn't accept trailing 'Z'
    s = RFC3339_Z_RE.sub("+00:00", s)
    try:
        dt = datetime.fromisoformat(s)
    except Exception:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


@dataclass(frozen=True)
class CloudRunJobStatus:
    job_name: str
    region: str
    project_id: str
    available: bool
    last_success_time: Optional[datetime] = None
    last_attempt_time: Optional[datetime] = None
    last_success_execution: Optional[str] = None
    last_attempt_execution: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_name": self.job_name,
            "region": self.region,
            "project_id": self.project_id,
            "available": self.available,
            "last_success_time": self.last_success_time.isoformat() if self.last_success_time else None,
            "last_attempt_time": self.last_attempt_time.isoformat() if self.last_attempt_time else None,
            "last_success_execution": self.last_success_execution,
            "last_attempt_execution": self.last_attempt_execution,
            "error": self.error,
        }


class CloudRunStatusService:
    """
    Reads Cloud Run Job status via Cloud Run v2 REST API.

    Safe-by-default:
    - Disabled unless CLOUD_RUN_STATUS_ENABLED=true
    - If ADC/auth/network not available, returns available=false and an error string
    - Callers should fall back to GCS object timestamps for freshness
    """

    def __init__(self):
        self.settings = get_settings()

    def enabled(self) -> bool:
        return bool(getattr(self.settings, "CLOUD_RUN_STATUS_ENABLED", False))

    def _project(self) -> str:
        # Prefer CLOUD_RUN_PROJECT_ID; default to GCP_PROJECT_ID
        v = (getattr(self.settings, "CLOUD_RUN_PROJECT_ID", "") or "").strip()
        return v or self.settings.GCP_PROJECT_ID

    def _region(self) -> str:
        v = (getattr(self.settings, "CLOUD_RUN_REGION", "") or "").strip()
        return v or "asia-southeast1"

    def _base(self) -> str:
        return "https://run.googleapis.com/v2"

    def _get_token(self) -> str:
        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        creds.refresh(Request())
        if not creds.token:
            raise RuntimeError("Failed to obtain ADC token")
        return creds.token

    async def _get_json(self, url: str) -> Dict[str, Any]:
        token = self._get_token()
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.json()

    async def get_job_status(self, job_name: str) -> CloudRunJobStatus:
        project_id = self._project()
        region = self._region()

        if not self.enabled():
            return CloudRunJobStatus(
                job_name=job_name,
                region=region,
                project_id=project_id,
                available=False,
                error="Cloud Run status disabled (CLOUD_RUN_STATUS_ENABLED=false)",
            )

        job_url = f"{self._base()}/projects/{project_id}/locations/{region}/jobs/{job_name}"

        try:
            job = await self._get_json(job_url)
        except Exception as e:
            return CloudRunJobStatus(
                job_name=job_name,
                region=region,
                project_id=project_id,
                available=False,
                error=f"Cloud Run job fetch failed: {type(e).__name__}: {str(e)[:200]}",
            )

        # Cloud Run v2 Job resource may contain pointers to latest executions.
        latest_succeeded_exec = None
        latest_created_exec = None
        for k in ("latestSucceededExecution", "latestSucceededExecutionName"):
            v = job.get(k)
            if isinstance(v, str) and v:
                latest_succeeded_exec = v
                break
        for k in ("latestCreatedExecution", "latestCreatedExecutionName"):
            v = job.get(k)
            if isinstance(v, str) and v:
                latest_created_exec = v
                break

        # Some variants embed as object: {"name": "..."}
        if not latest_succeeded_exec and isinstance(job.get("latestSucceededExecution"), dict):
            latest_succeeded_exec = job["latestSucceededExecution"].get("name")
        if not latest_created_exec and isinstance(job.get("latestCreatedExecution"), dict):
            latest_created_exec = job["latestCreatedExecution"].get("name")

        last_success_time = None
        last_attempt_time = None

        async def _fetch_exec_time(exec_name: Optional[str]) -> Optional[datetime]:
            if not exec_name:
                return None
            # exec_name might be full resource name already; if not, build it.
            if exec_name.startswith("projects/"):
                exec_url = f"{self._base()}/{exec_name}"
            else:
                exec_url = f"{self._base()}/projects/{project_id}/locations/{region}/jobs/{job_name}/executions/{exec_name}"
            try:
                ex = await self._get_json(exec_url)
            except Exception:
                return None
            # Prefer completionTime for freshness; fall back to startTime/createTime
            for tkey in ("completionTime", "updateTime", "startTime", "createTime"):
                dt = _parse_rfc3339(ex.get(tkey))
                if dt:
                    return dt
            return None

        last_success_time = await _fetch_exec_time(latest_succeeded_exec)
        last_attempt_time = await _fetch_exec_time(latest_created_exec)

        # If job resource has direct timestamps, use them when exec fetch fails.
        if not last_attempt_time:
            for k in ("updateTime", "createTime"):
                dt = _parse_rfc3339(job.get(k))
                if dt:
                    last_attempt_time = dt
                    break

        return CloudRunJobStatus(
            job_name=job_name,
            region=region,
            project_id=project_id,
            available=True,
            last_success_time=last_success_time,
            last_attempt_time=last_attempt_time,
            last_success_execution=latest_succeeded_exec,
            last_attempt_execution=latest_created_exec,
            raw=None,  # keep payload out of API responses by default
        )


_svc: Optional[CloudRunStatusService] = None


def get_cloud_run_status_service() -> CloudRunStatusService:
    global _svc
    if _svc is None:
        _svc = CloudRunStatusService()
    return _svc

