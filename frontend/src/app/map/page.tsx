"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Map as MapIcon, Layers, RefreshCw, Loader2 } from "lucide-react";
import Navbar from "@/components/common/Navbar";
import { mapAPI, pipelineAPI } from "@/services/api";
import { GeoJSONFeatureCollection } from "@/types";
import toast from "react-hot-toast";
import TambonFloodLayer from "@/components/map/TambonFloodLayer";
import TambonDetailPanel from "@/components/map/TambonDetailPanel";
import LayerToggleRow from "@/components/map/LayerToggleRow";
import SidebarCard from "@/components/ui/SidebarCard";
import { useRouter } from "next/navigation";

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
  const [basins, setBasins] = useState<GeoJSONFeatureCollection | null>(null);
  const [waterLevels, setWaterLevels] = useState<GeoJSONFeatureCollection | null>(null);
  const [rivers, setRivers] = useState<GeoJSONFeatureCollection | null>(null);
  const [dams, setDams] = useState<GeoJSONFeatureCollection | null>(null);
  const [tileSummary, setTileSummary] = useState<any>(null);
  const [selectedBasin, setSelectedBasin] = useState<string | null>(
    searchParams?.get("basin") || null
  );
  const [subbasins, setSubbasins] = useState<GeoJSONFeatureCollection | null>(null);
  const [selectedSubbasin, setSelectedSubbasin] = useState<string | null>(
    searchParams?.get("subbasin") || null
  );
  const [layers, setLayers] = useState({
    basins: true,
    waterLevels: true,
    rivers: true,
    dams: true,
    satellite: false,
    floodDepth: false,
    rainfall: true,
    heatmap: true,
    timelapse: false,
    tambonFlood: false,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedTambon, setSelectedTambon] = useState<any>(null);

  const loadMapData = async () => {
    try {
      const [b, w, r, d, ts] = await Promise.all([
        mapAPI.basins(),
        mapAPI.waterLevelMap(selectedBasin || undefined),
        mapAPI.rivers(),
        mapAPI.dams(),
        mapAPI.tilesSummary({ basin_id: selectedBasin || undefined }),
      ]);
      setBasins(b.data);
      setWaterLevels(w.data);
      setRivers(r.data);
      setDams(d.data);
      setTileSummary(ts.data);
      console.log("Map data loaded:", { basins: b.data, rivers: r.data, dams: d.data });
    } catch (err) {
      console.error("Failed to load map data:", err);
      toast.error("โหลดข้อมูลแผนที่ล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, [selectedBasin]);

  useEffect(() => {
    const syncUrl = () => {
      const params = new URLSearchParams(Array.from(searchParams?.entries?.() || []));
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
    const loadSub = async () => {
      if (!selectedBasin) {
        setSubbasins(null);
        setSelectedSubbasin(null);
        return;
      }
      try {
        const res = await mapAPI.subbasins(selectedBasin);
        setSubbasins(res.data);
      } catch (e) {
        setSubbasins(null);
      }
    };
    loadSub();
  }, [selectedBasin]);

  const refreshData = async () => {
    toast.loading("กำลังดึงข้อมูลใหม่...", { id: "refresh" });
    try {
      await pipelineAPI.fetchWater(selectedBasin || undefined);
      await loadMapData();
      setLastUpdate(new Date());
      toast.success("อัพเดทสำเร็จ!", { id: "refresh" });
    } catch {
      toast.error("ล้มเหลว", { id: "refresh" });
    }
  };

  const toggle = (key: keyof typeof layers) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r-2 border-primary-200 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-primary-900 tracking-tight flex items-center gap-2">
          <MapIcon className="w-6 h-6" />
          Map View
        </h2>

        {/* Basin select */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">
            Select Basin
          </label>
          <select
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

        {/* Sub-basin select */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">
            Select Sub-basin
          </label>
          <select
            value={selectedSubbasin || ""}
            onChange={(e) => setSelectedSubbasin(e.target.value || null)}
            className="input-mono text-sm"
            disabled={!selectedBasin || !subbasins}
          >
            <option value="">All Sub-basins</option>
            {(subbasins?.features || []).map((f: any, idx: number) => (
              <option
                key={f.properties.subbasin_id || f.properties.id || idx}
                value={f.properties.subbasin_id || f.properties.id || String(idx)}
              >
                {f.properties.name || f.properties.subbasin_id || f.properties.id || `subbasin-${idx + 1}`}
              </option>
            ))}
          </select>
        </div>

        {/* Layers */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Data Layers
          </h3>
          <div className="space-y-2">
            {[
              { key: "heatmap" as const, label: "Flood Risk Heatmap", description: "Grid-based risk visualization" },
              { key: "tambonFlood" as const, label: "Tambon Flood Prediction", description: "XGBoost AI model (6,363 tambons)" },
              { key: "timelapse" as const, label: "Time-lapse Animation", description: "Historical playback (7 days)" },
              { key: "basins" as const, label: "Basin Boundaries", description: "Administrative boundaries" },
              { key: "rivers" as const, label: "Rivers", description: "Major river systems" },
              { key: "dams" as const, label: "Dams & Reservoirs", description: "Water management infrastructure" },
              { key: "waterLevels" as const, label: "Water Levels", description: "Current station readings" },
              { key: "floodDepth" as const, label: "Flood Depth", description: "Predicted inundation depth" },
              { key: "rainfall" as const, label: "Rainfall Data", description: "Precipitation measurements" },
              { key: "satellite" as const, label: "Satellite Imagery", description: "Sentinel-1/2 imagery" },
            ].map(({ key, label, description }) => (
              <LayerToggleRow
                key={key}
                id={`layer-${key}`}
                label={label}
                description={description}
                checked={layers[key]}
                onChange={() => toggle(key)}
              />
            )) as any}
          </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3">
            Legend
          </h3>
          
          {/* Water Level Status */}
          <div className="mb-4">
            <div className="text-xs font-medium text-primary-700 mb-2">Water Level Status</div>
            <div className="space-y-2">
              {[
                { color: "bg-primary-300", label: "Normal", range: "< 3.0 m" },
                { color: "bg-primary-500", label: "Watch", range: "3.0 - 4.0 m" },
                { color: "bg-primary-700", label: "Warning", range: "4.0 - 4.5 m" },
                { color: "bg-primary-900", label: "Critical", range: "> 4.5 m" },
              ].map(({ color, label, range }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 ${color}`} />
                    <span className="text-xs text-primary-700 font-medium">{label}</span>
                  </div>
                  <span className="text-xs text-primary-500 font-mono">{range}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Flood Depth (if enabled) */}
          {layers.floodDepth && (
            <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-mono">
              <div className="text-xs font-medium text-primary-700 mb-2">Flood Depth</div>
              <div className="space-y-1.5">
                {[
                  { color: "bg-primary-900", label: "2.5 m" },
                  { color: "bg-primary-600", label: "1.5 m" },
                  { color: "bg-primary-300", label: "0.5 m" },
                  { color: "bg-primary-100", label: "0 m" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 ${color}`} />
                    <span className="text-xs text-primary-700 font-mono">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={refreshData}
          className="w-full btn-mono text-sm flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </button>

        {/* Stats */}
        {waterLevels && (
          <div className="mt-6 space-y-3">
            {/* Tile Heatmap Summary */}
            {layers.heatmap && tileSummary && (
              <SidebarCard title="Heatmap Summary">
                <div className="text-xs font-semibold text-black uppercase tracking-wider mb-3">
                  Heatmap Summary
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Grid Tiles</span>
                    <span className="text-lg font-bold text-black font-mono">
                      {tileSummary.totalTiles}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-black rounded"></div>
                      <span>{tileSummary.riskCounts?.critical || 0} Critical</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-700 rounded"></div>
                      <span>{tileSummary.riskCounts?.warning || 0} Warning</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-400 rounded"></div>
                      <span>{tileSummary.riskCounts?.watch || 0} Watch</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-200 rounded"></div>
                      <span>{tileSummary.riskCounts?.safe || 0} Safe</span>
                    </div>
                  </div>
                  {tileSummary.totalPopulationAtRisk > 0 && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-600">Population at Risk</div>
                      <div className="text-lg font-bold text-black">
                        ~{tileSummary.totalPopulationAtRisk.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-mono">
              <div className="text-xs font-semibold text-black uppercase tracking-wider mb-3">
                Summary
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Stations</span>
                  <span className="text-lg font-bold text-black font-mono">
                    {waterLevels.features?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Critical</span>
                  <span className="text-lg font-bold text-black font-mono">
                    {waterLevels.features?.filter(f => f.properties.risk_level === "critical").length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Warning</span>
                  <span className="text-lg font-bold text-gray-700 font-mono">
                    {waterLevels.features?.filter(f => f.properties.risk_level === "warning").length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Watch</span>
                  <span className="text-lg font-bold text-gray-500 font-mono">
                    {waterLevels.features?.filter(f => f.properties.risk_level === "watch").length || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-mono">
              <div className="text-xs font-semibold text-black uppercase tracking-wider mb-2">
                Last Update
              </div>
              <div className="text-sm text-gray-700 font-mono">
                {lastUpdate.toLocaleString("th-TH", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-mono text-xs text-gray-700">
              <strong>Tip:</strong> Click on markers for detailed information. Use layer controls to toggle different data views.
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 p-4 relative bg-primary-50">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white rounded-mono z-10 m-4">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-3" />
              <div className="text-sm text-primary-600 font-medium">Loading map data...</div>
            </div>
          </div>
        )}
        <MapView
          basins={basins}
          waterLevels={waterLevels}
          rivers={rivers}
          dams={dams}
          selectedBasin={selectedBasin}
          layers={layers}
        />
        
        {/* Tambon Flood Layer */}
        {layers.tambonFlood && (
          <TambonFloodLayer
            visible={layers.tambonFlood}
            onTambonClick={(tambon) => setSelectedTambon(tambon)}
          />
        )}
        
        {/* Tambon Detail Panel */}
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
