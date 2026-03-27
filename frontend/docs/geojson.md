# Map & ONWR static / public data

The map page loads GeoJSON and JSON through [`dataClient`](../src/services/dataClient.ts). Behavior depends on environment variables.

## `NEXT_PUBLIC_DATA_MODE`

- `backend` (default): map layers and ONWR SAR dates/geojson use the API (`/api/...`).
- `static`: map and ONWR use files under a configurable base URL (see below), with paths from [`staticDataContract`](../src/constants/staticDataContract.ts) (flat `/onwr/{pipeline}/{date}.geojson`, etc.).

## `NEXT_PUBLIC_STATIC_DATA_BASE_URL`

Base URL for static mode (no trailing slash). Empty means same-origin `/data` (e.g. files in `public/data`).

## ONWR SAR from public HTTPS / GCS layout (no backend)

Browsers cannot use `gs://` URLs. For **direct** reads from a **public** bucket (or CDN) that mirrors the pipeline layout:

[`onwrStatsPublicUrls.ts`](../src/constants/onwrStatsPublicUrls.ts)

### `NEXT_PUBLIC_ONWR_PUBLIC_DATA_BASE`

Set to the HTTPS **bucket root**, for example:

`https://storage.googleapis.com/onwr-data`

When this is set, `dataClient` uses it for **ONWR SAR only** (dates list + sub-basin GeoJSON), with paths shaped like the backend GCS layout:

`Model_Output_v2_Stats/{PipelineBasin}/{year}/GeoJSON/SubBasin_ZScore_{PipelineBasin}_{YYYY}_{MM}_{DD}.geojson`

Example (EastCoast, 2026-03-24):

`https://storage.googleapis.com/onwr-data/Model_Output_v2_Stats/EastCoast/2026/GeoJSON/SubBasin_ZScore_EastCoast_2026_03_24.geojson`

### Dates manifest

Without a backend, you must publish a JSON file listing ISO dates (same format as the API):

`Model_Output_v2_Stats/{PipelineBasin}/dates.json`

```json
{ "dates": ["2026-03-20", "2026-03-24"] }
```

Pipeline folder names match [`APP_TO_ONWR_BASIN`](../src/constants/onwrBasins.ts) values (`EastCoast`, `UpperMekong`, `LowerSouthEast`).

### Precedence for ONWR SAR

1. If `NEXT_PUBLIC_ONWR_PUBLIC_DATA_BASE` is set → public HTTPS paths above.
2. Else if `NEXT_PUBLIC_DATA_MODE=static` → `STATIC_DATA_CONTRACT.onwr` paths under `NEXT_PUBLIC_STATIC_DATA_BASE_URL`.
3. Else → backend API.

### CORS and access

- Objects must be **world-readable** (or served via your CDN with GET allowed).
- For Google Cloud Storage, configure **CORS** on the bucket to allow `GET` from your web app’s origin; otherwise the browser will block `fetch`.

## Map UX

Turning on **ONWR SAR sub-basin (Z-score)** also switches the basemap to **Esri satellite** so the choropleth matches the intended view.
