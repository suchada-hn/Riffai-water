Plan to Integrate Thailand’s 22 River Basins as a Map Base Layer in riffai-water

1. Current map architecture in riffai-water
   The MapViewSimple component in frontend/src/components/map/MapViewSimple.tsx uses React Leaflet to render basemaps (OSM/Esri/ONWR TIFF) plus vector overlays for basins, rivers, dams, national ONWR subbasins, SAR flood layers, and validation points. The basins overlay is driven by the /api/map/basins endpoint, with styling and selection logic based on feature.properties.id matching the backend basin id and a selectedBasin value. The MAP-DATA-LAYERS documentation confirms that the current implementation exposes only 3 main basins (mekong_north, eastern_coast, southern_east), with polygons, provinces, and area in square kilometers.
2. Recommended official 22‑basin boundary dataset
   The Office of National Water Resources (ONWR) publishes an official spatial dataset called “พื้นที่ 22 ลุ่มน้ำ ตามพระราชกฤษฎีกากำหนดลุ่มน้ำ”, which provides the boundaries of Thailand’s 22 main river basins as polygons. The dataset is available as a Shapefile (SHP) via the ONWR Data Catalog, with a resource page at https://opendata.onwr.go.th/dataset/bdfc288e-f91d-42ce-b20c-887ff7a47086/resource/cabd0efd-73af-4652-bc4d-4add382078a5 that exposes a download link. Catalog metadata indicates that the format is spatial (“ข้อมูลภูมิสารสนเทศเชิงพื้นที่”) and the license is currently listed as “License not specified,” so legal review or confirmation of reuse conditions is advisable before production use.

3. Supporting reference resources
   ONWR’s organization page in the data catalog tags this dataset with 22 ลุ่มน้ำ and classifies it under spatial information, confirming it as the authoritative national reference for the 22‑basin scheme. Additional ONWR catalog listings repeat the same title and description (“ขอบเขตพื้นที่ 22 ลุ่มน้ำหลักของประเทศไทย ตามพระราชกฤษฎีกากำหนดลุ่มน้ำ”) and show it was last updated on 11 June 2024. For cross‑checking basin names and counts, the “River systems of Thailand” overview notes that Thailand has 22 river basins and 254 sub‑basins, matching ONWR’s national framing.

4. Data preparation steps (ONWR SHP → basins.geojson)
   Download and inspect ONWR SHP

Use the ONWR resource page to download the zipped Shapefile for “พื้นที่ 22 ลุ่มน้ำ ตามพระราชกฤษฎีกากำหนดลุ่มน้ำ.”

Open the layer in QGIS or a similar GIS tool to inspect the attribute table (basin code, Thai/English names, area, coordinate reference system).

Reproject to WGS84 (EPSG:4326)

React Leaflet expects GeoJSON in geographic coordinates (longitude, latitude), so reproject the layer to EPSG:4326 if ONWR provides it in a national grid or projected CRS.

In QGIS, use “Export → Save Features As…” and set the target CRS to EPSG:4326, or use ogr2ogr -t_srs EPSG:4326 on the command line.

Normalize attributes and ids

Decide on stable basin ids that fit the existing Basin.id pattern and frontend assumptions (e.g., chao_phraya, mekong, ping, etc., or numeric codes like b01_chao_phraya).

In the attribute table, add or map fields to at least: id (stable code), name (Thai or English display name), optionally name_en, name_th, and an area field in square kilometers; these will feed properties in GeoJSON.

Export simplified GeoJSON for web use

Use QGIS “Export as GeoJSON” or tools like mapshaper to simplify geometries so that the full 22‑basin collection is performant in the browser (tens of KB rather than megabytes).

Here’s an updated, streamlined **frontend-only** plan with clear tasks, IDs, and estimates.
You can treat the 22 basins as a **purely frontend static GeoJSON overlay**, leaving all backend APIs exactly as they are. The idea is:

- Keep using `/api/map/basins` only for the existing 3 pilot basins and for station/dam filtering.
- Add a new static **22‑basin GeoJSON** in `frontend/public` and load it directly in the browser.
- Wire that static layer into `MapViewSimple` as the visual “Thailand 22 basins” base layer.

Below is a refactored, **frontend‑only** plan.

---

## 1. Data prep (still offline, no backend changes)

This is unchanged: you still need to preprocess the ONWR Shapefile locally, but the output goes into the frontend, not the backend.

**Task F-1 (#1.3.4-F) – Prepare 22‑basin GeoJSON (4–6h)**

- Download ONWR dataset **“พื้นที่ 22 ลุ่มน้ำ ตามพระราชกฤษฎีกากำหนดลุ่มน้ำ”** (Shapefile) from the ONWR catalog resource. [opendata.onwr.go](https://opendata.onwr.go.th/sv/dataset/dataset_32_01/resource/cabd0efd-73af-4652-bc4d-4add382078a5)
- In QGIS or mapshaper:
  - Reproject to **EPSG:4326** so it’s Leaflet‑friendly (lon/lat).
  - Simplify geometries for web performance.
  - Normalize attributes so each feature has:
    - `id` – stable basin id (e.g. `b01_chao_phraya`, `b02_me_khong`),
    - `name` – display name,
    - optional `area_sqkm`, `name_th`, `name_en`.
- Export as:

  `frontend/public/geojson/thailand_22_basins.geojson`

  (Static asset served by Next.js as `/geojson/thailand_22_basins.geojson`.)

No backend or deployment changes are required for this: you’re just committing a static file in the frontend app.

---

## 2. Frontend-only data loading for 22 basins

Currently `MapContent` loads `basins` from `mapAPI.basins()` (backend `/api/map/basins`) and passes that to `<MapView basins={basins} … />`.  
You will add a **second** basins dataset loaded from the static GeoJSON.

**Task F-2 (#1.3.5-F) – Load static 22‑basin GeoJSON in MapContent (2–3h)**

In `frontend/src/app/map/page.tsx`:

1. Add new state:

```ts
const [thailandBasins, setThailandBasins] =
  useState<GeoJSONFeatureCollection | null>(null);
```

2. Add a `useEffect` to load the static file once on mount:

```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const res = await fetch("/geojson/thailand_22_basins.geojson");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as GeoJSONFeatureCollection;
      if (!cancelled) setThailandBasins(json);
    } catch (err) {
      console.error("Failed to load Thailand 22 basins GeoJSON:", err);
      if (!cancelled) {
        toast.error("โหลดชั้น 22 ลุ่มน้ำประเทศไทย ไม่สำเร็จ");
      }
    }
  })();
  return () => {
    cancelled = true;
  };
}, []);
```

3. Keep `mapAPI.basins()` untouched; you still use it for:
   - Existing dropdown (“Select Basin”) and
   - `selectedBasin`/subbasins/SAR logic that expects three pilot basin ids.

---

## 3. Update MapViewSimple to accept a separate 22‑basin layer

`MapViewSimple` already receives `basins` (currently the 3 pilot polygons) and renders them under `layers.basins`. To avoid breaking station logic, introduce an additional prop for the national 22‑basin layer.

**Task F-3 (#1.3.6-F) – Extend MapViewSimple props (3–4h)**

In `frontend/src/components/map/MapViewSimple.tsx`:

1. Extend the props interface:

```ts
interface MapViewProps {
  basins?: GeoJSONFeatureCollection | null; // existing 3-basin polygons
  thailandBasins?: GeoJSONFeatureCollection | null; // new 22-basin polygons
  // … existing props …
}
```

2. Add a new layer block to render the 22 basins as a **pure visual base layer** (not tied to `selectedBasin`):

```tsx
// Thailand 22-basin base layer (visual only)
{
  layers.basins && thailandBasins && (
    <GeoJSON
      data={thailandBasins}
      style={() => ({
        color: "#1e40af",
        weight: 1,
        fillColor: "#60a5fa",
        fillOpacity: 0.08,
      })}
      onEachFeature={(feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`
        <div class="text-sm min-w-[250px]">
          <div class="font-bold text-lg mb-2 text-primary-900 border-b pb-2">
            ${p.name || p.id || ""}
          </div>
          ${
            p.area_sqkm
              ? `
            <div class="flex justify-between items-center">
              <span class="text-gray-600">พื้นที่</span>
              <span class="font-medium">
                ${Number(p.area_sqkm).toLocaleString()} ตร.กม.
              </span>
            </div>
          `
              : ""
          }
        </div>
      `);
      }}
    />
  );
}
```

3. Optionally keep the existing **3‑basin** layer for `selectedBasin` highlighting:

- Either:
  - Keep the current `{layers.basins && basins && <GeoJSON … />}` block as‑is so it overlays the 3 pilot basins on top of the 22‑basin background, or
  - Remove it if you only want the national 22 basins.
- This is pure frontend rendering logic; no backend changes.

---

## 4. Connect MapContent to the new prop

**Task F-4 (#1.3.7-F) – Wire static basins into MapView (1–2h)**

In `MapContent`’s JSX where `<MapView>` is rendered:

```tsx
<MapView
  basins={basins} // 3 pilot basins from backend
  thailandBasins={thailandBasins} // new 22-basin static layer
  waterLevels={waterLevels}
  rivers={rivers}
  dams={dams}
  selectedBasin={selectedBasin}
  onwrSarGeoJSON={onwrFc}
  onwrSarDate={onwrDate}
  onwrNationalGeoJSON={onwrNationalFiltered}
  v3DailyGeoJSON={v3DailyFc}
  onFoliumFloodLoaded={(count) => setFoliumFloodFeatureCount(count)}
  layers={layers}
/>
```

Nothing else in `MapContent` changes: all existing calls to `mapAPI` and `onwrAPI` remain, so you don’t need to redeploy or modify backend services.

---

## 5. UI/UX adjustments & docs (frontend only)

**Task F-5 (#1.3.8-F) – Clarify layer meaning & update docs (2–3h)**

- In the **Map Drawer**, keep the existing “Basin Boundaries” toggle but update the description to clarify it’s now “Thailand 22 basins (ONWR Royal Decree boundaries, visual only)” rather than just 3 pilot basins.
- Update `MAP-DATA-LAYERS.md`:
  - Note that the basins layer comes from ONWR 22‑basin dataset (link and date).
  - Clarify that backend `mapAPI.basins()` is still 3 basins for model pipelines, while the visual base layer is national 22 basins loaded statically in the frontend. [opendata.onwr.go](https://opendata.onwr.go.th/sv/dataset/dataset_32_01/resource/cabd0efd-73af-4652-bc4d-4add382078a5)
- Quick QA on:
  - Map load time on low‑end devices.
  - Interactions with other overlays (ONWR SAR, tambon flood, dams, rivers) to confirm legibility.

---

## Effort and impact

- **Total new work (frontend‑only):** ~12–18 hours
  - F-1: 4–6h (offline data prep, once)
  - F-2: 2–3h
  - F-3: 3–4h
  - F-4: 1–2h
  - F-5: 2–3h
- **No backend or infra changes**: all modifications are in the Next.js frontend, plus one static GeoJSON added under `frontend/public`.

---

## Actionable next steps

1. Create a new epic or sub‑epic “Frontend 22‑basin base layer (no backend changes)” and add issues:
   - `#1.3.4-F` – Prepare `thailand_22_basins.geojson` for `frontend/public/geojson`.
   - `#1.3.5-F` – Load static 22 basins in `MapContent`.
   - `#1.3.6-F` – Extend `MapViewSimple` with `thailandBasins` prop and rendering.
   - `#1.3.7-F` – Wire prop + light UX tweaks around the “Basin Boundaries” layer.
   - `#1.3.8-F` – QA + docs in `MAP-DATA-LAYERS.md`.
2. Implement and test these changes on a feature branch in `riffai-water`, verifying they work against the **unchanged** backend.
3. Once validated, merge and redeploy **frontend only**; backend stays untouched, avoiding your current deployment issues.

---

## Objective

Render Thailand’s **22 official ONWR basins** as a visual base layer on the `/map` page **without touching the backend**. The backend `/api/map/basins` and existing 3 pilot basins remain as-is for pipelines and station filtering.

---

## Phase 1 – Data preparation (local, one-time)

**Task #1.3.4-F – Prepare 22‑basin GeoJSON (4–6h)**  
Goal: Create a web-optimized `thailand_22_basins.geojson` for the frontend.

- Download ONWR dataset **“พื้นที่ 22 ลุ่มน้ำ ตามพระราชกฤษฎีกากำหนดลุ่มน้ำ”** (SHP) from the ONWR catalog resource (the one with resource id `cabd0efd-73af-...`). [opendata.onwr.go](https://opendata.onwr.go.th/sv/dataset/dataset_32_01/resource/cabd0efd-73af-4652-bc4d-4add382078a5)
- In QGIS/mapshaper:
  - Reproject to **EPSG:4326** (Leaflet expects lon/lat).
  - Simplify geometries for performance.
  - Normalize attributes so each feature has at minimum:
    - `id` – stable basin id (your naming convention).
    - `name` – display name (TH/EN).
    - Optionally `area_sqkm`.
- Export to:  
  `frontend/public/geojson/thailand_22_basins.geojson`  
  (served as `/geojson/thailand_22_basins.geojson` by Next.js).

---

## Phase 2 – Load 22 basins on the client

**Task #1.3.5-F – Load static basins in MapContent (2–3h)**

In `frontend/src/app/map/page.tsx`:

1. Add state:

```ts
const [thailandBasins, setThailandBasins] =
  useState<GeoJSONFeatureCollection | null>(null);
```

2. Add effect to fetch the static GeoJSON once on mount:

```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const res = await fetch("/geojson/thailand_22_basins.geojson");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as GeoJSONFeatureCollection;
      if (!cancelled) setThailandBasins(json);
    } catch (err) {
      console.error("Failed to load Thailand 22 basins GeoJSON:", err);
      if (!cancelled) {
        toast.error("โหลดชั้น 22 ลุ่มน้ำประเทศไทย ไม่สำเร็จ");
      }
    }
  })();
  return () => {
    cancelled = true;
  };
}, []);
```

3. Keep `mapAPI.basins()` unchanged; still used for the 3 pilot basins, `selectedBasin`, subbasins, and SAR logic.

---

## Phase 3 – Extend MapViewSimple for 22-basin base layer

**Task #1.3.6-F – Add thailandBasins prop and render (3–4h)**

In `frontend/src/components/map/MapViewSimple.tsx`:

1. Extend props:

```ts
interface MapViewProps {
  basins?: GeoJSONFeatureCollection | null; // existing 3 basins
  thailandBasins?: GeoJSONFeatureCollection | null; // new 22 basins
  // ...existing props...
}
```

2. Render the 22-basin base layer (visual only):

```tsx
{
  layers.basins && thailandBasins && (
    <GeoJSON
      data={thailandBasins}
      style={() => ({
        color: "#1e40af",
        weight: 1,
        fillColor: "#60a5fa",
        fillOpacity: 0.08,
      })}
      onEachFeature={(feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`
        <div class="text-sm min-w-[250px]">
          <div class="font-bold text-lg mb-2 text-primary-900 border-b pb-2">
            ${p.name || p.id || ""}
          </div>
          ${
            p.area_sqkm
              ? `<div class="flex justify-between items-center">
                   <span class="text-gray-600">พื้นที่</span>
                   <span class="font-medium">
                     ${Number(p.area_sqkm).toLocaleString()} ตร.กม.
                   </span>
                 </div>`
              : ""
          }
        </div>
      `);
      }}
    />
  );
}
```

3. Optionally keep the existing 3‑basin overlay (for `selectedBasin` highlighting and current UX) or remove it if you only want the 22‑basin geometry. This is purely frontend; backend stays unchanged.

---

## Phase 4 – Wire new prop and tweak UI text

**Task #1.3.7-F – Wire `thailandBasins` into MapView + UX text (2–3h)**

In `MapContent` JSX:

```tsx
<MapView
  basins={basins} // 3 pilot basins from backend
  thailandBasins={thailandBasins} // new 22-basin layer
  waterLevels={waterLevels}
  rivers={rivers}
  dams={dams}
  selectedBasin={selectedBasin}
  onwrSarGeoJSON={onwrFc}
  onwrSarDate={onwrDate}
  onwrNationalGeoJSON={onwrNationalFiltered}
  v3DailyGeoJSON={v3DailyFc}
  onFoliumFloodLoaded={(count) => setFoliumFloodFeatureCount(count)}
  layers={layers}
/>
```

Then, in the **Map Drawer** “Data Layers” list (in the same file), update the description for the **Basin Boundaries** row to something like:

```ts
{
  key: "basins" as const,
  label: "Basin Boundaries",
  description: "Thailand 22 basins (ONWR visual base layer)",
}
```

No change to `layers` shape; you’re just making what “Basins” means more accurate.

---

## Phase 5 – QA & documentation (frontend only)

**Task #1.3.8-F – QA + MAP-DATA-LAYERS update (2–3h)**

- Test the map on:
  - Desktop + low-end mobile (check initial load and pan/zoom performance).
  - With major overlays: ONWR SAR, tambon flood, dams, rivers, water levels.
- Update `MAP-DATA-LAYERS.md`:
  - Under “ลุ่มน้ำ (Basins)”, document that:
    - The visual basin layer is now “22 national basins from ONWR dataset ‘พื้นที่ 22 ลุ่มน้ำ…’”. [opendata.onwr.go](https://opendata.onwr.go.th/sv/dataset/dataset_32_01/resource/cabd0efd-73af-4652-bc4d-4add382078a5)
    - Backend `/api/map/basins` still returns the 3 pilot basins for internal analytics and selection logic.

---

## Summary of tasks and estimates

- #1.3.4-F – Prepare `thailand_22_basins.geojson` → 4–6h
- #1.3.5-F – Load static 22 basins in `MapContent` → 2–3h
- #1.3.6-F – Extend `MapViewSimple` with `thailandBasins` → 3–4h
- #1.3.7-F – Wire prop + update layer label → 2–3h
- #1.3.8-F – QA + docs in `MAP-DATA-LAYERS.md` → 2–3h

Total: **13–19 frontend hours**, no backend or deployment changes.
