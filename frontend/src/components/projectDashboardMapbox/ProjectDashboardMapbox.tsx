"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Layers, Map as MapIcon, RefreshCw, Satellite } from "lucide-react";
import { mapAPI, predictAPI } from "@/services/api";
import toast from "react-hot-toast";
import type { GeoJSONFeatureCollection } from "@/types";

type FloodRiskLevel = "safe" | "normal" | "watch" | "warning" | "critical";

type FloodStats = {
  avgWaterLevel: number;
  rainfall24h: number;
  stationCount: number;
  populationAtRisk: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
};

type TileProperties = {
  id: string;
  riskLevel: FloodRiskLevel;
  basin_id: string | null;
  stats: FloodStats;
  provinces: string[];
  center: [number, number]; // [lat, lon]
  aiPrediction?: {
    floodProbability: number; // percent (0-100)
    daysAhead: number;
  };
  lastUpdate?: string;
};

type TileFeature = {
  type: "Feature";
  id: string;
  properties: TileProperties & Record<string, any>;
  geometry: GeoJSON.Feature<GeoJSON.Polygon>["geometry"];
};

type SarStatusItem = {
  basin_en: string;
  status: "fetched" | "pending" | "error";
  image_count: number;
  last_fetch_date: string;
};

function riskColor(risk: string) {
  switch (risk) {
    case "safe":
      return "#22c55e";
    case "normal":
      return "#84cc16";
    case "watch":
      return "#eab308";
    case "warning":
      return "#f97316";
    case "critical":
      return "#ef4444";
    default:
      return "#94a3b8";
  }
}

function riskLabel(risk: string) {
  switch (risk) {
    case "safe":
      return "SAFE";
    case "normal":
      return "NORMAL";
    case "watch":
      return "WATCH";
    case "warning":
      return "WARNING";
    case "critical":
      return "CRITICAL";
    default:
      return String(risk).toUpperCase();
  }
}

export default function ProjectDashboardMapbox({
  basins,
  selectedBasin,
  onBasinChange,
}: {
  basins?: GeoJSONFeatureCollection | null;
  selectedBasin: string | null;
  onBasinChange: (id: string | null) => void;
}) {
  // #region agent log
  const __dbg = (hypothesisId: string, message: string, data: Record<string, any>) => {
    if (typeof window === "undefined") return;
    fetch("http://127.0.0.1:7908/ingest/8ecea870-d1d6-42b5-905e-45e03cf5df70", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f37a02" },
      body: JSON.stringify({
        sessionId: "f37a02",
        runId: "pre-fix",
        hypothesisId,
        location: "frontend/src/components/projectDashboardMapbox/ProjectDashboardMapbox.tsx",
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  };
  // #endregion

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const sourcesAddedRef = useRef(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [mapError, setMapError] = useState<string | null>(null);
  const [basinsData, setBasinsData] = useState<GeoJSONFeatureCollection | null>(basins ?? null);
  const [floodData, setFloodData] = useState<GeoJSONFeatureCollection | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [layers, setLayers] = useState({ floodRisk: true, basins: true });

  const [screen, setScreen] = useState<"dataset" | "details" | "sar">("dataset");
  const [selectedTile, setSelectedTile] = useState<TileProperties | null>(null);
  const [tilesLoading, setTilesLoading] = useState(false);

  const [sarLoading, setSarLoading] = useState(false);
  const [sarStatus, setSarStatus] = useState<SarStatusItem[] | null>(null);

  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecast, setForecast] = useState<any | null>(null);

  const emptyFC: GeoJSONFeatureCollection = useMemo(
    () => ({ type: "FeatureCollection", features: [] }),
    [],
  );

  const basinOptions = useMemo(() => {
    const feats = basinsData?.features ?? [];
    return feats.map((f) => ({
      id: f.properties?.id as string,
      name: (f.properties?.name as string) || f.properties?.id,
    }));
  }, [basinsData]);

  const tileList = useMemo(() => {
    const feats = (floodData?.features ?? []) as unknown as TileFeature[];
    const list = feats.map((f) => f.properties);
    const rank: Record<FloodRiskLevel, number> = {
      critical: 0,
      warning: 1,
      watch: 2,
      normal: 3,
      safe: 4,
    };
    list.sort((a, b) => {
      const ar = rank[a.riskLevel] ?? 10;
      const br = rank[b.riskLevel] ?? 10;
      if (ar !== br) return ar - br;
      return (b.stats?.avgWaterLevel ?? 0) - (a.stats?.avgWaterLevel ?? 0);
    });
    return list;
  }, [floodData]);

  // #region agent log
  useEffect(() => {
    __dbg("H_OVERLAY", "overlay state", {
      tilesLoading,
      mapLoaded,
      overlayVisible: tilesLoading || !mapLoaded,
      floodFeatures: floodData?.features?.length ?? null,
    });
  }, [tilesLoading, mapLoaded, floodData]);
  // #endregion

  // Fetch basins if caller didn't provide it.
  useEffect(() => {
    if (basinsData) return;
    // #region agent log
    __dbg("H_BASINS_FETCH", "basins fetch start", { providedByProps: !!basins });
    // #endregion
    mapAPI
      .basins()
      .then((res) => {
        // #region agent log
        __dbg("H_BASINS_FETCH", "basins fetch ok", { featureCount: res?.data?.features?.length ?? null });
        // #endregion
        setBasinsData(res.data);
      })
      .catch((e) => {
        // #region agent log
        __dbg("H_BASINS_FETCH", "basins fetch error", { message: String(e?.message ?? e ?? "unknown") });
        // #endregion
        toast.error("Failed to load basin boundaries");
      });
  }, [basinsData]);

  // Fetch tiles when basin filter changes.
  useEffect(() => {
    const fetchTiles = async () => {
      try {
        setTilesLoading(true);
        // #region agent log
        __dbg("H_TILES_FETCH", "tiles fetch start", { selectedBasin: selectedBasin ?? null });
        // #endregion
        const res = await mapAPI.floodRisk({
          basin_id: selectedBasin ?? undefined,
        });
        // #region agent log
        __dbg("H_TILES_FETCH", "tiles fetch ok", {
          featureCount: res?.data?.features?.length ?? null,
          type: res?.data?.type ?? null,
        });
        // #endregion
        setFloodData(res.data);
      } catch (e: any) {
        // #region agent log
        __dbg("H_TILES_FETCH", "tiles fetch error", {
          message: String(e?.message ?? e ?? "unknown"),
          status: e?.response?.status ?? null,
          url: e?.config?.url ?? null,
        });
        // #endregion
        toast.error("Failed to load flood risk tiles");
        setFloodData(emptyFC);
      } finally {
        setTilesLoading(false);
        // #region agent log
        __dbg("H_TILES_FETCH", "tiles fetch done", { selectedBasin: selectedBasin ?? null });
        // #endregion
      }
    };
    fetchTiles();
  }, [selectedBasin, emptyFC]);

  // Fetch SAR status only when needed.
  useEffect(() => {
    if (screen !== "sar") return;
    if (sarStatus) return;
    const fetchSar = async () => {
      setSarLoading(true);
      try {
        const res = await mapAPI.sarStatus();
        setSarStatus(res.data);
      } catch {
        toast.error("Failed to load SAR status");
        setSarStatus([]);
      } finally {
        setSarLoading(false);
      }
    };
    fetchSar();
  }, [screen, sarStatus]);

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    if (!token) {
      setMapError("Missing NEXT_PUBLIC_MAPBOX_TOKEN. Set it in your environment to enable Mapbox rendering.");
      // #region agent log
      __dbg("H_TOKEN", "missing NEXT_PUBLIC_MAPBOX_TOKEN", { tokenPresent: false });
      // #endregion
      return;
    }

    try {
      mapboxgl.accessToken = token;
      // #region agent log
      __dbg("H_MAP_INIT", "map init start", { style: "mapbox://styles/mapbox/streets-v12" });
      // #endregion
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [100.9925, 15.87], // [lon, lat]
        zoom: 6,
      });

      map.on("load", () => {
        setMapLoaded(true);
        // #region agent log
        __dbg("H_MAP_LOAD", "map load event", {
          styleLoaded: map.isStyleLoaded(),
          center: map.getCenter().toArray(),
          zoom: map.getZoom(),
        });
        // #endregion
      });

      map.on("error", (evt: any) => {
        // #region agent log
        __dbg("H_MAP_ERROR", "mapbox error event", {
          message: evt?.error?.message ?? null,
          status: evt?.error?.status ?? null,
          url: evt?.error?.url ?? null,
        });
        // #endregion
      });

      map.once("idle", () => {
        // #region agent log
        __dbg("H_MAP_TILES", "map idle (tiles/style state)", {
          loaded: map.loaded(),
          styleLoaded: map.isStyleLoaded(),
          areTilesLoaded: (map as any).areTilesLoaded ? (map as any).areTilesLoaded() : null,
          hasComposite: !!map.getSource("composite"),
        });
        // #endregion
      });

      // Detect WebGL context loss on the actual canvas element.
      // (Can happen due to GPU/driver/browser settings, producing a white map.)
      const canvas = map.getCanvas();
      const onLost = () => {
        // #region agent log
        __dbg("H_WEBGL", "webglcontextlost", {});
        // #endregion
      };
      const onRestored = () => {
        // #region agent log
        __dbg("H_WEBGL", "webglcontextrestored", {});
        // #endregion
      };
      canvas.addEventListener("webglcontextlost", onLost as any, { passive: true } as any);
      canvas.addEventListener("webglcontextrestored", onRestored as any, { passive: true } as any);

      mapRef.current = map;
    } catch {
      setMapError("Failed to initialize Mapbox. Check your token and Mapbox access.");
      // #region agent log
      __dbg("H_MAP_INIT", "map init exception", {});
      // #endregion
    }
  }, [token]);

  const ensureSourcesAndLayers = () => {
    if (!mapRef.current) return;
    if (sourcesAddedRef.current) return;
    if (!mapLoaded) return;

    const map = mapRef.current;
    // #region agent log
    __dbg("H_LAYERS", "ensureSourcesAndLayers enter", {
      basinsFeatures: basinsData?.features?.length ?? 0,
      floodFeatures: floodData?.features?.length ?? 0,
      visibility: layers,
    });
    // #endregion

    try {

    // Basins layer
    map.addSource("basins", {
      type: "geojson",
      data: basinsData ?? emptyFC,
    });
    map.addLayer({
      id: "basins-lines",
      type: "line",
      source: "basins",
      layout: { visibility: layers.basins ? "visible" : "none" },
      paint: {
        "line-color": "#3b82f6",
        "line-width": 1.3,
        "line-opacity": 0.85,
      },
    });

    // Flood risk layer (tile polygons)
    map.addSource("flood_risk", {
      type: "geojson",
      data: floodData ?? emptyFC,
    });
    map.addLayer({
      id: "flood-risk-fill",
      type: "fill",
      source: "flood_risk",
      layout: { visibility: layers.floodRisk ? "visible" : "none" },
      paint: {
        "fill-color": [
          "match",
          ["get", "riskLevel"],
          "safe",
          "#22c55e",
          "normal",
          "#84cc16",
          "watch",
          "#eab308",
          "warning",
          "#f97316",
          "critical",
          "#ef4444",
          "#94a3b8",
        ],
        "fill-opacity": 0.45,
        "fill-outline-color": "#111827",
      },
    });
    map.addLayer({
      id: "flood-risk-outline",
      type: "line",
      source: "flood_risk",
      layout: { visibility: layers.floodRisk ? "visible" : "none" },
      paint: {
        "line-color": "#111827",
        "line-width": 0.8,
        "line-opacity": 0.25,
      },
    });

    // Highlight selected tile
    map.addLayer({
      id: "flood-risk-highlight",
      type: "line",
      source: "flood_risk",
      layout: { visibility: "visible" },
      paint: {
        "line-color": "#000000",
        "line-width": 2.2,
        "line-opacity": 0.9,
      },
      filter: ["==", ["get", "id"], "__none__"],
    });

    map.on("click", "flood-risk-fill", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const p = feature.properties as any;
      const tile: TileProperties = {
        id: String(p.id),
        riskLevel: p.riskLevel,
        basin_id: p.basin_id ?? null,
        stats: p.stats,
        provinces: p.provinces ?? [],
        center: p.center,
        aiPrediction: p.aiPrediction,
        lastUpdate: p.lastUpdate,
      };
      setSelectedTile(tile);
      setScreen("details");

      // Update map highlight + focus
      const mapInst = mapRef.current;
      if (mapInst) {
        mapInst.setFilter("flood-risk-highlight", ["==", ["get", "id"], tile.id]);
        const [lat, lon] = tile.center;
        mapInst.flyTo({ center: [lon, lat], zoom: 9, essential: true });
      }
    });

    map.on("mouseenter", "flood-risk-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "flood-risk-fill", () => {
      map.getCanvas().style.cursor = "";
    });

    sourcesAddedRef.current = true;
    // #region agent log
    __dbg("H_LAYERS", "ensureSourcesAndLayers success", {
      sourcesAdded: true,
      hasBasinsSource: !!map.getSource("basins"),
      hasFloodSource: !!map.getSource("flood_risk"),
    });
    // #endregion
    } catch (e: any) {
      // #region agent log
      __dbg("H_LAYERS", "ensureSourcesAndLayers error", {
        message: String(e?.message ?? e ?? "unknown"),
      });
      // #endregion
    }
  };

  // Create layers when map is ready and data has arrived.
  useEffect(() => {
    ensureSourcesAndLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, basinsData, floodData, layers.basins, layers.floodRisk]);

  // Keep sources updated.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !sourcesAddedRef.current) return;
    const src = map.getSource("basins") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(basinsData ?? emptyFC);
  }, [basinsData, mapLoaded, emptyFC]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !sourcesAddedRef.current) return;
    const src = map.getSource("flood_risk") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(floodData ?? emptyFC);
  }, [floodData, mapLoaded, emptyFC]);

  // Toggle layer visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourcesAddedRef.current) return;
    map.setLayoutProperty(
      "flood-risk-fill",
      "visibility",
      layers.floodRisk ? "visible" : "none",
    );
    map.setLayoutProperty(
      "flood-risk-outline",
      "visibility",
      layers.floodRisk ? "visible" : "none",
    );
    map.setLayoutProperty(
      "basins-lines",
      "visibility",
      layers.basins ? "visible" : "none",
    );
  }, [layers]);

  // Highlight filter when selected tile changes via sidebar.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourcesAddedRef.current) return;
    if (!selectedTile) {
      map.setFilter("flood-risk-highlight", ["==", ["get", "id"], "__none__"]);
      return;
    }
    map.setFilter("flood-risk-highlight", ["==", ["get", "id"], selectedTile.id]);
  }, [selectedTile]);

  // Fetch forecast when a tile is selected.
  useEffect(() => {
    const basinId = selectedTile?.basin_id;
    if (!basinId) {
      setForecast(null);
      return;
    }
    const fetchForecast = async () => {
      setForecastLoading(true);
      try {
        const res = await predictAPI.climateForecast(basinId, 30);
        setForecast(res.data);
      } catch {
        toast.error("Failed to load forecast");
        setForecast(null);
      } finally {
        setForecastLoading(false);
      }
    };
    fetchForecast();
  }, [selectedTile]);

  const onPickTile = (tile: TileProperties) => {
    setSelectedTile(tile);
    setScreen("details");

    const map = mapRef.current;
    if (map) {
      map.setFilter("flood-risk-highlight", ["==", ["get", "id"], tile.id]);
      const [lat, lon] = tile.center;
      map.flyTo({ center: [lon, lat], zoom: 9, essential: true });
    }
  };

  const refreshSar = async () => {
    setSarLoading(true);
    try {
      const res = await mapAPI.sarStatus();
      setSarStatus(res.data);
    } catch {
      toast.error("Failed to refresh SAR status");
    } finally {
      setSarLoading(false);
    }
  };

  const datasetCount = floodData?.features?.length ?? 0;

  return (
    <div className="flex h-full bg-primary-50">
      {/* Sidebar */}
      <div className="w-96 bg-white border-r-2 border-primary-200 p-6 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <MapIcon className="w-5 h-5 text-primary-900" />
          <h2 className="text-xl font-bold text-primary-900 tracking-tight">
            Project Dashboard
          </h2>
        </div>

        {/* Basin select */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">
            Select Basin
          </label>
          <select
            value={selectedBasin ?? ""}
            onChange={(e) => onBasinChange(e.target.value || null)}
            className="input-mono text-sm"
          >
            <option value="">All Basins</option>
            {basinOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Map layers */}
        <div className="mb-5">
          <h3 className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Data Layers
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border border-primary-200 rounded-mono cursor-pointer hover:bg-primary-50">
              <input
                type="checkbox"
                checked={layers.floodRisk}
                onChange={() => setLayers((p) => ({ ...p, floodRisk: !p.floodRisk }))}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-primary-900">Flood Risk</div>
                <div className="text-xs text-primary-500 font-mono">Tile-based risk overlay</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-primary-200 rounded-mono cursor-pointer hover:bg-primary-50">
              <input
                type="checkbox"
                checked={layers.basins}
                onChange={() => setLayers((p) => ({ ...p, basins: !p.basins }))}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-primary-900">Watershed Basins</div>
                <div className="text-xs text-primary-500 font-mono">Boundary context</div>
              </div>
            </label>
          </div>
        </div>

        {/* Screen nav */}
        <div className="mb-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScreen("dataset")}
              className={`flex-1 btn-mono text-sm ${
                screen === "dataset" ? "" : "btn-mono-ghost"
              }`}
            >
              Dataset ({datasetCount})
            </button>
            <button
              type="button"
              onClick={() => setScreen("sar")}
              className={`btn-mono text-sm ${screen === "sar" ? "" : "btn-mono-ghost"}`}
            >
              <Satellite className="inline-block w-4 h-4 -mt-0.5 mr-1" />
              SAR Monitor
            </button>
          </div>
        </div>

        {screen === "dataset" && (
          <>
            <div className="text-xs text-gray-600 font-mono mb-3">
              Click a tile to view stats + forecast.
            </div>
            {tilesLoading ? (
              <div className="p-4 bg-gray-50 border border-primary-200 rounded-mono text-sm text-gray-600">
                Loading flood-risk tiles...
              </div>
            ) : (
              <div className="space-y-2">
                {tileList.slice(0, 30).map((tile) => (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => onPickTile(tile)}
                    className="w-full text-left p-3 rounded-mono border border-primary-200 hover:bg-primary-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 font-mono truncate">Tile {tile.id}</div>
                        <div className="text-sm font-bold text-primary-900 truncate">
                          {(tile.provinces ?? []).slice(0, 2).join(", ")}
                        </div>
                      </div>
                      <div
                        className="px-2.5 py-1 rounded-mono text-xs font-mono font-bold text-white"
                        style={{ backgroundColor: riskColor(tile.riskLevel) }}
                      >
                        {riskLabel(tile.riskLevel)}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div className="font-mono">
                        Water: {tile.stats.avgWaterLevel.toFixed(2)} m
                      </div>
                      <div className="font-mono">
                        Rain: {tile.stats.rainfall24h.toFixed(0)} mm
                      </div>
                    </div>
                  </button>
                ))}
                {tileList.length > 30 && (
                  <div className="text-xs text-gray-500 font-mono p-2">
                    Showing top 30 tiles by risk.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {screen === "details" && (
          <>
            {!selectedTile ? (
              <div className="p-4 bg-gray-50 border border-primary-200 rounded-mono text-sm text-gray-600">
                Select a tile from the dataset list.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setScreen("dataset")}
                    className="btn-mono-ghost px-3 py-2 rounded-mono text-sm"
                  >
                    ← Back
                  </button>
                  <div className="px-3 py-1 rounded-mono text-xs font-mono font-bold text-white" style={{ backgroundColor: riskColor(selectedTile.riskLevel) }}>
                    {riskLabel(selectedTile.riskLevel)}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border border-primary-200 rounded-mono">
                  <div className="text-xs text-gray-500 font-mono">Tile ID</div>
                  <div className="text-lg font-bold text-primary-900 font-mono">#{selectedTile.id}</div>
                  <div className="mt-2 text-sm text-gray-700">
                    {(selectedTile.provinces ?? []).slice(0, 3).join(", ")}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 font-mono">
                    Last update: {selectedTile.lastUpdate ? new Date(selectedTile.lastUpdate).toLocaleString("th-TH") : "-"}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-mono">
                    <div className="text-xs text-gray-600">Water Level</div>
                    <div className="text-2xl font-bold text-blue-700 font-mono">
                      {selectedTile.stats.avgWaterLevel.toFixed(2)} m
                    </div>
                  </div>
                  <div className="p-4 bg-sky-50 border border-sky-200 rounded-mono">
                    <div className="text-xs text-gray-600">Rainfall (24h)</div>
                    <div className="text-2xl font-bold text-sky-700 font-mono">
                      {selectedTile.stats.rainfall24h.toFixed(0)} mm
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-mono col-span-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600">Stations</div>
                      <div className="text-lg font-bold text-gray-800 font-mono">{selectedTile.stats.stationCount}</div>
                    </div>
                  </div>
                </div>

                {/* AI Tile Prediction */}
                {selectedTile.aiPrediction?.floodProbability ? (
                  selectedTile.aiPrediction.floodProbability > 0 && (
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-mono">
                      <div className="text-xs text-gray-600 font-mono">AI Flood Probability</div>
                      <div className="text-4xl font-bold text-purple-700 font-mono mt-1">
                        {selectedTile.aiPrediction.floodProbability.toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        In {selectedTile.aiPrediction.daysAhead || 0} days ahead
                      </div>
                    </div>
                  )
                ) : null}

                {/* Forecast */}
                <div className="p-4 bg-gray-50 border border-primary-200 rounded-mono">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-primary-900">Flood Forecast Summary</h3>
                    <button
                      type="button"
                      className="btn-mono-ghost px-3 py-2 rounded-mono text-xs"
                      onClick={() => {
                        // Re-trigger by clearing and re-fetching through selectedTile change effect.
                        setForecast(null);
                        toast.loading("Refreshing forecast...", { id: "forecast" });
                        predictAPI
                          .climateForecast(selectedTile.basin_id || "", 30)
                          .then((res) => setForecast(res.data))
                          .catch(() => setForecast(null))
                          .finally(() => toast.success("Forecast updated", { id: "forecast" }));
                      }}
                      disabled={!selectedTile.basin_id}
                    >
                      Refresh
                    </button>
                  </div>

                  {forecastLoading ? (
                    <div className="text-sm text-gray-600 mt-2 font-mono">Loading forecast...</div>
                  ) : forecast ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-700">Probability</div>
                        <div className="text-2xl font-bold text-gray-900 font-mono">
                          {(forecast.flood_probability * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-700">Risk</div>
                        <div className="text-sm font-mono font-bold" style={{ color: riskColor(forecast.risk_level) }}>
                          {String(forecast.risk_level).toUpperCase()}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div className="font-mono">
                          Pred. water:{" "}
                          {forecast.predicted_water_level != null
                            ? `${Number(forecast.predicted_water_level).toFixed(2)} m`
                            : "-"}
                        </div>
                        <div className="font-mono">
                          Affected:{" "}
                          {forecast.affected_area_sqkm != null
                            ? `${Number(forecast.affected_area_sqkm).toFixed(0)} km^2`
                            : "-"}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        Target date:{" "}
                        {forecast.target_date ? new Date(forecast.target_date).toLocaleDateString("th-TH") : "-"}
                        {" · "}
                        Confidence:{" "}
                        {forecast.confidence != null ? `${Number(forecast.confidence * 100).toFixed(1)}%` : "-"}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 mt-2 font-mono">
                      No forecast available for this basin yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {screen === "sar" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-primary-900">Sentinel-1 SAR Monitor</h3>
              <button
                type="button"
                onClick={refreshSar}
                className="btn-mono-ghost px-3 py-2 rounded-mono text-xs flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {sarLoading && !sarStatus ? (
              <div className="p-4 bg-gray-50 border border-primary-200 rounded-mono text-sm text-gray-600 font-mono">
                Loading SAR status...
              </div>
            ) : (
              <div className="space-y-2">
                {(sarStatus ?? []).map((item, idx) => {
                  const isFetched = item.status === "fetched";
                  const badgeBg = isFetched ? "#16a34a" : "#6b7280";
                  return (
                    <div
                      key={`${item.basin_en}-${idx}`}
                      className="p-3 rounded-mono border border-primary-200 bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-primary-900 truncate">
                            {item.basin_en}
                          </div>
                          <div className="text-xs text-gray-500 font-mono mt-1">
                            Last fetch: {item.last_fetch_date}
                          </div>
                        </div>
                        <div
                          className="px-2.5 py-1 rounded-mono text-xs font-mono font-bold text-white"
                          style={{ backgroundColor: badgeBg }}
                        >
                          {isFetched ? "FETCHED" : "PENDING"}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 font-mono mt-2">
                        Images: {item.image_count}
                      </div>
                    </div>
                  );
                })}
                {(sarStatus ?? []).length === 0 && (
                  <div className="p-4 bg-gray-50 border border-primary-200 rounded-mono text-sm text-gray-600 font-mono">
                    SAR pipeline has no recorded Sentinel-1 updates yet.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {mapError ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="p-5 bg-white border border-primary-200 rounded-mono shadow-mono max-w-lg text-sm text-gray-700">
              <div className="font-bold text-primary-900 mb-2">Mapbox is not configured</div>
              <div className="font-mono text-xs text-gray-600">
                {mapError}
              </div>
              <div className="mt-3 text-xs text-gray-500 font-mono">
                Fallback: switch back to Leaflet mode.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={containerRef} className="absolute inset-0 rounded-lg shadow-lg" />
            {(tilesLoading || !mapLoaded) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-[50] rounded-lg">
                <div className="text-sm text-gray-700 font-mono">Loading Mapbox layers...</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

