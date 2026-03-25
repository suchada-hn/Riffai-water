## Z-score VV precompute (Cloud Run Job)

This job turns daily Z-score VV GeoTIFFs into:

- XYZ raster tiles (PNG) for Leaflet overlay
- Per-tile summary GeoJSON for the grid heatmap view
- An optional dates index JSON for timelapse UX

### Inputs (existing)

- `gs://onwr-data/Model_Output/{Region}/2025/Z_Score/Z_Score_VV_{YYYY}_{MM}_{DD}.tif`

### Outputs (new)

- Tiles:
  - `gs://onwr-data/tiles/zscore_vv/{Region}/{YYYY}/{MM}/{DD}/{z}/{x}/{y}.png`
- Per-tile summaries:
  - `gs://onwr-data/summary/zscore_vv/{Region}/{YYYY}/{MM}/{DD}/tiles.geojson`
- Dates index:
  - `gs://onwr-data/index/zscore_vv/{Region}/{YYYY}/dates.json`

### Runtime configuration

Environment variables (suggested):

- `GCP_PROJECT_ID`
- `ONWR_DATA_BUCKET` (default: `onwr-data`)
- `REGION` (one of: `UpperMekong`, `EastCoast`, `LowerSouthEast`)
- `DATE` (`YYYY-MM-DD`)
- `ZOOM_MIN` (default: `6`)
- `ZOOM_MAX` (default: `12`)

### Notes

- Tiles are generated for a fixed Z-score scale clamped to `[-3, +3]` (recommended) so colors remain consistent across days.\n
- For private tiles, the frontend loads them via the backend tile proxy (`/api/map/zscore/vv/tiles/...`).\n
