"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Map as MapIcon, Layers, RefreshCw, Loader2 } from "lucide-react";
import Navbar from "@/components/common/Navbar";
import { mapAPI, pipelineAPI } from "@/services/api";
import { GeoJSONFeatureCollection } from "@/types";
import toast from "react-hot-toast";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-primary-50 rounded-mono">
      <Loader2 className="w-12 h-12 text-primary-400 animate-spin" />
    </div>
  ),
});

function MapContent() {
  const searchParams = useSearchParams();
  const [basins, setBasins] = useState<GeoJSONFeatureCollection | null>(null);
  const [waterLevels, setWaterLevels] = useState<GeoJSONFeatureCollection | null>(null);
  const [selectedBasin, setSelectedBasin] = useState<string | null>(
    searchParams?.get("basin") || null
  );
  const [layers, setLayers] = useState({
    basins: true,
    waterLevels: true,
    satellite: false,
    floodDepth: false,
    rainfall: true,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadMapData = async () => {
    try {
      const [b, w] = await Promise.all([
        mapAPI.basins(),
        mapAPI.waterLevelMap(selectedBasin || undefined),
      ]);
      setBasins(b.data);
      setWaterLevels(w.data);
    } catch (err) {
      console.error(err);
      toast.error("โหลดข้อมูลแผนที่ล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
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
            <option value="mekong_north">Mekong North</option>
            <option value="eastern_coast">Eastern Coast</option>
            <option value="southern_east">Southern East</option>
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
              { key: "basins" as const, label: "Basin Boundaries", description: "Administrative boundaries" },
              { key: "waterLevels" as const, label: "Water Levels", description: "Current station readings" },
              { key: "floodDepth" as const, label: "Flood Depth", description: "Predicted inundation depth" },
              { key: "rainfall" as const, label: "Rainfall Data", description: "Precipitation measurements" },
              { key: "satellite" as const, label: "Satellite Imagery", description: "Sentinel-1/2 imagery" },
            ].map(({ key, label, description }) => (
              <label
                key={key}
                className="flex items-start gap-3 p-3 hover:bg-primary-50 rounded-mono cursor-pointer transition-colors border border-transparent hover:border-primary-200"
              >
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={() => toggle(key)}
                  className="mt-0.5 w-4 h-4 rounded-mono border-primary-300 text-primary-900 focus:ring-primary-900"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-primary-900">{label}</div>
                  <div className="text-xs text-primary-500 font-mono mt-0.5">{description}</div>
                </div>
              </label>
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
            <div className="p-4 bg-primary-50 border border-primary-200 rounded-mono">
              <div className="text-xs font-semibold text-primary-900 uppercase tracking-wider mb-3">
                Summary
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-primary-700">สถานี</span>
                  <span className="text-lg font-bold text-primary-900 font-mono">
                    {waterLevels.features?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-primary-700">🔴 วิกฤต</span>
                  <span className="text-lg font-bold text-red-600 font-mono">
                    {waterLevels.features?.filter(f => f.properties.risk_level === "critical").length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-primary-700">🟠 เตือนภัย</span>
                  <span className="text-lg font-bold text-orange-600 font-mono">
                    {waterLevels.features?.filter(f => f.properties.risk_level === "warning").length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-primary-700">🟡 เฝ้าระวัง</span>
                  <span className="text-lg font-bold text-yellow-600 font-mono">
                    {waterLevels.features?.filter(f => f.properties.risk_level === "watch").length || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-mono">
              <div className="text-xs font-semibold text-green-900 uppercase tracking-wider mb-2">
                Last Update
              </div>
              <div className="text-sm text-green-700 font-mono">
                {lastUpdate.toLocaleString("th-TH", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-mono text-xs text-blue-700">
              💡 <strong>Tip:</strong> Click on markers for detailed information. Use layer controls to toggle different data views.
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
          selectedBasin={selectedBasin}
          layers={layers}
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
            <div className="text-6xl animate-pulse">🗺️</div>
          </div>
        }
      >
        <MapContent />
      </Suspense>
    </>
  );
}
