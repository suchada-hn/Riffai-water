"use client";

import { useState, useEffect } from "react";
import { X, TrendingUp, TrendingDown, Minus, AlertTriangle, Satellite } from "lucide-react";
import SatelliteVisualization from "./SatelliteVisualization";
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

interface HistoryData {
  date: string;
  avgWaterLevel: number;
  rainfall24h: number;
  riskLevel: string;
}

interface TileDetailPanelProps {
  tile: TileProperties | null;
  onClose: () => void;
}

const RISK_COLORS: Record<string, string> = {
  safe: "#10b981",
  normal: "#84cc16",
  watch: "#eab308",
  warning: "#f97316",
  critical: "#ef4444",
};

const RISK_LABELS: Record<string, string> = {
  safe: "ปลอดภัย",
  normal: "ปกติ",
  watch: "เฝ้าระวัง",
  warning: "เตือนภัย",
  critical: "วิกฤต",
};

export default function TileDetailPanel({ tile, onClose }: TileDetailPanelProps) {
  const [history, setHistory] = useState<HistoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "prediction">("overview");
  const [showSatellite, setShowSatellite] = useState(false);

  useEffect(() => {
    if (tile && activeTab === "history") {
      loadHistory();
    }
  }, [tile, activeTab]);

  const loadHistory = async () => {
    if (!tile) return;
    
    try {
      setLoading(true);
      // Backend no longer serves simulated tile history. Keep UI working by deriving
      // a 7-day history from the date-driven tiles endpoint.
      const days = 7;
      const today = new Date();
      const historyItems: HistoryData[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const day = d.toISOString().slice(0, 10);
        const res = await mapAPI.tiles({ date: day });
        const feature = (res.data.features || []).find((f: any) => f?.properties?.id === tile.id);
        if (!feature) continue;
        historyItems.push({
          date: d.toISOString(),
          avgWaterLevel: feature.properties.stats.avgWaterLevel,
          rainfall24h: feature.properties.stats.rainfall24h,
          riskLevel: feature.properties.riskLevel,
        });
      }
      setHistory(historyItems);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!tile) return null;

  const TrendIcon = tile.stats.trend === "up" ? TrendingUp :
                    tile.stats.trend === "down" ? TrendingDown : Minus;

  return (
    <>
    <div className="fixed right-4 top-20 bottom-4 w-96 bg-white rounded-lg shadow-2xl z-[1000] flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="p-4 text-white"
        style={{ backgroundColor: RISK_COLORS[tile.riskLevel] }}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold">{RISK_LABELS[tile.riskLevel]}</h2>
            <p className="text-sm opacity-90">
              {tile.provinces.join(", ")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-xs opacity-75">
          Tile ID: {tile.id}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {[
          { id: "overview", label: "Overview" },
          { id: "history", label: "History" },
          { id: "prediction", label: "Prediction" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-black border-b-2 border-black"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Satellite Analysis Button */}
      <div className="p-4 border-b bg-gray-50">
        <button
          onClick={() => setShowSatellite(true)}
          className="w-full bg-black text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <Satellite className="w-5 h-5" />
          View Satellite Analysis
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Main Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-gray-600 mb-1">Water Level</div>
                <div className="text-2xl font-bold text-blue-700">
                  {tile.stats.avgWaterLevel.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">meters</div>
              </div>

              <div className="bg-sky-50 rounded-lg p-3">
                <div className="text-xs text-gray-600 mb-1">Rainfall 24h</div>
                <div className="text-2xl font-bold text-sky-700">
                  {tile.stats.rainfall24h.toFixed(0)}
                </div>
                <div className="text-xs text-gray-500">mm</div>
              </div>
            </div>

            {/* Trend */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendIcon className={`w-5 h-5 ${
                    tile.stats.trend === "up" ? "text-red-600" :
                    tile.stats.trend === "down" ? "text-green-600" :
                    "text-gray-600"
                  }`} />
                  <div>
                    <div className="text-xs text-gray-600">Trend</div>
                    <div className="font-bold">
                      {tile.stats.trend === "up" ? "Increasing" :
                       tile.stats.trend === "down" ? "Decreasing" : "Stable"}
                    </div>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${
                  tile.stats.trend === "up" ? "text-red-600" :
                  tile.stats.trend === "down" ? "text-green-600" :
                  "text-gray-600"
                }`}>
                  {tile.stats.trendPercent > 0 ? "+" : ""}
                  {tile.stats.trendPercent.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Population at Risk */}
            {tile.stats.populationAtRisk > 0 && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">RISK</div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1">Population at Risk</div>
                    <div className="text-2xl font-bold text-orange-700">
                      {tile.stats.populationAtRisk.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">people</div>
                  </div>
                </div>
              </div>
            )}

            {/* Stations */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Monitoring Stations</div>
                <div className="text-xl font-bold text-gray-700">
                  {tile.stats.stationCount}
                </div>
              </div>
            </div>

            {/* Last Update */}
            <div className="text-xs text-gray-500 text-center pt-2 border-t">
              อัพเดทล่าสุด: {new Date(tile.lastUpdate).toLocaleString("th-TH")}
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Loading data...
              </div>
            ) : history.length > 0 ? (
              <>
                <div className="text-sm font-medium text-gray-700 mb-3">
                  Last 7 Days History
                </div>
                {history.map((item, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">
                        {new Date(item.date).toLocaleDateString("th-TH", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-bold text-white"
                        style={{ backgroundColor: RISK_COLORS[item.riskLevel] }}
                      >
                        {RISK_LABELS[item.riskLevel]}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Water: </span>
                        <span className="font-medium">{item.avgWaterLevel.toFixed(2)} m</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Rain: </span>
                        <span className="font-medium">{item.rainfall24h.toFixed(0)} mm</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No history data available
              </div>
            )}
          </div>
        )}

        {activeTab === "prediction" && (
          <div className="space-y-4">
            {/* AI Prediction */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl">AI</div>
                <div>
                  <div className="text-sm text-gray-600">AI Prediction</div>
                  <div className="text-lg font-bold text-purple-700">
                    Flood Probability
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-end justify-between mb-1">
                  <span className="text-sm text-gray-600">Probability</span>
                  <span className="text-3xl font-bold text-purple-700">
                    {tile.aiPrediction.floodProbability.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
                    style={{ width: `${tile.aiPrediction.floodProbability}%` }}
                  />
                </div>
              </div>

              <div className="text-sm text-gray-600">
                In {tile.aiPrediction.daysAhead} days ahead
              </div>
            </div>

            {/* Risk Assessment */}
            {tile.aiPrediction.floodProbability > 50 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-red-700 mb-1">
                      High Risk Warning
                    </div>
                    <div className="text-sm text-red-600">
                      This area has high flood risk. Prepare emergency response.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="font-bold text-blue-900 mb-2">Recommendations</div>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Monitor news and updates closely</li>
                <li>• Prepare emergency evacuation plan</li>
                <li>• Move valuables to higher ground</li>
                <li>• Prepare emergency supplies</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>

    {showSatellite && (
      <SatelliteVisualization
        tileId={tile.id}
        onClose={() => setShowSatellite(false)}
      />
    )}
    </>
  );
}
