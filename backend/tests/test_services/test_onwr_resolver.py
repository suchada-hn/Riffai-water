"""Unit tests for ONWR GCS nested GeoJSON path resolution (mocked GCS)."""
from unittest.mock import MagicMock

import pytest

from app.config import get_settings
from app.services.onwr_stats_service import (
    OnwrStatsService,
    _nested_subbasin_zscore_blob,
    clear_onwr_response_caches,
    get_onwr_stats_service,
)


def test_nested_subbasin_zscore_blob_path():
    blob = _nested_subbasin_zscore_blob(
        "Model_Output_v2_Stats/",
        "EastCoast",
        "2026-03-24",
        2026,
    )
    assert blob == (
        "Model_Output_v2_Stats/EastCoast/2026/GeoJSON/"
        "SubBasin_ZScore_EastCoast_2026_03_24.geojson"
    )


@pytest.fixture
def reset_onwr_caches():
    get_settings.cache_clear()
    clear_onwr_response_caches()
    get_onwr_stats_service.cache_clear()
    yield
    get_settings.cache_clear()
    clear_onwr_response_caches()
    get_onwr_stats_service.cache_clear()


def test_try_load_premade_prefers_nested_subbasin_zscore(reset_onwr_caches, monkeypatch):
    monkeypatch.setenv("ONWR_DEV_FIXTURES_DIR", "")
    get_settings.cache_clear()
    clear_onwr_response_caches()
    get_onwr_stats_service.cache_clear()

    svc = OnwrStatsService()
    mock_client = MagicMock()
    svc.gcs.client = mock_client

    nested_blob = (
        "Model_Output_v2_Stats/EastCoast/2026/GeoJSON/"
        "SubBasin_ZScore_EastCoast_2026_03_24.geojson"
    )

    def fake_exists(bucket, path):
        return path == nested_blob

    def fake_download(bucket, path):
        assert path == nested_blob
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"HYBAS_ID": 1, "z_score": -3.5},
                    "geometry": {"type": "Polygon", "coordinates": []},
                }
            ],
        }

    svc.gcs.blob_exists = fake_exists
    svc.gcs.download_geojson_dict = fake_download

    fc = svc.build_feature_collection("EastCoast", "2026-03-24")
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 1
    p = fc["features"][0]["properties"]
    assert p["mean_z_score"] == -3.5
    assert p["flood_detected"] is True
    assert p["pipeline_basin"] == "EastCoast"


def test_list_dates_includes_subbasin_geojson_objects(reset_onwr_caches, monkeypatch):
    monkeypatch.setenv("ONWR_DEV_FIXTURES_DIR", "")
    get_settings.cache_clear()
    clear_onwr_response_caches()
    get_onwr_stats_service.cache_clear()

    svc = OnwrStatsService()
    svc.gcs.client = MagicMock()

    names = [
        "Model_Output_v2_Stats/EastCoast/2026/GeoJSON/"
        "SubBasin_ZScore_EastCoast_2026_03_24.geojson",
        "Model_Output_v2_Stats/EastCoast/2026/GeoJSON/"
        "SubBasin_ZScore_EastCoast_2026_03_25.geojson",
    ]

    svc.gcs.list_files = lambda bucket, prefix: names if "EastCoast" in prefix else []

    dates = svc.list_dates("EastCoast")
    assert dates == ["2026-03-24", "2026-03-25"]
