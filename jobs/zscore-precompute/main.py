import io
import json
import os
from dataclasses import dataclass
from datetime import date
from typing import Iterable, Optional

import numpy as np
import mercantile
from google.cloud import storage
from PIL import Image
from rio_tiler.io import Reader
from rio_tiler.colormap import cmap


@dataclass(frozen=True)
class JobConfig:
    project_id: str
    bucket: str
    region: str
    d: date
    zoom_min: int
    zoom_max: int
    # clamp for consistent visualization
    z_min: float = -3.0
    z_max: float = 3.0


def _env(name: str, default: Optional[str] = None) -> str:
    v = os.getenv(name, default)
    if v is None or v == "":
        raise RuntimeError(f"Missing required env var: {name}")
    return v


def _parse_date(s: str) -> date:
    return date.fromisoformat(s)


def _gcs_path(bucket: str, key: str) -> str:
    return f"gs://{bucket}/{key}"


def _zscore_input_key(region: str, d: date) -> str:
    yyyy, mm, dd = f"{d.year:04d}", f"{d.month:02d}", f"{d.day:02d}"
    return f"Model_Output/{region}/{yyyy}/Z_Score/Z_Score_VV_{yyyy}_{mm}_{dd}.tif"


def _tiles_prefix(region: str, d: date) -> str:
    yyyy, mm, dd = f"{d.year:04d}", f"{d.month:02d}", f"{d.day:02d}"
    return f"tiles/zscore_vv/{region}/{yyyy}/{mm}/{dd}"


def _summary_key(region: str, d: date) -> str:
    yyyy, mm, dd = f"{d.year:04d}", f"{d.month:02d}", f"{d.day:02d}"
    return f"summary/zscore_vv/{region}/{yyyy}/{mm}/{dd}/tiles.geojson"


def _index_key(region: str, year: int) -> str:
    return f"index/zscore_vv/{region}/{year:04d}/dates.json"


def _to_png(arr: np.ndarray) -> bytes:
    img = Image.fromarray(arr, mode="RGBA")
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


def _render_rgba(z: np.ndarray, zmin: float, zmax: float) -> np.ndarray:
    """
    Render a single-band Z-score tile to RGBA using a diverging palette.
    Transparent for NaN.
    """
    # Clamp and normalize to 0..255
    zc = np.clip(z, zmin, zmax)
    norm = (zc - zmin) / (zmax - zmin + 1e-9)
    idx = (norm * 255).astype(np.uint8)

    # Use a built-in diverging colormap (viridis-like is sequential; use spectral-ish)
    palette = cmap.get("rdbu") or cmap.get("RdBu") or cmap.get("spectral")
    if not palette:
        # Fallback grayscale
        rgba = np.stack([idx, idx, idx, np.full_like(idx, 255)], axis=-1)
    else:
        lut = np.zeros((256, 4), dtype=np.uint8)
        for k, v in palette.items():
            if 0 <= k <= 255:
                lut[k] = np.array(v, dtype=np.uint8)
        rgba = lut[idx]

    # Make nodata transparent
    alpha = np.where(np.isfinite(z), 200, 0).astype(np.uint8)
    rgba[..., 3] = alpha
    return rgba


def _upload_bytes(client: storage.Client, bucket: str, key: str, data: bytes, content_type: str):
    b = client.bucket(bucket)
    blob = b.blob(key)
    blob.upload_from_string(data, content_type=content_type)


def _download_to_local(client: storage.Client, bucket: str, key: str, local_path: str):
    b = client.bucket(bucket)
    blob = b.blob(key)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    blob.download_to_filename(local_path)


def _iter_tiles_for_world(zoom: int) -> Iterable[mercantile.Tile]:
    # Global coverage; callers can restrict by bounds if desired.
    for t in mercantile.tiles(-180, -85.0511, 180, 85.0511, zoom):
        yield t


def main():
    cfg = JobConfig(
        project_id=_env("GCP_PROJECT_ID"),
        bucket=os.getenv("ONWR_DATA_BUCKET", "onwr-data"),
        region=_env("REGION"),
        d=_parse_date(_env("DATE")),
        zoom_min=int(os.getenv("ZOOM_MIN", "6")),
        zoom_max=int(os.getenv("ZOOM_MAX", "12")),
    )

    client = storage.Client(project=cfg.project_id)

    input_key = _zscore_input_key(cfg.region, cfg.d)
    input_uri = _gcs_path(cfg.bucket, input_key)

    # rio-tiler can read from local path reliably; download the tif to /tmp
    local_tif = f"/tmp/zscore_{cfg.region}_{cfg.d.isoformat()}.tif"
    _download_to_local(client, cfg.bucket, input_key, local_tif)

    tiles_written = 0

    with Reader(local_tif) as src:
        for z in range(cfg.zoom_min, cfg.zoom_max + 1):
            # NOTE: This iterates the whole world at zoom; in production restrict bounds to basin bbox.
            for t in mercantile.tiles(*src.bounds, zooms=[z]):
                try:
                    img = src.tile(t.x, t.y, t.z, tilesize=256, resampling_method="bilinear")
                except Exception:
                    continue

                # Expect single band
                band = img.data[0].astype(np.float32)
                mask = img.mask.astype(bool) if img.mask is not None else np.ones_like(band, dtype=bool)
                band = np.where(mask, band, np.nan)

                rgba = _render_rgba(band, cfg.z_min, cfg.z_max)

                # Skip fully transparent tiles
                if rgba[..., 3].max() == 0:
                    continue

                png = _to_png(rgba)
                key = f"{_tiles_prefix(cfg.region, cfg.d)}/{z}/{t.x}/{t.y}.png"
                _upload_bytes(client, cfg.bucket, key, png, "image/png")
                tiles_written += 1

    # Per-tile summary GeoJSON is intentionally left as a scaffold here.
    # Production should compute summaries on the same grid used by the platform heatmap.
    summary = {
        "type": "FeatureCollection",
        "features": [],
        "meta": {
            "region": cfg.region,
            "date": cfg.d.isoformat(),
            "zClamp": [cfg.z_min, cfg.z_max],
            "note": "TODO: populate with per-tile statistics",
        },
    }
    _upload_bytes(
        client,
        cfg.bucket,
        _summary_key(cfg.region, cfg.d),
        json.dumps(summary).encode("utf-8"),
        "application/geo+json",
    )

    # Update dates index (append date if missing)
    idx_key = _index_key(cfg.region, cfg.d.year)
    idx_blob = client.bucket(cfg.bucket).blob(idx_key)
    dates = []
    if idx_blob.exists(client):
        try:
            dates = json.loads(idx_blob.download_as_text()).get("dates", [])
        except Exception:
            dates = []
    if cfg.d.isoformat() not in dates:
        dates.append(cfg.d.isoformat())
        dates = sorted(set(dates))
    index_payload = {"region": cfg.region, "year": cfg.d.year, "dates": dates, "tilesWritten": tiles_written}
    _upload_bytes(client, cfg.bucket, idx_key, json.dumps(index_payload).encode("utf-8"), "application/json")

    print(json.dumps({"status": "ok", "input": input_uri, "tilesWritten": tiles_written}))


if __name__ == "__main__":
    main()

