"""
ONWR SAR stats API tests (local fixtures; no GCS).
Uses TestClient to avoid PostgreSQL from the shared async client fixture.
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.services.onwr_stats_service import clear_onwr_response_caches, get_onwr_stats_service

FIXTURE_ONWR = Path(__file__).resolve().parent.parent / "fixtures" / "onwr"


@pytest.fixture
def onwr_env(monkeypatch):
    monkeypatch.setenv("ONWR_DEV_FIXTURES_DIR", str(FIXTURE_ONWR))
    get_settings.cache_clear()
    clear_onwr_response_caches()
    get_onwr_stats_service.cache_clear()


@pytest.fixture
def client(onwr_env):
    with TestClient(app) as c:
        yield c


def test_onwr_dates_upper_mekong(client):
    r = client.get("/api/basins/UpperMekong/dates")
    assert r.status_code == 200
    data = r.json()
    assert "2026-01-15" in data["dates"]
    assert data["app_basin_id"] == "mekong_north"


def test_onwr_stats_geojson(client):
    r = client.get("/api/basins/uppermekong/2026-01-15/stats")
    assert r.status_code == 200
    fc = r.json()
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 2
    flooded = next(
        f for f in fc["features"] if f["properties"].get("HYBAS_ID") == 6080940001
    )
    assert flooded["properties"]["flood_detected"] is True
    assert flooded["properties"]["mean_z_score"] == -3.6


def test_flood_alerts_latest(client):
    r = client.get("/api/flood-alerts/latest")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 1
    assert any(a["HYBAS_ID"] == 6080940001 for a in body["alerts"])


def test_map_flood_layer_app_basin(client):
    r = client.get("/api/map/flood-layer/mekong_north")
    assert r.status_code == 200
    fc = r.json()
    assert fc["type"] == "FeatureCollection"
    assert fc["properties"].get("source") == "onwr_stats"


def test_unknown_basin(client):
    r = client.get("/api/basins/Nowhere/dates")
    assert r.status_code == 400


def test_map_subbasins_fallback_from_onwr_stats(client):
    """No local subbasins_*.geojson: should serve latest ONWR FeatureCollection."""
    r = client.get("/api/map/subbasins", params={"basin_id": "mekong_north"})
    assert r.status_code == 200
    fc = r.json()
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) >= 1
    assert fc["features"][0]["properties"].get("basin_id") == "mekong_north"
