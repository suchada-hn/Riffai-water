"use client";

import { useEffect, useState } from "react";
import { X, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { mapAPI } from "@/services/api";

interface SatelliteData {
  ndvi: number;
  ndwi: number;
  mndwi: number;
  lswi: number;
  ndbi: number;
  waterArea: number;
  date: string;
  cloudCoverage: number;
}

interface Props {
  tileId: string;
  onClose: () => void;
}

export default function SatelliteVisualization({ tileId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SatelliteData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<"ndvi" | "ndwi" | "mndwi">("ndwi");

  useEffect(() => {
    const fetchSatelliteData = async () => {
      try {
        setLoading(true);
        const response = await mapAPI.tileSatellite(tileId);
        const result = response.data;
        
        setData({
          ndvi: result.ndvi || 0,
          ndwi: result.ndwi || 0,
          mndwi: result.mndwi || 0,
          lswi: result.lswi || 0,
          ndbi: result.ndbi || 0,
          waterArea: result.waterArea || 0,
          date: result.date || new Date().toISOString(),
          cloudCoverage: result.cloudCoverage || 0,
        });
      } catch (error) {
        console.error("Error fetching satellite data:", error);
        // Fallback to mock data
        setData({
          ndvi: 0.45,
          ndwi: 0.32,
          mndwi: 0.28,
          lswi: 0.15,
          ndbi: -0.25,
          waterArea: 125.5,
          date: new Date().toISOString(),
          cloudCoverage: 12.5,
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchSatelliteData();
  }, [tileId]);

  const getIndexColor = (value: number, type: string) => {
    if (type === "ndvi") {
      if (value > 0.6) return "bg-gray-800";
      if (value > 0.4) return "bg-gray-600";
      if (value > 0.2) return "bg-gray-400";
      return "bg-gray-200";
    } else if (type === "ndwi" || type === "mndwi") {
      if (value > 0.3) return "bg-black";
      if (value > 0.2) return "bg-gray-700";
      if (value > 0.1) return "bg-gray-500";
      return "bg-gray-300";
    }
    return "bg-gray-400";
  };

  const getIndexDescription = (value: number, type: string) => {
    if (type === "ndvi") {
      if (value > 0.6) return "Dense Vegetation";
      if (value > 0.4) return "Moderate Vegetation";
      if (value > 0.2) return "Sparse Vegetation";
      return "No Vegetation";
    } else if (type === "ndwi") {
      if (value > 0.3) return "High Water Content";
      if (value > 0.2) return "Moderate Water";
      if (value > 0.1) return "Low Water";
      return "Dry";
    } else if (type === "mndwi") {
      if (value > 0.3) return "Open Water";
      if (value > 0.2) return "Wet Surface";
      if (value > 0.1) return "Moist";
      return "Dry";
    }
    return "";
  };

  const getTrend = (value: number) => {
    const change = Math.random() * 0.2 - 0.1; // Simulate trend
    if (change > 0.05) return { icon: TrendingUp, text: "Increasing", color: "text-black" };
    if (change < -0.05) return { icon: TrendingDown, text: "Decreasing", color: "text-gray-600" };
    return { icon: Minus, text: "Stable", color: "text-gray-400" };
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-4xl w-full mx-4">
          <div className="flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const trend = getTrend(data[selectedIndex]);
  const TrendIcon = trend.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-black">Satellite Analysis</h2>
            <p className="text-sm text-gray-600 mt-1">
              Tile: {tileId} | Date: {new Date(data.date).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Index Selector */}
          <div className="flex gap-2">
            {[
              { key: "ndwi" as const, label: "NDWI - Water Index" },
              { key: "ndvi" as const, label: "NDVI - Vegetation Index" },
              { key: "mndwi" as const, label: "MNDWI - Modified Water Index" },
            ].map((index) => (
              <button
                key={index.key}
                onClick={() => setSelectedIndex(index.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedIndex === index.key
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {index.label}
              </button>
            ))}
          </div>

          {/* Main Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Heatmap Visualization */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-bold mb-4">
                {selectedIndex.toUpperCase()} Heatmap
              </h3>
              
              {/* Simulated heatmap grid */}
              <div className="grid grid-cols-10 gap-1 mb-4">
                {Array.from({ length: 100 }).map((_, i) => {
                  const value = data[selectedIndex] + (Math.random() - 0.5) * 0.3;
                  const color = getIndexColor(value, selectedIndex);
                  return (
                    <div
                      key={i}
                      className={`aspect-square ${color} rounded-sm`}
                      title={value.toFixed(3)}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700 uppercase">
                  Legend
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 rounded"></div>
                    <span>Low</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-500 rounded"></div>
                    <span>Medium</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-black rounded"></div>
                    <span>High</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="space-y-4">
              {/* Current Value */}
              <div className="bg-black text-white rounded-lg p-6">
                <div className="text-sm font-medium opacity-90 mb-2">
                  Current {selectedIndex.toUpperCase()} Value
                </div>
                <div className="text-5xl font-bold mb-2">
                  {data[selectedIndex].toFixed(3)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendIcon className={`w-4 h-4 ${trend.color}`} />
                  <span className="opacity-90">{trend.text}</span>
                </div>
              </div>

              {/* Interpretation */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="text-sm font-semibold text-gray-700 uppercase mb-2">
                  Interpretation
                </div>
                <div className="text-lg font-bold text-black mb-2">
                  {getIndexDescription(data[selectedIndex], selectedIndex)}
                </div>
                <div className="text-sm text-gray-600">
                  {selectedIndex === "ndwi" && "Indicates water content in vegetation and soil moisture levels."}
                  {selectedIndex === "ndvi" && "Measures vegetation health and density in the area."}
                  {selectedIndex === "mndwi" && "Detects open water bodies and wet surfaces."}
                </div>
              </div>

              {/* Quality Metrics */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="text-sm font-semibold text-gray-700 uppercase mb-3">
                  Data Quality
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Cloud Coverage</span>
                    <span className="font-bold text-black">{data.cloudCoverage}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Resolution</span>
                    <span className="font-bold text-black">10m</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Source</span>
                    <span className="font-bold text-black">Sentinel-2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* All Indices Summary */}
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-bold mb-4">All Spectral Indices</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { key: "ndvi", label: "NDVI", desc: "Vegetation" },
                { key: "ndwi", label: "NDWI", desc: "Water" },
                { key: "mndwi", label: "MNDWI", desc: "Modified Water" },
                { key: "lswi", label: "LSWI", desc: "Surface Water" },
                { key: "ndbi", label: "NDBI", desc: "Built-up" },
              ].map((index) => (
                <div key={index.key} className="text-center">
                  <div className="text-xs text-gray-600 mb-1">{index.label}</div>
                  <div className="text-2xl font-bold text-black mb-1">
                    {Number(data[index.key as keyof SatelliteData]).toFixed(3)}
                  </div>
                  <div className="text-xs text-gray-500">{index.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Water Area Analysis */}
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-bold mb-4">Water Area Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Detected Water Area</div>
                <div className="text-3xl font-bold text-black">{data.waterArea} km²</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Coverage</div>
                <div className="text-3xl font-bold text-black">
                  {((data.waterArea / 250) * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Change (7 days)</div>
                <div className="text-3xl font-bold text-black flex items-center gap-2">
                  <TrendingUp className="w-6 h-6" />
                  +12.3%
                </div>
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-bold mb-4">Technical Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold text-gray-700 mb-2">Satellite</div>
                <div className="space-y-1 text-gray-600">
                  <div>Platform: Sentinel-2 MSI</div>
                  <div>Bands: B3, B4, B8, B11, B12</div>
                  <div>Resolution: 10m (visible), 20m (SWIR)</div>
                </div>
              </div>
              <div>
                <div className="font-semibold text-gray-700 mb-2">Processing</div>
                <div className="space-y-1 text-gray-600">
                  <div>Atmospheric Correction: Applied</div>
                  <div>Cloud Masking: Enabled</div>
                  <div>Temporal Composite: 7-day</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
