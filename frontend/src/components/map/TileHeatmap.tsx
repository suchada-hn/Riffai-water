"use client";

import { useEffect, useState } from "react";
import { GeoJSON, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { mapAPI } from "@/services/api";

interface TileStats {
  avgWaterLevel: number;
  rainfall24h: number;
  stationCount: number;
  populationAtRisk: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
}

interface TileProperties {
  id: string;
  center: [number, number];
  riskLevel: string;
  stats: TileStats;
  provinces: string[];
  rivers: string[];
  dams: any[];
  aiPrediction: {
    floodProbability: number;
    daysAhead: number;
  };
  lastUpdate: string;
}

interface TileFeature {
  type: "Feature";
  id: string;
  properties: TileProperties;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

interface TileHeatmapProps {
  visible: boolean;
  onTileClick?: (tile: TileProperties) => void;
  basinId?: string | null;
}

const RISK_COLORS: Record<string, string> = {
  safe: "#10b981",      // green-500
  normal: "#84cc16",    // lime-500
  watch: "#eab308",     // yellow-500
  warning: "#f97316",   // orange-500
  critical: "#ef4444",  // red-500
};

const RISK_LABELS: Record<string, string> = {
  safe: "ปลอดภัย",
  normal: "ปกติ",
  watch: "เฝ้าระวัง",
  warning: "เตือนภัย",
  critical: "วิกฤต",
};

export default function TileHeatmap({ visible, onTileClick, basinId }: TileHeatmapProps) {
  const [tiles, setTiles] = useState<TileFeature[]>([]);
  const [selectedTile, setSelectedTile] = useState<TileProperties | null>(null);
  const [loading, setLoading] = useState(true);
  const map = useMap();

  useEffect(() => {
    if (visible) {
      loadTiles();
    }
  }, [visible, basinId]);

  const loadTiles = async () => {
    try {
      setLoading(true);
      const res = await mapAPI.tiles({ basin_id: basinId || undefined });
      setTiles(res.data.features || []);
    } catch (error) {
      console.error("Failed to load tiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTileStyle = (feature: TileFeature) => {
    const riskLevel = feature.properties.riskLevel;
    const color = RISK_COLORS[riskLevel] || "#94a3b8";
    
    return {
      fillColor: color,
      fillOpacity: 0.5,
      color: color,
      weight: 1,
      opacity: 0.8,
    };
  };

  const onEachFeature = (feature: TileFeature, layer: L.Layer) => {
    const props = feature.properties;
    
    // Hover effect
    layer.on({
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({
          fillOpacity: 0.7,
          weight: 2,
        });
      },
      mouseout: (e) => {
        const layer = e.target;
        layer.setStyle({
          fillOpacity: 0.5,
          weight: 1,
        });
      },
      click: () => {
        setSelectedTile(props);
        if (onTileClick) {
          onTileClick(props);
        }
        // Zoom to tile
        map.flyTo(props.center as L.LatLngExpression, 9, { duration: 1 });
      },
    });

    // Tooltip on hover
    layer.bindTooltip(
      `
      <div class="text-xs">
        <div class="font-bold text-sm mb-1">${RISK_LABELS[props.riskLevel]}</div>
        <div>💧 ${props.stats.avgWaterLevel.toFixed(1)} ม.</div>
        <div>🌧️ ${props.stats.rainfall24h.toFixed(0)} มม.</div>
        <div>📍 ${props.provinces.join(", ")}</div>
      </div>
      `,
      {
        sticky: true,
        className: "tile-tooltip",
      }
    );
  };

  if (!visible || loading) return null;

  return (
    <>
      <GeoJSON
        data={{ type: "FeatureCollection", features: tiles } as any}
        style={getTileStyle as any}
        onEachFeature={onEachFeature as any}
      />

      {selectedTile && (
        <Popup
          position={selectedTile.center as L.LatLngExpression}
          onClose={() => setSelectedTile(null)}
        >
          <div className="min-w-[300px] max-w-[400px]">
            {/* Header */}
            <div className="border-b pb-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg">
                  {RISK_LABELS[selectedTile.riskLevel]}
                </h3>
                <span
                  className="px-2 py-1 rounded text-xs font-bold text-white"
                  style={{ backgroundColor: RISK_COLORS[selectedTile.riskLevel] }}
                >
                  {selectedTile.riskLevel.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                📍 {selectedTile.provinces.join(", ")}
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">💧 ระดับน้ำเฉลี่ย</span>
                <span className="font-bold text-blue-600">
                  {selectedTile.stats.avgWaterLevel.toFixed(2)} ม.
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">🌧️ ฝน 24 ชม.</span>
                <span className="font-bold text-blue-600">
                  {selectedTile.stats.rainfall24h.toFixed(1)} มม.
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">📈 แนวโน้ม</span>
                <span className={`font-bold ${
                  selectedTile.stats.trend === "up" ? "text-red-600" :
                  selectedTile.stats.trend === "down" ? "text-green-600" :
                  "text-gray-600"
                }`}>
                  {selectedTile.stats.trend === "up" ? "↗️" :
                   selectedTile.stats.trend === "down" ? "↘️" : "→"}
                  {" "}
                  {selectedTile.stats.trend === "up" ? "เพิ่มขึ้น" :
                   selectedTile.stats.trend === "down" ? "ลดลง" : "คงที่"}
                  {" "}
                  {Math.abs(selectedTile.stats.trendPercent)}%
                </span>
              </div>
            </div>

            {/* Population at risk */}
            {selectedTile.stats.populationAtRisk > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded p-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏘️</span>
                  <div>
                    <div className="text-xs text-gray-600">ประชากรเสี่ยง</div>
                    <div className="font-bold text-orange-700">
                      ~{selectedTile.stats.populationAtRisk.toLocaleString()} คน
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Prediction */}
            {selectedTile.aiPrediction.floodProbability > 30 && (
              <div className="bg-purple-50 border border-purple-200 rounded p-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🤖</span>
                  <div className="flex-1">
                    <div className="text-xs text-gray-600">AI Prediction</div>
                    <div className="font-bold text-purple-700">
                      {selectedTile.aiPrediction.floodProbability.toFixed(0)}% โอกาสน้ำท่วม
                    </div>
                    <div className="text-xs text-gray-500">
                      ใน {selectedTile.aiPrediction.daysAhead} วันข้างหน้า
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stations */}
            <div className="text-xs text-gray-500 border-t pt-2">
              📡 {selectedTile.stats.stationCount} สถานีตรวจวัด
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}
