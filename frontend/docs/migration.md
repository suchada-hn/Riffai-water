RIFFAI Platform — End-to-End UX/UI Research Report with Complete Analysis: JupyterLab Files → RIFFAI Platform Integration Plan

## PART 1 — UX/UI Research Summary

### User Journey (Current State)

1. **Land** → Full-screen Mapbox map + left sidebar. Map centers on **Japan** (bug). No onboarding.
2. **Load** → Sidebar auto-fetches `/api/correlated_dataset`. Loading skeleton shows. Sites appear ranked by relevance score (unexplained).
3. **Browse** → Cards show municipality + facility name. No risk preview, no filter, no sort.
4. **Click marker or card** → `viewDetails()` fires → sidebar transitions to detail screen.
5. **Detail view** → Population data, PVout BarChart, nearby stations, nearby areas, RadialAreaChart (power mix), PieChart (GHG emissions). All narrative text references **Japan context**.
6. **Navigate back** → Return to home list. Research/About tabs exist in code but are **commented out**.
7. **Map style** → 4 style buttons. Each triggers full page reload via `localStorage` + `window.location.reload()`.

### UX Problems Found

| #   | Problem                                                                | Severity     |
| --- | ---------------------------------------------------------------------- | ------------ |
| 1   | Map centered on Japan `[138.25, 36.20]` not Thailand                   | **Critical** |
| 2   | All markers use hash-based fake coordinates within Japan bbox          | **Critical** |
| 3   | Research + About nav tabs commented out — users can't reach them       | **High**     |
| 4   | No onboarding or explanation for first-time users                      | **High**     |
| 5   | Relevance ranking shown with no explanation                            | **High**     |
| 6   | No flood risk or water stress data visible anywhere in UI              | **High**     |
| 7   | No watershed/basin context on map                                      | **High**     |
| 8   | SAR pipeline running in JupyterLab but zero UI presence                | **Medium**   |
| 9   | No filter/sort controls on site list                                   | **Medium**   |
| 10  | Map style change reloads entire page — loses selected site state       | **Medium**   |
| 11  | Mapbox token is a third party's hardcoded public token                 | **Medium**   |
| 12  | `socket.io-client` installed but unused (live updates not implemented) | **Low**      |
| 13  | Package name still `jp-energy-dashboard`                               | **Low**      |

### UX Improvements Recommended

1. Fix map center + real coordinates — highest impact, 1-line fix
2. Uncomment Research + About nav tabs — already fully built, just commented out
3. Add welcome banner on first load explaining the platform purpose
4. Add risk badge (High/Medium/Low) to each sidebar card
5. Add `?` tooltip explaining MCDA + ML probability combined ranking
6. Add flood risk overlay layer + watershed basin layer with toggles
7. Add 2026 flood forecast section inside SiteDetails
8. Add SAR status panel as new sidebar screen
9. Update SiteDetails energy narrative to Thai context (EGAT, hydro north, gas central, coal Mae Moh south, solar Isaan northeast)
10. Add filter chips to sidebar: "High Flood Risk", "Off-Grid", "High PVout"

---

## PART 2 — Architecture Map (All Files)

```
project-dashboard/
├── pages/
│   ├── index.tsx               31 lines — root, state: coordinates + selectedArea
│   ├── _app.tsx                app wrapper
│   └── api/
│       ├── correlated_dataset.tsx   151 lines — KEY: reads CSVs, merges, search
│       ├── doe_dataset.tsx
│       ├── correlated_data.json
│       ├── doe_powerstations_dataset.json
│       ├── doe_v1.json
│       └── geojson/            existing GeoJSON API routes
├── components/
│   ├── MapInterface.tsx        256 lines — Mapbox, markers, hidden button triggers
│   ├── Sidebar.tsx             244 lines — screens: home/details/research/about
│   ├── SiteDetails.tsx         444 lines — charts, nearby areas, GHG emissions
│   ├── DetailsScreen.tsx       wrapper for detail panels
│   ├── ResearchTab.tsx         fully built, not accessible from nav
│   ├── AboutTab.tsx            fully built, not accessible from nav
│   ├── Layout.tsx              page shell
│   ├── LoadingSkeleton.tsx     loading state
│   └── Utils.tsx               190 lines — fetchGlobalMapdata, gaPV, gaUE,
│                               guid, Toast, measureCoordDistance, isMobile,
│                               getFillOpacity, satelliteStyle, MovesStyle etc.
├── styles/
│   ├── MapStyleSelector.tsx    74 lines — 4 style buttons, localStorage + reload
│   ├── MarkerLegends.tsx
│   ├── globals.scss
│   ├── animations.scss
│   └── markers.scss
└── package.json                Next.js 12.3.7, React 17, Node≥18<21
                                reaviz, mapbox-gl, axios, fuse.js,
                                socket.io-client (unused), react-chartjs-2 (unused)
```

### Current Data Flow

```
JupyterLab Core_Feature/
  results/th/maps/top_sites_combined.csv   ← ML site rankings (MCDA + probability)
  results/th/model/predictions.csv         ← per-site model output
        ↓
pages/api/correlated_dataset.tsx
  parseCsv() → merge by site_id
  pseudoCoords() → FAKE coords (currently Japan bbox — must fix to Thailand)
  suggestedAreas[] + powerStations[]
        ↓
Sidebar.tsx → fetchData() → axios.get("/api/correlated_dataset")
        ↓
MapInterface.tsx → renderMarkers() → mapboxgl.Marker per site
        ↓
SiteDetails.tsx → BarChart + RadialAreaChart + PieChart (reaviz)
```

### JupyterLab Files NOT Yet Connected

```
z_score_detection notebook    → flood Z-score raster → NOT on map
temp_flood_mas* rasters       → flood masks         → NOT on map
temp_f_2026_03* projections   → 2026 forecast       → NOT in SiteDetails
hybas_as_lev09_* (Asia-wide)  → watershed basins    → NOT on map
s1-autofetch-service/ Flask   → SAR fetch status    → NO UI component
Statistic_SAR.ipynb           → SAR statistics      → NOT in UI
```

**Key note**: `hybas_as_lev09_*` already covers all of Southeast Asia — Thailand basin data is already present. Filter to: Chao Phraya `4120051890`, Mekong Thailand reach `4120034590`, Ping/Wang/Yom/Nan tributaries.

---

## PART 3 — Priority Order

| #   | Task                                               | Files                                      | Size     |
| --- | -------------------------------------------------- | ------------------------------------------ | -------- |
| 1   | Fix map center → Thailand                          | `MapInterface.tsx`                         | 3 lines  |
| 2   | Fix CSV paths `jp` → `th`                          | `correlated_dataset.tsx`                   | 2 lines  |
| 3   | Fix `pseudoCoords()` → Thailand bbox               | `correlated_dataset.tsx`                   | 8 lines  |
| 4   | Add `toCoord()` — use real lat/lng if CSV has them | `correlated_dataset.tsx`                   | 15 lines |
| 5   | Uncomment Research + About nav tabs                | `Sidebar.tsx`                              | 2 lines  |
| 6   | Add flood risk API endpoint                        | `pages/api/flood_risk.tsx`                 | New file |
| 7   | Add basin boundaries API endpoint                  | `pages/api/basins.tsx`                     | New file |
| 8   | Add flood + basin layers to map + toggles          | `MapInterface.tsx`, `MapStyleSelector.tsx` | Medium   |
| 9   | Add 2026 climate forecast API                      | `pages/api/climate_forecast.tsx`           | New file |
| 10  | Add flood forecast section in SiteDetails          | `SiteDetails.tsx`                          | Medium   |
| 11  | Add SAR status API                                 | `pages/api/sar_status.tsx`                 | New file |
| 12  | Add SAR panel component + sidebar screen           | `SARPanel.tsx`, `Sidebar.tsx`              | Medium   |
| 13  | Add risk badge to sidebar cards                    | `Sidebar.tsx`                              | Small    |
| 14  | Update energy narrative to Thai context            | `SiteDetails.tsx`                          | Small    |
| 15  | Add welcome onboarding banner                      | `Layout.tsx`                               | Small    |

---

## PART 4 — Complete Implementation Prompt

Copy the following into Cursor, Claude Code, or GitHub Copilot. It is structured so each task is fully self-contained and will not be truncated mid-logic.

---

### CONTEXT (paste this at top)

```
You are a senior full-stack engineer on the RIFFAI water risk platform for THAILAND.

Stack: Next.js 12.3.7 (pages router), React 17, TypeScript 4.x, Mapbox GL JS v2.3.1 (imperative — NO React wrapper), reaviz v10 charts, axios, Bootstrap CSS classes.

repoRoot = path.resolve(process.cwd(), "../../../")   ← already established pattern in codebase

Architecture rules:
- MapInterface.tsx: single Mapbox instance in useEffect(()=>{},[]).
  All sources/layers MUST be added inside map.on("load",...).
  Toggle visibility with map.setLayoutProperty(layerId,"visibility","visible"|"none").
- New map triggers: add <button id="your-id" className="d-none" /> to JSX,
  bind onclick inside map.on("load",...). Follow existing #mapJump / #load-markers pattern.
- MapStyleSelector.tsx has NO props. Add new layer toggles using
  document.getElementById("your-trigger-id").click() inside onChange handlers.
- All new API routes: if file missing → return empty array or empty FeatureCollection, never 500.
- Do NOT change correlated_dataset.tsx merge/search logic. Only fix coords + paths.
```

---

### TASK 1 — Fix map center + zoom to Thailand

**File: `components/MapInterface.tsx`**

```
FIND:
  center: [138.2529, 36.2048],
  zoom: 7.3,
  minZoom: 6,

REPLACE WITH:
  center: [100.9925, 15.8700],
  zoom: 6.0,
  minZoom: 5,
```

---

### TASK 2 — Fix correlated_dataset.tsx (3 sub-tasks)

**File: `pages/api/correlated_dataset.tsx`**

**2a. Fix CSV paths:**

```
FIND:    "results/jp/maps/top_sites_combined.csv"
REPLACE: "results/th/maps/top_sites_combined.csv"

FIND:    "results/jp/model/predictions.csv"
REPLACE: "results/th/model/predictions.csv"
```

**2b. Fix operator names:**

```
FIND:    operator: "JP Energy MVP"
REPLACE: operator: "EGAT / PEA"

FIND:    operator: "JP Utility"
REPLACE: operator: "EGAT"
```

**2c. Replace pseudoCoords() with Thailand bbox + add toCoord() helper:**

```typescript
// Replace entire pseudoCoords function:
const pseudoCoords = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const lat = 5.5 + (hash % 1500) / 100;
  const lon = 97.5 + ((hash >> 8) % 820) / 100;
  return {
    latitude: Math.min(20.5, Math.max(5.5, lat)),
    longitude: Math.min(105.7, Math.max(97.5, lon)),
  };
};

// Add this helper right after pseudoCoords:
const toCoord = (lat: any, lon: any, fallbackSeed: string) => {
  const la = Number(lat);
  const lo = Number(lon);
  if (Number.isFinite(la) && Number.isFinite(lo) && la !== 0 && lo !== 0) {
    return { latitude: la, longitude: lo };
  }
  return pseudoCoords(fallbackSeed);
};

// In suggestedAreas.map(), replace:
//   const coords = pseudoCoords(siteId || guid());
// With:
const coords = toCoord(row.latitude, row.longitude, siteId || guid());

// In powerStations.map(), replace:
//   const coords = pseudoCoords(`ps_${siteId}`);
// With:
const coords = toCoord(row.latitude, row.longitude, `ps_${siteId}`);
```

---

### TASK 3 — Uncomment Research + About nav tabs

**File: `components/Sidebar.tsx`**

```
FIND and UNCOMMENT this block (remove the {/* and */} wrapping it):
  <div className="nav-links">
    <span className="active">Dataset</span>
    <span onClick={() => { setScreen("research"); sidebarScrollTop(); }}>
      Research
    </span>
    <span onClick={() => { setScreen("about"); sidebarScrollTop(); }}>
      About the project
    </span>
  </div>
```

---

### TASK 4 — Create flood risk API endpoint

**Create new file: `pages/api/flood_risk.tsx`**

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default (req: NextApiRequest, res: NextApiResponse) => {
  const repoRoot = path.resolve(process.cwd(), "../../../");
  const filePath = path.join(repoRoot, "results/th/maps/flood_risk.geojson");
  if (!fs.existsSync(filePath)) {
    return res.json({ type: "FeatureCollection", features: [] });
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  raw.features = (raw.features || []).map((f: any) => {
    const z = Number(f.properties?.z_score ?? 0);
    f.properties.risk_level = z > 2 ? "high" : z > 1 ? "medium" : "low";
    return f;
  });
  return res.json(raw);
};
```

---

### TASK 5 — Create basin boundaries API endpoint

**Create new file: `pages/api/basins.tsx`**

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default (req: NextApiRequest, res: NextApiResponse) => {
  const repoRoot = path.resolve(process.cwd(), "../../../");
  const filePath = path.join(repoRoot, "results/th/maps/basins.geojson");
  if (!fs.existsSync(filePath)) {
    return res.json({ type: "FeatureCollection", features: [] });
  }
  return res.json(JSON.parse(fs.readFileSync(filePath, "utf-8")));
};
```


### TASK 6 — Create climate forecast API endpoint
**Create new file: `pages/api/climate_forecast.tsx`**

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default (req: NextApiRequest, res: NextApiResponse) => {
  const repoRoot = path.resolve(process.cwd(), "../../../");
  const filePath = path.join(repoRoot, "results/th/model/predictions.csv");
  const siteId = String(req.query.site_id ?? "").trim();
  const empty = { site_id: siteId, flood_probability: 0, z_score_2026: 0, risk_level: "low" };

  if (!fs.existsSync(filePath) || !siteId) return res.json(empty);

  const lines = fs.readFileSync(filePath, "utf-8").trim().split(/\r?\n/);
  if (lines.length < 2) return res.json(empty);

  const headers = lines[0].split(",").map((h: string) => h.trim());
  const row = lines.slice(1)
    .map((l: string) => {
      const cells = l.split(",");
      const r: any = {};
      headers.forEach((h: string, i: number) => { r[h] = (cells[i] ?? "").trim(); });
      return r;
    })
    .find((r: any) => String(r.site_id ?? "").trim() === siteId);

  if (!row) return res.json(empty);

  const z = Number(row.z_score_2026 ?? row.z_score ?? 0);
  const prob = Number(row.flood_probability ?? row.ml_probability ?? 0);
  return res.json({
    site_id: siteId,
    flood_probability: Number.isFinite(prob) ? prob : 0,
    z_score_2026: Number.isFinite(z) ? z : 0,
    risk_level: z > 2 ? "high" : z > 1 ? "medium" : "low",
  });
};
```

***

### TASK 7 — Create SAR status API endpoint
**Create new file: `pages/api/sar_status.tsx`**

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default (req: NextApiRequest, res: NextApiResponse) => {
  const repoRoot = path.resolve(process.cwd(), "../../../");
  const logPath = path.join(
    repoRoot,
    "Core_Feature/s1-autofetch-service/logs/fetch_log.json"
  );
  if (!fs.existsSync(logPath)) return res.json([]);
  try {
    const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    return res.json(Array.isArray(data) ? data : []);
  } catch {
    return res.json([]);
  }
};
```

***

### TASK 8 — Add flood + basin layers to MapInterface
**File: `components/MapInterface.tsx`**

**8a. Add two new hidden trigger buttons to the JSX return block**, after the existing three buttons:
```tsx
<button id="toggle-flood-layer" className="d-none" />
<button id="toggle-basin-layer" className="d-none" />
```

**8b. Inside `map.on("load", ...)`, after all existing layers, add:**
```typescript
// --- Flood Risk Layer ---
map.addSource("flood_risk", {
  type: "geojson",
  data: "/api/flood_risk",
});
map.addLayer({
  id: "flood-risk-fill",
  type: "fill",
  source: "flood_risk",
  layout: { visibility: "none" },
  paint: {
    "fill-color": [
      "match", ["get", "risk_level"],
      "high",   "#ef4444",
      "medium", "#f97316",
      "#22c55e"
    ],
    "fill-opacity": 0.45,
  },
});

// --- Basin Boundaries Layer ---
map.addSource("basins", {
  type: "geojson",
  data: "/api/basins",
});
map.addLayer({
  id: "basin-lines",
  type: "line",
  source: "basins",
  layout: { visibility: "none" },
  paint: {
    "line-color": "#3b82f6",
    "line-width": 1.2,
    "line-opacity": 0.65,
  },
});

// --- Bind toggle triggers ---
const floodTrigger: any = document.getElementById("toggle-flood-layer");
const basinTrigger: any = document.getElementById("toggle-basin-layer");

floodTrigger.onclick = () => {
  const vis = map.getLayoutProperty("flood-risk-fill", "visibility");
  map.setLayoutProperty(
    "flood-risk-fill",
    "visibility",
    vis === "visible" ? "none" : "visible"
  );
};
basinTrigger.onclick = () => {
  const vis = map.getLayoutProperty("basin-lines", "visibility");
  map.setLayoutProperty(
    "basin-lines",
    "visibility",
    vis === "visible" ? "none" : "visible"
  );
};
```

***

### TASK 9 — Add layer toggles to MapStyleSelector
**File: `styles/MapStyleSelector.tsx`**

After the closing `</div>` of the existing `map-styles` div, add:
```tsx
<div className="layer-toggles mt-3 mb-2 fade-in">
  <small className="text-muted d-block mb-2">Map Layers</small>

  <div className="d-flex align-items-center mb-2" style={{ gap: "8px" }}>
    <input
      type="checkbox"
      id="flood-toggle"
      onChange={() => {
        const btn: any = document.getElementById("toggle-flood-layer");
        if (btn) btn.click();
      }}
    />
    abel htmlFor="flood-toggle" style={{ marginBottom: 0, cursor: "pointer" }}>
      <i className="la la-water text-primary mr-1" />
      Flood Risk
    </label>
  </div>

  <div className="d-flex align-items-center mb-2" style={{ gap: "8px" }}>
    <input
      type="checkbox"
      id="basin-toggle"
      onChange={() => {
        const btn: any = document.getElementById("toggle-basin-layer");
        if (btn) btn.click();
      }}
    />
    abel htmlFor="basin-toggle" style={{ marginBottom: 0, cursor: "pointer" }}>
      <i className="la la-draw-polygon text-primary mr-1" />
      Watershed Basins
    </label>
  </div>
</div>
```

***

### TASK 10 — Add climate forecast section to SiteDetails
**File: `components/SiteDetails.tsx`**

**10a. Add state + fetch at the top of the component, after existing useState declarations:**
```typescript
const [climateForecast, setClimateForecast] = useState<any>(null);
```

**10b. Inside the existing `useEffect(() => { ... }, [props.data])`, add at the end before the closing `}`:**
```typescript
// Fetch 2026 climate forecast for this site
import axios from "axios"; // already available via existing imports pattern — use fetch instead:
fetch(`/api/climate_forecast?site_id=${encodeURIComponent(data.site_id || "")}`)
  .then((r) => r.json())
  .then((d) => setClimateForecast(d))
  .catch(() => setClimateForecast(null));
```

**10c. In the JSX return, after the `<h2>Need for renewable energy</h2>` section, add:**
```tsx
{climateForecast && (
  <div className="mt-4">
    <h2>
      <i className="la la-cloud-rain text-primary mr-1" />
      2026 Flood Risk Forecast
    </h2>
    <p>
      Based on Z-score anomaly detection from Sentinel-1 SAR data and
      climate projections, this area has the following flood risk profile
      for 2026:
    </p>
    <div className="mb-2">
      <span
        className={`badge badge-${
          climateForecast.risk_level === "high"
            ? "danger"
            : climateForecast.risk_level === "medium"
            ? "warning"
            : "success"
        } mr-2`}
        style={{ fontSize: "0.9rem", padding: "6px 12px" }}
      >
        {climateForecast.risk_level === "high"
          ? "High Flood Risk"
          : climateForecast.risk_level === "medium"
          ? "Moderate Flood Risk"
          : "Low Flood Risk"}
      </span>
    </div>
    <div className="pl-3 mt-3">
      <BarChart
        height={160}
        width={300}
        data={[
          {
            key: "Flood Probability",
            data: Number((climateForecast.flood_probability * 100).toFixed(1)),
          },
          { key: "Historical Avg (%)", data: 15 },
          {
            key: "Z-Score 2026",
            data: Number(climateForecast.z_score_2026.toFixed(2)),
          },
        ]}
      />
    </div>
    <p className="mt-2">
      Z-Score threshold: &gt;2 = High risk, 1–2 = Moderate, &lt;1 = Low.
    </p>
  </div>
)}
```

***

### TASK 11 — Update energy narrative to Thai context
**File: `components/SiteDetails.tsx`**

Find and replace the following text blocks:

```
FIND:    "This chart shows us that the country predominantly relies on
          Non-renewable energy sources like Oil based Power Plants..."

REPLACE: "Thailand's energy mix is dominated by natural gas combined
          cycle plants (central region), with significant hydroelectric
          capacity in the north (Bhumibol and Sirikit dams). Coal
          remains prominent in the south (Mae Moh, Lampang). This
          highlights strong opportunity to expand solar, particularly
          in the Isaan plateau (northeast Thailand) which has the
          highest solar irradiance in the country."

FIND:    "Coal, Oil-based, and Natural Gas Powerplants are the top 3
          most significant sources of Greenhouse gas emissions..."

REPLACE: "Coal and natural gas are the primary GHG contributors in
          Thailand's current grid. EGAT's national renewable energy
          plan (AEDP) targets 30% renewable by 2037, making solar and
          wind integration at sites like this one directly aligned
          with national policy."
```

***

### TASK 12 — Create SAR Panel component
**Create new file: `components/SARPanel.tsx`**

```typescript
import { useEffect, useState } from "react";
import axios from "axios";

const SARPanel = () => {
  const [sarData, setSarData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("/api/sar_status")
      .then((res: any) => {
        setSarData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setSarData([]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="px-3 py-3">
        <p className="text-muted">Loading SAR data...</p>
      </div>
    );
  }

  if (sarData.length === 0) {
    return (
      <div className="px-3 py-3">
        <div className="card border mt-3">
          <div className="px-3 py-3">
            <i className="la la-satellite text-primary la-2x" />
            <p className="mt-2">
              SAR pipeline not yet connected. Once the
              s1-autofetch-service writes to{" "}
              de>logs/fetch_log.json</code>, live basin
              status will appear here.
            </p>
            <small className="text-muted">
              Basins monitored: Chao Phraya, Ping, Wang,
              Yom, Nan, Mekong (Thailand reach)
            </small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <p className="text-muted mb-3">
        <i className="la la-satellite text-primary mr-1" />
        Sentinel-1 SAR auto-fetch status per basin:
      </p>
      {sarData.map((item: any, index: number) => (
        <div className="card-item" key={index}>
          <div className="card-item-content">
            <div className="score-card">
              <span>
                <i
                  className={`la la-${
                    item.status === "fetched"
                      ? "check-circle text-success"
                      : item.status === "error"
                      ? "times-circle text-danger"
                      : "clock text-warning"
                  }`}
                />
              </span>
            </div>
            <div className="card-info">
              <span>{item.basin_en || "Unknown Basin"}</span>
              <div className="tag-row mt-1">
                <small className="badge badge-primary mr-2">
                  {item.image_count ?? 0} images
                </small>
                <small className="badge badge-primary">
                  {item.last_fetch_date ?? "No data yet"}
                </small>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SARPanel;
```

***

### TASK 13 — Add SAR screen to Sidebar
**File: `components/Sidebar.tsx`**

**13a. Add import at top:**
```typescript
import SARPanel from "./SARPanel";
```

**13b. Add SAR screen render — inside the sidebar div, after the `{screen === "about" && ...}` block:**
```tsx
{screen === "sar" && (
  <DetailsScreen setScreen={setScreen} title="SAR Basin Monitor">
    <SARPanel />
  </DetailsScreen>
)}
```

**13c. In the nav-links div (now uncommented from Task 3), add SAR link:**
```tsx
<span
  onClick={() => {
    setScreen("sar");
    sidebarScrollTop();
  }}
>
  <i className="la la-satellite mr-1" />
  SAR Monitor
</span>
```

***

### TASK 14 — Add risk badge to sidebar site cards
**File: `components/Sidebar.tsx`**

Inside the `areas.map()` card render, after the existing badges, add:
```tsx
{data.pvout_average_mean > 800 && (
  <small className="badge badge-success mr-1">High Solar</small>
)}
{data.connection_type === "Off-Grid" && (
  <small className="badge badge-warning mr-1">Off-Grid</small>
)}
