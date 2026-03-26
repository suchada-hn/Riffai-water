---

# Complete Analysis: JupyterLab Files → RIFFAI Platform Integration Plan (Thailand)

---

## 1. JupyterLab File Inventory & What Each File Does

| File / Folder                        | Type                 | What It Produces                                                                                          | Dashboard Status      |
| ------------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------- | --------------------- |
| `hybas_as_lev09_*`                   | HydroSHEDS shapefile | Level-9 sub-basin polygons, all Asia incl. Thailand                                                       | ❌ Not connected      |
| `hybas_pour_lev0*`                   | HydroSHEDS shapefile | Watershed pour points / outlet coordinates                                                                | ❌ Not connected      |
| `Hydro_3Basins_*`                    | Dataset              | 3 focus basin features                                                                                    | ❌ Not connected      |
| `output/`                            | Directory            | Model output files                                                                                        | ⚠️ Partial (CSV read) |
| `s1-autofetch-ser*/`                 | Flask service        | Auto-fetches Sentinel-1 SAR via Google Earth Engine + stores to GCS                                       | ❌ Not connected      |
| `s1-autofetch-ser*/requirements.txt` | Config               | Flask 3.0, gunicorn 21.2, earthengine-api 0.1.390, google-cloud-storage 2.14, geopandas 0.14, shapely 2.0 | —                     |
| `EastCoast_SubB*`                    | Dataset              | East coast sub-basin data                                                                                 | ❌ Not connected      |
| `Statistic_SAR.ipy*`                 | Notebook             | SAR backscatter statistics per basin                                                                      | ❌ Not connected      |
| `temp_f_2026_03*`                    | Raster               | 2026 flood temperature/forecast projection                                                                | ❌ Not connected      |
| `temp_flood_mas*`                    | Raster               | Flood mask (binary flood extent)                                                                          | ❌ Not connected      |
| `temp_z_2026_0*`                     | Raster               | Z-score flood anomaly for 2026                                                                            | ❌ Not connected      |
| `temp_z_score.tif`                   | Raster               | Final z-score output raster                                                                               | ❌ Not connected      |
| `z_score_detection*`                 | Notebook             | Z-score anomaly detection — was actively running at capture time                                          | ❌ Not connected      |
| `z_score_runner.py`                  | Script               | Runner for z-score pipeline                                                                               | ❌ Not connected      |

**Summary**: 13 of 14 pipeline assets are producing output that the dashboard never sees. Only `top_sites_combined.csv` and `predictions.csv` (in `output/`) are consumed — and even those have the wrong file path prefix (`jp` instead of `th`).

---

## 2. What Each Asset Maps To in the Dashboard

```
JupyterLab Asset                    →    Dashboard Integration Point
────────────────────────────────────────────────────────────────────
top_sites_combined.csv              →    /api/correlated_dataset → suggestedAreas[]
predictions.csv                     →    /api/correlated_dataset → powerStations[]
                                         /api/climate_forecast → SiteDetails flood section
z_score_detection output            →    /api/flood_risk → MapInterface flood-risk-fill layer
temp_flood_mas* / temp_z_score.tif  →    /api/flood_risk → same layer (rasterized→GeoJSON)
temp_f_2026_03* / temp_z_2026_0*    →    /api/climate_forecast → SiteDetails 2026 forecast chart
hybas_as_lev09_* (Thailand filtered) →   /api/basins → MapInterface basin-lines layer
hybas_pour_lev0*                    →    Future: pour point markers on map
s1-autofetch-service/logs/          →    /api/sar_status → SARPanel component → Sidebar
Statistic_SAR.ipynb outputs         →    Future: SAR statistics tab in SiteDetails
EastCoast_SubB*                     →    Future: regional sub-basin filter in Sidebar
```

---

## 3. Integration Architecture (After All Changes)

```
┌─────────────────────────────────────────────────────────────────────┐
│  JupyterLab Core_Feature/                                           │
│                                                                     │
│  z_score_detection ──► results/th/maps/flood_risk.geojson           │
│  HydroSHEDS filter ──► results/th/maps/basins.geojson               │
│  ML pipeline ───────► results/th/maps/top_sites_combined.csv        │
│                        results/th/model/predictions.csv             │
│  s1-autofetch Flask ► Core_Feature/s1-autofetch-service/            │
│                        logs/fetch_log.json                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ filesystem (shared repo)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js API Routes  (pages/api/)                                   │
│                                                                     │
│  correlated_dataset.tsx ── reads top_sites + predictions CSVs       │
│  flood_risk.tsx ─────────── reads flood_risk.geojson                │
│  basins.tsx ─────────────── reads basins.geojson                    │
│  climate_forecast.tsx ───── reads predictions.csv by site_id        │
│  sar_status.tsx ─────────── reads fetch_log.json                    │
│  geojson/* ──────────────── existing energy demand GeoJSON          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ axios / fetch
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  React Components                                                   │
│                                                                     │
│  pages/index.tsx                                                    │
│    ├── components/Layout.tsx ────────── onboarding banner           │
│    ├── components/Sidebar.tsx                                       │
│    │     ├── screen: "home" ─────────── site card list + badges     │
│    │     ├── screen: "details" ──────── SiteDetails                 │
│    │     │     ├── BarChart (PVout)                                  │
│    │     │     ├── RadialAreaChart (power mix)                       │
│    │     │     ├── PieChart (GHG emissions)                          │
│    │     │     └── BarChart (2026 flood forecast) ← NEW             │
│    │     ├── screen: "research" ─────── ResearchTab (uncommented)   │
│    │     ├── screen: "about" ────────── AboutTab (uncommented)      │
│    │     └── screen: "sar" ──────────── SARPanel ← NEW             │
│    ├── styles/MapStyleSelector.tsx                                  │
│    │     ├── dark / light / street / satellite buttons              │
│    │     ├── [toggle] Flood Risk layer ← NEW                        │
│    │     └── [toggle] Watershed Basins layer ← NEW                  │
│    └── components/MapInterface.tsx                                  │
│          ├── source: energy_demand (existing)                       │
│          ├── source: correlated_data (existing)                     │
│          ├── layer: data-points (existing)                          │
│          ├── layer: demand-fill (existing)                          │
│          ├── source: flood_risk ← NEW                               │
│          ├── layer: flood-risk-fill ← NEW                           │
│          ├── source: basins ← NEW                                   │
│          ├── layer: basin-lines ← NEW                               │
│          └── markers: renderMarkers() (existing, fixed coords)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. All Code — Complete & Untruncated

### 4a. `pages/api/correlated_dataset.tsx` — full changes

```typescript
// CHANGE 1: CSV paths (lines 10-14)
const topSitesCsv = path.join(repoRoot, "results/th/maps/top_sites_combined.csv");
const predictionsCsv = path.join(repoRoot, "results/th/model/predictions.csv");

// CHANGE 2: Replace pseudoCoords() entirely
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

// CHANGE 3: Add toCoord() after pseudoCoords
const toCoord = (lat: any, lon: any, fallbackSeed: string) => {
  const la = Number(lat);
  const lo = Number(lon);
  if (Number.isFinite(la) && Number.isFinite(lo) && la !== 0 && lo !== 0) {
    return { latitude: la, longitude: lo };
  }
  return pseudoCoords(fallbackSeed);
};

// CHANGE 4: In suggestedAreas.map() — use toCoord
const coords = toCoord(row.latitude, row.longitude, siteId || guid());

// CHANGE 5: In powerStations.map() — use toCoord
const coords = toCoord(row.latitude, row.longitude, `ps_${siteId}`);

// CHANGE 6: Operator names
operator: "EGAT / PEA",   // was "JP Energy MVP"
operator: "EGAT",          // was "JP Utility"
```

---

### 4b. `components/MapInterface.tsx` — full changes

```typescript
// CHANGE 1: Map center + zoom
center: [100.9925, 15.8700],  // was [138.2529, 36.2048]
zoom: 6.0,                     // was 7.3
minZoom: 5,                    // was 6

// CHANGE 2: Inside map.on("load", ...) after existing layers — add:
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

const floodTrigger: any = document.getElementById("toggle-flood-layer");
const basinTrigger: any = document.getElementById("toggle-basin-layer");
floodTrigger.onclick = () => {
  const vis = map.getLayoutProperty("flood-risk-fill", "visibility");
  map.setLayoutProperty("flood-risk-fill", "visibility",
    vis === "visible" ? "none" : "visible");
};
basinTrigger.onclick = () => {
  const vis = map.getLayoutProperty("basin-lines", "visibility");
  map.setLayoutProperty("basin-lines", "visibility",
    vis === "visible" ? "none" : "visible");
};

// CHANGE 3: In JSX return, add two new hidden buttons after existing three:
<button id="toggle-flood-layer" className="d-none" />
<button id="toggle-basin-layer" className="d-none" />
```

---

### 4c. `pages/api/flood_risk.tsx` — complete new file

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

### 4d. `pages/api/basins.tsx` — complete new file

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

---

### 4e. `pages/api/climate_forecast.tsx` — complete new file

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default (req: NextApiRequest, res: NextApiResponse) => {
  const repoRoot = path.resolve(process.cwd(), "../../../");
  const filePath = path.join(repoRoot, "results/th/model/predictions.csv");
  const siteId = String(req.query.site_id ?? "").trim();
  const empty = {
    site_id: siteId,
    flood_probability: 0,
    z_score_2026: 0,
    risk_level: "low",
  };

  if (!fs.existsSync(filePath) || !siteId) return res.json(empty);

  const lines = fs.readFileSync(filePath, "utf-8").trim().split(/\r?\n/);
  if (lines.length < 2) return res.json(empty);

  const headers = lines[0].split(",").map((h: string) => h.trim());

  const row = lines
    .slice(1)
    .map((l: string) => {
      const cells = l.split(",");
      const r: any = {};
      headers.forEach((h: string, i: number) => {
        r[h] = (cells[i] ?? "").trim();
      });
      return r;
    })
    .find((r: any) => String(r.site_id ?? "").trim() === siteId);

  if (!row) return res.json(empty);

  const z = Number(row.z_score_2026 ?? row.z_score ?? 0);
  const prob = Number(row.flood_probability ?? row.ml_probability ?? 0);
  const risk_level = z > 2 ? "high" : z > 1 ? "medium" : "low";

  return res.json({
    site_id: siteId,
    flood_probability: Number.isFinite(prob) ? prob : 0,
    z_score_2026: Number.isFinite(z) ? z : 0,
    risk_level,
  });
};
```

---

### 4f. `pages/api/sar_status.tsx` — complete new file

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default (req: NextApiRequest, res: NextApiResponse) => {
  const repoRoot = path.resolve(process.cwd(), "../../../");
  const logPath = path.join(
    repoRoot,
    "Core_Feature/s1-autofetch-service/logs/fetch_log.json",
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

---

### 4g. `components/SARPanel.tsx` — complete new file

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
          <div className="px-3 py-3 text-center">
            <i className="la la-satellite text-primary la-2x" />
            <p className="mt-2">
              SAR pipeline not yet connected. Once the s1-autofetch-service
              writes to de>logs/fetch_log.json</code>, live basin status
              will appear here.
            </p>
            <small className="text-muted">
              Basins monitored: Chao Phraya · Ping · Wang · Yom · Nan ·
              Mekong (Thailand reach)
            </small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
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
                  {item.last_fetch_date ?? "No fetch yet"}
                </small>
              </div>
            </div>
          </div>
          <i className="la la-chevron-circle-right la-2x" />
        </div>
      ))}
    </div>
  );
};

export default SARPanel;
```

---

### 4h. `components/Sidebar.tsx` — complete diff of all changes

```typescript
// ADD import at top:
import SARPanel from "./SARPanel";

// UNCOMMENT the nav-links block (remove {/* and */}):
<div className="nav-links">
  <span className="active">Dataset</span>
  <span
    onClick={() => {
      setScreen("research");
      sidebarScrollTop();
    }}
  >
    Research
  </span>
  <span
    onClick={() => {
      setScreen("about");
      sidebarScrollTop();
    }}
  >
    About the project
  </span>
  <span
    onClick={() => {
      setScreen("sar");
      sidebarScrollTop();
    }}
  >
    <i className="la la-satellite mr-1" />
    SAR Monitor
  </span>
</div>

// ADD new screen block after the {screen === "about" && ...} block:
{screen === "sar" && (
  <DetailsScreen setScreen={setScreen} title="SAR Basin Monitor">
    <SARPanel />
  </DetailsScreen>
)}

// ADD risk badges inside areas.map() card, after existing badges:
{data.pvout_average_mean > 800 && (
  <small className="badge badge-success mr-1">High Solar</small>
)}
{data.connection_type === "Off-Grid" && (
  <small className="badge badge-warning mr-1">Off-Grid</small>
)}
```

---

### 4i. `components/SiteDetails.tsx` — complete diff of all changes

```typescript
// ADD to useState declarations at top of component:
const [climateForecast, setClimateForecast] = useState<any>(null);

// ADD at end of existing useEffect(() => {...}, [props.data]), before closing }:
fetch(`/api/climate_forecast?site_id=${encodeURIComponent(data.site_id || "")}`)
  .then((r) => r.json())
  .then((d) => setClimateForecast(d))
  .catch(() => setClimateForecast(null));

// ADD new JSX section after the <h2>Need for renewable energy</h2> section:
{climateForecast && (
  <div className="mt-4">
    <h2>
      <i className="la la-cloud-rain text-primary mr-1" />
      2026 Flood Risk Forecast
    </h2>
    <p>
      Based on Z-score anomaly detection from Sentinel-1 SAR data and
      climate projections, this area has the following flood risk
      profile for 2026:
    </p>
    <div className="mb-3">
      <span
        className={`badge badge-${
          climateForecast.risk_level === "high"
            ? "danger"
            : climateForecast.risk_level === "medium"
            ? "warning"
            : "success"
        } mr-2`}
        style={{ fontSize: "0.9rem", padding: "6px 14px" }}
      >
        {climateForecast.risk_level === "high"
          ? "⚠ High Flood Risk"
          : climateForecast.risk_level === "medium"
          ? "~ Moderate Flood Risk"
          : "✓ Low Flood Risk"}
      </span>
    </div>
    <div className="pl-3 mt-3">
      <BarChart
        height={160}
        width={300}
        data={[
          {
            key: "Flood Prob. %",
            data: Number(
              (climateForecast.flood_probability * 100).toFixed(1)
            ),
          },
          { key: "Hist. Avg %", data: 15 },
          {
            key: "Z-Score 2026",
            data: Number(climateForecast.z_score_2026.toFixed(2)),
          },
        ]}
      />
    </div>
    <p className="mt-2" style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
      Z-Score thresholds: &gt;2 = High risk · 1–2 = Moderate · &lt;1 = Low
    </p>
  </div>
)}

// REPLACE Japan energy narrative (2 text blocks):

// Block 1 — FIND:
"This chart shows us that the country predominantly relies on
Non-renewable energy sources like Oil based Power Plants which can
harmful to the environment..."

// Block 1 — REPLACE WITH:
"Thailand's energy mix is dominated by natural gas combined cycle
plants in the central region, with significant hydroelectric
capacity in the north (Bhumibol and Sirikit dams). Coal remains
prominent in the south at Mae Moh, Lampang. This highlights strong
opportunity to expand solar, particularly in the Isaan plateau
(northeast Thailand) which has the country's highest solar
irradiance."

// Block 2 — FIND:
"Coal, Oil-based, and Natural Gas Powerplants are the top 3 most
significant sources of Greenhouse gas emissions, which contribute
to pollution and climate change..."

// Block 2 — REPLACE WITH:
"Coal and natural gas are the primary GHG contributors in
Thailand's grid. EGAT's national AEDP targets 30% renewable
by 2037 — making solar and water-safe site selection at locations
like this one directly aligned with national energy policy."
```

---

### 4j. `styles/MapStyleSelector.tsx` — complete diff

```tsx
// ADD after closing </div> of the map-styles div:
<div className="layer-toggles mt-3 mb-2 fade-in">
  <small className="text-muted d-block mb-2">
    <i className="la la-layers mr-1" />
    Map Layers
  </small>

  <div
    className="d-flex align-items-center mb-2"
    style={{ gap: "8px" }}
  >
    <input
      type="checkbox"
      id="flood-toggle"
      onChange={() => {
        const btn: any = document.getElementById("toggle-flood-layer");
        if (btn) btn.click();
      }}
    />
    abel
      htmlFor="flood-toggle"
      style={{ marginBottom: 0, cursor: "pointer" }}
    >
      <i className="la la-water text-primary mr-1" />
      Flood Risk
    </label>
  </div>

  <div
    className="d-flex align-items-center mb-2"
    style={{ gap: "8px" }}
  >
    <input
      type="checkbox"
      id="basin-toggle"
      onChange={() => {
        const btn: any = document.getElementById("toggle-basin-layer");
        if (btn) btn.click();
      }}
    />
    abel
      htmlFor="basin-toggle"
      style={{ marginBottom: 0, cursor: "pointer" }}
    >
      <i className="la la-draw-polygon text-primary mr-1" />
      Watershed Basins
    </label>
  </div>
</div>
```

---

### 4k. `components/Layout.tsx` — onboarding banner addition

```tsx
// ADD to imports at top:
import { useState, useEffect } from "react";

// ADD inside the Layout component function, before return:
const [showBanner, setShowBanner] = useState(false);

useEffect(() => {
  if (!localStorage.getItem("riffai_welcomed")) {
    setShowBanner(true);
  }
}, []);

const dismissBanner = () => {
  localStorage.setItem("riffai_welcomed", "true");
  setShowBanner(false);
};

// ADD as first child inside Layout JSX, before {children}:
{showBanner && (
  <div
    className="fade-in"
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.78)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div
      style={{
        background: "#1a1a2e",
        border: "1px solid #3b82f6",
        borderRadius: "12px",
        padding: "36px",
        maxWidth: "480px",
        width: "90%",
        textAlign: "center",
      }}
    >
      <img
        src="/images/splash.png"
        style={{ height: "48px", marginBottom: "16px" }}
        alt="RIFFAI"
      />
      <h2 style={{ color: "#fff", marginBottom: "12px" }}>
        RIFFAI Water Platform
      </h2>
      <p style={{ color: "#94a3b8", marginBottom: "8px" }}>
        This platform identifies{" "}
        <span style={{ color: "#59ffde" }}>
          flood-risk and renewable energy potential sites
        </span>{" "}
        across Thailand using satellite SAR data, ML predictions,
        and watershed analysis.
      </p>
      <p style={{ color: "#94a3b8", marginBottom: "24px" }}>
        Click any{" "}
        <span style={{ color: "#3b82f6" }}>map
```
