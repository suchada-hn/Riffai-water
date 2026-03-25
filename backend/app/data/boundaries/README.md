## Boundary data (basins / sub-basins)

This folder is intentionally kept out of version control for large boundary datasets.

### Expected files

- `basins.geojson` (FeatureCollection)
  - Each feature must include `properties.id` matching backend basin ids (e.g. `mekong_north`)
- `subbasins_<basin_id>.geojson` (FeatureCollection)
  - Each feature must include:
    - `properties.basin_id` (e.g. `mekong_north`)
    - `properties.subbasin_id` (stable unique id)
    - `properties.name` (optional)

### Download from GCS (run locally where you have gcloud/gsutil)

From repo root:

```bash
./scripts/download-boundaries.sh
```

