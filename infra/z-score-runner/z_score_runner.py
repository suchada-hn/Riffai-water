#!/usr/bin/env python3
"""
Parallel Z-score + flood mask runner for Sentinel-1 VV GeoTIFFs (ONWR pipeline).

Flood rule (production notebook): z = (vv - mean) / std; flood_mask = 1 where z < threshold (default -3).

Designed for Cloud Run Jobs. Set env vars, or invoke from Cloud Scheduler / Workflows with
per-pass arguments.

Env (single job — typical for one Scheduler execution per new SAR asset):

  BUCKET_NAME        GCS bucket (default: onwr-data)
  VV_BLOB            object path to input VV GeoTIFF
  MEAN_BLOB          object path to mean VV GeoTIFF (same grid as VV)
  STD_BLOB           object path to std VV GeoTIFF
  OUT_Z_BLOB         object path for Z-score GeoTIFF output
  OUT_FLOOD_BLOB     object path for flood mask GeoTIFF output (float32 0/1)
  Z_FLOOD_THRESHOLD  default -3.0

Env (batch — optional):

  MAX_WORKERS        ThreadPoolExecutor workers (default 16)
  JOBS_JSON          JSON array of objects with keys vv, mean, std, out_z, out_flood (bucket-relative paths)

Uses UUID temp files under TMPDIR to reduce collisions across parallel workers.
"""
from __future__ import annotations

import json
import os
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Tuple

import numpy as np
import rasterio
from google.cloud import storage

DEFAULT_BUCKET = "onwr-data"


def _download(storage_client: storage.Client, bucket: str, blob_name: str, suffix: str) -> str:
    fd, path = tempfile.mkstemp(suffix=suffix, prefix=f"onwr-{uuid.uuid4().hex}-")
    os.close(fd)
    storage_client.bucket(bucket).blob(blob_name).download_to_filename(path)
    return path


def _upload(storage_client: storage.Client, bucket: str, blob_name: str, local_path: str) -> None:
    storage_client.bucket(bucket).blob(blob_name).upload_from_filename(local_path)


def run_single(
    storage_client: storage.Client,
    bucket: str,
    vv_blob: str,
    mean_blob: str,
    std_blob: str,
    out_z_blob: str,
    out_flood_blob: str,
    z_threshold: float,
) -> None:
    tmp_vv = _download(storage_client, bucket, vv_blob, ".tif")
    tmp_mean = _download(storage_client, bucket, mean_blob, ".tif")
    tmp_std = _download(storage_client, bucket, std_blob, ".tif")
    tmp_z = tempfile.mktemp(suffix=".tif", prefix=f"z-{uuid.uuid4().hex}-")
    tmp_f = tempfile.mktemp(suffix=".tif", prefix=f"f-{uuid.uuid4().hex}-")
    try:
        with rasterio.open(tmp_mean) as dm, rasterio.open(tmp_std) as ds, rasterio.open(tmp_vv) as dv:
            mean = dm.read(1).astype(np.float32)
            std = np.maximum(ds.read(1).astype(np.float32), 1e-6)
            vv = dv.read(1).astype(np.float32)
            profile = dv.profile.copy()
            z = (vv - mean) / std
            flood = (z < z_threshold).astype(np.float32)

        profile.update(dtype=rasterio.float32, count=1, nodata=None)
        with rasterio.open(tmp_z, "w", **profile) as dz:
            dz.write(z.astype(np.float32), 1)
        with rasterio.open(tmp_f, "w", **profile) as df:
            df.write(flood, 1)

        _upload(storage_client, bucket, out_z_blob, tmp_z)
        _upload(storage_client, bucket, out_flood_blob, tmp_f)
    finally:
        for p in (tmp_vv, tmp_mean, tmp_std, tmp_z, tmp_f):
            try:
                if os.path.isfile(p):
                    os.remove(p)
            except OSError:
                pass


def _job_tuple(d: Dict[str, Any]) -> Tuple[str, str, str, str, str]:
    return (d["vv"], d["mean"], d["std"], d["out_z"], d["out_flood"])


def main() -> int:
    bucket = os.environ.get("BUCKET_NAME", DEFAULT_BUCKET).strip()
    z_thr = float(os.environ.get("Z_FLOOD_THRESHOLD", "-3"))
    client = storage.Client()

    jobs_json = os.environ.get("JOBS_JSON", "").strip()
    if jobs_json:
        jobs: List[Dict[str, Any]] = json.loads(jobs_json)
        max_workers = int(os.environ.get("MAX_WORKERS", "16"))

        def _run(j: Dict[str, Any]) -> str:
            vv, mean, std, oz, of = _job_tuple(j)
            run_single(client, bucket, vv, mean, std, oz, of, z_thr)
            return vv

        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            futs = [ex.submit(_run, j) for j in jobs]
            for fut in as_completed(futs):
                fut.result()
        print(f"Completed {len(jobs)} z-score jobs.")
        return 0

    vv = os.environ.get("VV_BLOB", "").strip()
    mean = os.environ.get("MEAN_BLOB", "").strip()
    std = os.environ.get("STD_BLOB", "").strip()
    oz = os.environ.get("OUT_Z_BLOB", "").strip()
    of = os.environ.get("OUT_FLOOD_BLOB", "").strip()
    if not all((vv, mean, std, oz, of)):
        print(
            "Set VV_BLOB, MEAN_BLOB, STD_BLOB, OUT_Z_BLOB, OUT_FLOOD_BLOB "
            "or pass JOBS_JSON for batch mode. See module docstring."
        )
        return 1
    run_single(client, bucket, vv, mean, std, oz, of, z_thr)
    print("OK:", oz, of)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
