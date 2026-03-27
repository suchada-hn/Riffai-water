"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Layers, Loader2 } from "lucide-react";
import Navbar from "@/components/common/Navbar";
import { dataClient, isStaticDataMode } from "@/services/dataClient";
import { GeoJSONFeatureCollection } from "@/types";
import toast from "react-hot-toast";
import TambonFloodLayer from "@/components/map/TambonFloodLayer";
import { useRouter } from "next/navigation";
import { APP_TO_ONWR_BASIN } from "@/constants/onwrBasins";
import { useFloodLayer } from "@/hooks/useFloodLayer";
import FloodLayerPanel from "@/components/map/FloodLayerPanel";
import FloodV3ValidationLegend from "@/components/map/FloodV3ValidationLegend";
import TambonFloodMapLegend from "@/components/map/TambonFloodMapLegend";
import FoliumFloodLegend from "../../components/map/FoliumFloodLegend";
import MapDrawer from "@/components/map/ui/MapDrawer";
import LayerToggleRow from "@/components/map/ui/LayerToggleRow";
import TambonDetailPanel from "@/components/map/TambonDetailPanel";
import MapOperationsSummary from "@/components/map/MapOperationsSummary";

const MapView = dynamic(() => import("@/components/map/MapViewSimple"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-primary-50 rounded-mono">
      <Loader2 className="w-12 h-12 text-primary-400 animate-spin" />
    </div>
  ),
});

function MapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const basinSelectRef = useRef<HTMLSelectElement | null>(null);
  const [basins, setBasins] = useState<GeoJSONFeatureCollection | null>(null);
  const [waterLevels, setWaterLevels] =
    useState<GeoJSONFeatureCollection | null>(null);
  const [rivers, setRivers] = useState<GeoJSONFeatureCollection | null>(null);
  const [dams, setDams] = useState<GeoJSONFeatureCollection | null>(null);
  const [tileSummary, setTileSummary] = useState<any>(null);
  const [selectedBasin, setSelectedBasin] = useState<string | null>(
    searchParams?.get("basin") || null,
  );
  const [subbasins, setSubbasins] = useState<GeoJSONFeatureCollection | null>(
    null,
  );
  const [selectedSubbasin, setSelectedSubbasin] = useState<string | null>(
    searchParams?.get("subbasin") || null,
  );
  const [layers, setLayers] = useState({
    osmBasemap: true,
    esriBasemap: false,
    onwrTiffBasemap: false,
    basins: true,
    waterLevels: true,
    rivers: false,
    dams: true,
    satellite: false,
    floodDepth: false,
    rainfall: true,
    heatmap: true,
    timelapse: false,
    tambonFlood: false,
    foliumFloodProbability: false,
    onwrSar: false,
    onwrNational: false,
    v3DailyValidation: true,
  });
  const basemapKeys = ["osmBasemap", "esriBasemap", "onwrTiffBasemap"] as const;
  /** When SAR is on but user keeps “All Basins”, load EastCoast pipeline (valid app basin id). */
  const effectiveSarBasinId = selectedBasin ?? "eastern_coast";
  const [foliumFloodFeatureCount, setFoliumFloodFeatureCount] = useState<
    number | null
  >(null);
  const {
    geojson: onwrFc,
    dates: onwrDates,
    selectedDate: onwrDate,
    setSelectedDate: setOnwrDate,
    loading: sarLoading,
    loadingDates: sarLoadingDates,
    error: sarError,
  } = useFloodLayer(
    layers.onwrSar ? effectiveSarBasinId : null,
    layers.onwrSar,
  );
  const [onwrNationalFc, setOnwrNationalFc] =
    useState<GeoJSONFeatureCollection | null>(null);
  const [v3DailyFc, setV3DailyFc] = useState<GeoJSONFeatureCollection | null>(
    null,
  );
  const [v3DailyLoading, setV3DailyLoading] = useState(false);
  const [v3DailyError, setV3DailyError] = useState<string | null>(null);
  const [onwrAlerts, setOnwrAlerts] = useState<
    {
      pipeline_basin: string;
      app_basin_id?: string;
      HYBAS_ID?: number;
      name?: string;
      date: string;
      mean_z_score?: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedTambon, setSelectedTambon] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [subbasinsLoading, setSubbasinsLoading] = useState(false);

  const loadMapData = async () => {
    try {
      const [b, w, r, d, ts] = await Promise.all([
        dataClient.getBasins(),
        dataClient.getWaterLevelMap(selectedBasin || undefined),
        dataClient.getRivers(),
        dataClient.getDams(),
        dataClient.getTilesSummary(selectedBasin || undefined),
      ]);
      setBasins(b);
      setWaterLevels(w);
      setRivers(r);
      setDams(d);
      setTileSummary(ts);
      console.log("Map data loaded:", {
        basins: b,
        rivers: r,
        dams: d,
      });
    } catch (err) {
      console.error("Failed to load map data:", err);
      toast.error("โหลดข้อมูลแผนที่ล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  // Load persisted layer preferences
  useEffect(() => {
    try {
      const raw = localStorage.getItem("riffai.map.layers.v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      setLayers((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(prev)) {
          if (typeof parsed[k] === "boolean") (next as any)[k] = parsed[k];
        }
        return next;
      });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist layer preferences
  useEffect(() => {
    try {
      localStorage.setItem("riffai.map.layers.v1", JSON.stringify(layers));
    } catch {
      // ignore
    }
  }, [layers]);

  useEffect(() => {
    loadMapData();
  }, [selectedBasin]);

  useEffect(() => {
    const syncUrl = () => {
      const params = new URLSearchParams(
        Array.from(searchParams?.entries?.() || []),
      );
      if (selectedBasin) params.set("basin", selectedBasin);
      else params.delete("basin");
      if (selectedSubbasin) params.set("subbasin", selectedSubbasin);
      else params.delete("subbasin");
      router.replace(`?${params.toString()}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    syncUrl();
  }, [selectedBasin, selectedSubbasin]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const alerts = await dataClient.getOnwrFloodAlertsLatest(120);
        if (!cancelled)
          setOnwrAlerts(
            [...alerts].sort(
              (a: { mean_z_score?: number }, b: { mean_z_score?: number }) =>
                (a.mean_z_score ?? 0) - (b.mean_z_score ?? 0),
            ),
          );
      } catch {
        if (!cancelled) setOnwrAlerts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lastUpdate, layers.onwrSar]);

  useEffect(() => {
    if (!layers.onwrNational) {
      setOnwrNationalFc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const json = await dataClient.getOnwrNationalStats();
        if (!json) throw new Error("No national ONWR dataset found");
        if (!cancelled) setOnwrNationalFc(json);
      } catch {
        if (!cancelled) {
          setOnwrNationalFc(null);
          toast.error("ไม่สามารถโหลดชั้น Thailand SAR aggregate (GCS) ได้");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [layers.onwrNational]);

  useEffect(() => {
    if (!layers.v3DailyValidation) {
      setV3DailyFc(null);
      setV3DailyError(null);
      return;
    }
    let cancelled = false;
    setV3DailyLoading(true);
    setV3DailyError(null);
    (async () => {
      try {
        const res = await fetch("/geojson/flood_v3_daily_validation.geojson");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as GeoJSONFeatureCollection;
        if (!cancelled) setV3DailyFc(json);
      } catch {
        if (!cancelled) {
          setV3DailyFc(null);
          setV3DailyError("Could not load V3 validation GeoJSON");
          toast.error("โหลดชั้น V3 daily validation ไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setV3DailyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [layers.v3DailyValidation]);

  const onwrNationalFiltered = useMemo(() => {
    if (!onwrNationalFc?.features?.length) return null;
    if (!selectedBasin) return onwrNationalFc;
    const pipe = APP_TO_ONWR_BASIN[selectedBasin];
    const feats = onwrNationalFc.features.filter((f) => {
      const p = (f.properties || {}) as Record<string, unknown>;
      if (p.basin_app_id === selectedBasin) return true;
      if (pipe && p.basin_en === pipe) return true;
      return false;
    });
    return feats.length
      ? {
          ...onwrNationalFc,
          type: "FeatureCollection" as const,
          features: feats,
        }
      : onwrNationalFc;
  }, [onwrNationalFc, selectedBasin]);

  useEffect(() => {
    const loadSub = async () => {
      if (!selectedBasin) {
        setSubbasins(null);
        setSelectedSubbasin(null);
        setSubbasinsLoading(false);
        return;
      }
      setSubbasinsLoading(true);
      try {
        const fc = await dataClient.getSubbasins(selectedBasin);
        setSubbasins(fc);
      } catch {
        setSubbasins(null);
      } finally {
        setSubbasinsLoading(false);
      }
    };
    loadSub();
  }, [selectedBasin]);

  const refreshData = async () => {
    toast.loading("กำลังดึงข้อมูลใหม่...", { id: "refresh" });
    try {
      if (isStaticDataMode()) {
        toast("Static data mode: refresh uses local/remote files only.", {
          id: "refresh-mode",
        });
      } else {
        await dataClient.refreshWaterPipeline(selectedBasin || undefined);
      }
      await loadMapData();
      setLastUpdate(new Date());
      toast.success("อัพเดทสำเร็จ!", { id: "refresh" });
    } catch {
      toast.error("ล้มเหลว", { id: "refresh" });
    }
  };

  const toggle = (key: keyof typeof layers) => {
    if (basemapKeys.includes(key as (typeof basemapKeys)[number])) {
      setLayers((prev) => {
        const next = { ...prev, osmBasemap: false, esriBasemap: false, onwrTiffBasemap: false };
        next[key as (typeof basemapKeys)[number]] = true;
        return next;
      });
      return;
    }
    if (key === "onwrSar") {
      setLayers((prev) => {
        const on = !prev.onwrSar;
        if (!on) return { ...prev, onwrSar: false };
        return {
          ...prev,
          onwrSar: true,
          osmBasemap: false,
          onwrTiffBasemap: false,
          esriBasemap: true,
        };
      });
      return;
    }
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const exportOnwrCsv = () => {
    if (!onwrFc?.features?.length) return;
    const rows = onwrFc.features.map((f) => {
      const p = f.properties || {};
      return {
        HYBAS_ID: p.HYBAS_ID,
        name: p.NAME || p.name,
        date: p.date,
        mean_z_score: p.mean_z_score,
        flood_detected: p.flood_detected,
      };
    });
    const header = Object.keys(rows[0]);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        header.map((h) => esc(r[h as keyof typeof r])).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `onwr_subbasin_${effectiveSarBasinId}_${onwrDate || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] bg-gray-50">
      <div className="absolute inset-0">
        <MapView
          basins={basins}
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

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/85 backdrop-blur rounded-mono z-[1050] m-3 md:m-4">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-gray-700 animate-spin mx-auto mb-3" />
              <div className="text-sm text-gray-700 font-medium">
                Loading map data…
              </div>
            </div>
          </div>
        )}

        <MapDrawer
          title="Map View"
          subtitle="Basin → sub-basin → data layers"
          open={drawerOpen}
          onToggle={() => setDrawerOpen((v) => !v)}
        >
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-600">
              Location
            </h3>
            <div>
              <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">
                Select Basin
              </label>
              <select
                ref={basinSelectRef}
                value={selectedBasin || ""}
                onChange={(e) => setSelectedBasin(e.target.value || null)}
                className="input-mono text-sm"
              >
                <option value="">All Basins</option>
                {(basins?.features || []).map((f: any) => (
                  <option key={f.properties.id} value={f.properties.id}>
                    {f.properties.name || f.properties.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">
                Select Sub-basin
              </label>
              <select
                value={selectedSubbasin || ""}
                onChange={(e) => setSelectedSubbasin(e.target.value || null)}
                className="input-mono text-sm"
                disabled={!selectedBasin || !subbasins}
              >
                <option value="">
                  {subbasinsLoading
                    ? "Loading Sub-basins..."
                    : "All Sub-basins"}
                </option>
                {(subbasins?.features || []).map((f: any, idx: number) => (
                  <option
                    key={f.properties.subbasin_id || f.properties.id || idx}
                    value={
                      f.properties.subbasin_id || f.properties.id || String(idx)
                    }
                  >
                    {f.properties.name ||
                      f.properties.subbasin_id ||
                      f.properties.id ||
                      `subbasin-${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-600">
              Basemap
            </h3>
            <div className="space-y-2">
              {[
                {
                  key: "osmBasemap" as const,
                  label: "OpenStreetMap",
                  description: "Standard OSM vector-cartography basemap",
                },
                {
                  key: "esriBasemap" as const,
                  label: "Esri Satellite",
                  description: "High-resolution satellite imagery basemap",
                },
                {
                  key: "onwrTiffBasemap" as const,
                  label: "ONWR TIFF Basemap",
                  description: "Local ONWR raster basemap (GeoTIFF)",
                },
              ].map(({ key, label, description }) => (
                <LayerToggleRow
                  key={key}
                  checked={layers[key]}
                  onToggle={() => toggle(key)}
                  label={label}
                  description={description}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-600 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Data Layers
            </h3>
            <div className="space-y-2">
              {[
                {
                  key: "heatmap" as const,
                  label: "Flood Risk Heatmap",
                  description: "Grid-based risk visualization",
                },
                {
                  key: "onwrSar" as const,
                  label: "ONWR SAR sub-basin (Z-score)",
                  description: "Sentinel-1 zonal stats — HydroBASIN Lev09",
                },
                {
                  key: "tambonFlood" as const,
                  label: "Tambon Flood Prediction",
                  description: "XGBoost AI model (6,363 tambons)",
                },
                {
                  key: "foliumFloodProbability" as const,
                  label: "Folium Flood Probability (Tambon polygons)",
                  description: "Standalone high-contrast polygon layer",
                },
                {
                  key: "v3DailyValidation" as const,
                  label: "V3 daily validation",
                  description: "Static test-set snapshot — TP/TN/FP/FN",
                },
                {
                  key: "timelapse" as const,
                  label: "Time-lapse Animation",
                  description: "Historical playback (7 days)",
                },
                {
                  key: "basins" as const,
                  label: "Basin Boundaries",
                  description: "Administrative boundaries",
                },
                {
                  key: "rivers" as const,
                  label: "Rivers",
                  description: "Major river systems",
                },
                {
                  key: "dams" as const,
                  label: "Dams & Reservoirs",
                  description: "Water management infrastructure",
                },
                {
                  key: "waterLevels" as const,
                  label: "Water Levels",
                  description: "Current station readings",
                },
                {
                  key: "floodDepth" as const,
                  label: "Flood Depth",
                  description: "Predicted inundation depth",
                },
                {
                  key: "rainfall" as const,
                  label: "Rainfall Data",
                  description: "Precipitation measurements",
                },
                {
                  key: "satellite" as const,
                  label: "Satellite Imagery",
                  description: "Sentinel-1/2 imagery",
                },
              ].map(({ key, label, description }) => (
                <LayerToggleRow
                  key={key}
                  checked={layers[key]}
                  onToggle={() => toggle(key)}
                  label={label}
                  description={description}
                />
              ))}
            </div>
          </section>

          {layers.onwrSar && (
            <section className="space-y-2 p-3 border border-primary-200 bg-primary-50 rounded-mono">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                ONWR date (≈6-day SAR cadence)
                {!selectedBasin && (
                  <span className="block font-normal text-primary-600 mt-1">
                    Default pipeline:{" "}
                    {APP_TO_ONWR_BASIN[effectiveSarBasinId] ??
                      effectiveSarBasinId}{" "}
                    — pick a basin to switch region
                  </span>
                )}
              </h3>
              <select
                value={onwrDate || ""}
                onChange={(e) => setOnwrDate(e.target.value)}
                className="input-mono text-sm"
                disabled={!onwrDates.length}
              >
                {onwrDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {onwrFc && (
                <button
                  type="button"
                  onClick={exportOnwrCsv}
                  className="w-full btn-mono-outline text-xs py-2"
                >
                  Download sub-basin CSV
                </button>
              )}
            </section>
          )}

          <MapOperationsSummary
            onwrAlerts={onwrAlerts}
            tileSummary={tileSummary}
            waterLevels={waterLevels}
            lastUpdate={lastUpdate}
            onRefresh={refreshData}
            loading={loading}
          />
        </MapDrawer>

        <div className="absolute top-4 right-4 z-[1000] w-[min(92vw,22rem)] max-h-[calc(100%-2rem)] overflow-y-auto space-y-3 pointer-events-none">
          {layers.onwrSar && (
            <FloodLayerPanel
              dates={onwrDates}
              selectedDate={onwrDate}
              onDateChange={setOnwrDate}
              loading={sarLoading}
              loadingDates={sarLoadingDates}
              error={sarError}
              featureCount={onwrFc?.features?.length}
              floodedCount={
                onwrFc?.features?.filter((f) => f.properties?.flood_detected)
                  .length
              }
              pipelineBasinLabel={
                APP_TO_ONWR_BASIN[effectiveSarBasinId] ?? effectiveSarBasinId
              }
              position="inline"
            />
          )}
          {layers.tambonFlood && (
            <TambonFloodMapLegend
              loading={false}
              error={null}
              stats={null}
              featureCount={undefined}
              position="inline"
            />
          )}
          {layers.foliumFloodProbability && (
            <FoliumFloodLegend
              featureCount={foliumFloodFeatureCount ?? undefined}
              position="inline"
            />
          )}
          {layers.v3DailyValidation && (
            <FloodV3ValidationLegend
              featureCount={v3DailyFc?.features?.length}
              loading={v3DailyLoading}
              error={v3DailyError}
              position="inline"
            />
          )}
        </div>

        {/* Tambon Flood Layer */}
        {layers.tambonFlood && (
          <TambonFloodLayer
            visible={layers.tambonFlood}
            onTambonClick={(tambon) => setSelectedTambon(tambon)}
          />
        )}

        <TambonDetailPanel
          tambon={selectedTambon}
          onClose={() => setSelectedTambon(null)}
        />
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen">
            <div className="text-6xl animate-pulse font-bold">MAP</div>
          </div>
        }
      >
        <MapContent />
      </Suspense>
    </>
  );
}
