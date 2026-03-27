"use client";

import { useEffect, useState } from "react";
import { tambonAPI } from "@/services/api";
import { AlertTriangle, TrendingUp } from "lucide-react";

interface TambonData {
  tb_idn: string;
  tb_tn: string;
  ap_tn: string;
  pv_tn: string;
  flood_probability: number;
  flood_percent: number;
  risk_level: string;
}

interface Props {
  visible: boolean;
  riskFilter?: string;
  minProbability?: number;
  onTambonClick?: (tambon: TambonData) => void;
}

const RISK_COLORS: Record<string, string> = {
  VERY_HIGH: "#d73027",
  HIGH: "#fc8d59",
  MEDIUM: "#fee08b",
  LOW: "#91cf60",
  VERY_LOW: "#1a9850",
};

export default function TambonFloodLayer({
  visible,
  riskFilter,
  minProbability,
  onTambonClick,
}: Props) {
  const [tambons, setTambons] = useState<TambonData[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      loadTambons();
      loadStats();
    }
  }, [visible, riskFilter, minProbability]);

  const loadTambons = async () => {
    try {
      setLoading(true);
      const response = await tambonAPI.getTopRisk(500);
      let data = response.data.tambons || [];

      // Apply filters
      if (riskFilter) {
        data = data.filter((t: TambonData) => t.risk_level === riskFilter);
      }
      if (minProbability !== undefined) {
        data = data.filter((t: TambonData) => t.flood_probability >= minProbability);
      }

      setTambons(data);
    } catch (error) {
      console.error("Error loading tambons:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await tambonAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  if (!visible) return null;

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-[1000]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <div>
          <h3 className="font-bold text-black">Tambon Flood Risk</h3>
          <p className="text-xs text-gray-600">XGBoost Model Predictions</p>
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="mb-4 space-y-2">
          <div className="text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-600">Total Coverage</span>
              <span className="font-bold text-black">
                {(stats.total_sub_districts ?? stats.total_tambons)?.toLocaleString() || "6,363"}{" "}
                tambons
              </span>
            </div>
          </div>

          {/* Risk Distribution */}
          <div className="space-y-1">
            {Object.entries(RISK_COLORS).map(([level, color]) => {
              const d = stats.risk_distribution || {};
              const snake = level.toLowerCase() as keyof typeof d;
              const count = Number(d[level] ?? d[snake] ?? 0) || 0;
              const totalN = stats.total_sub_districts ?? stats.total_tambons ?? 0;
              const percent = totalN ? ((count / totalN) * 100).toFixed(1) : "0";

              return (
                <div key={level} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-gray-600 flex-1">{level.replace("_", " ")}</span>
                  <span className="font-medium text-black">
                    {count.toLocaleString()} ({percent}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Risk Tambons */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-red-600" />
          <h4 className="font-bold text-sm text-black">Highest Risk Areas</h4>
        </div>

        {loading ? (
          <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tambons.slice(0, 10).map((tambon) => (
              <div
                key={tambon.tb_idn}
                onClick={() => onTambonClick?.(tambon)}
                className="p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-black truncate">
                      {tambon.tb_tn}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {tambon.ap_tn}, {tambon.pv_tn}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-sm font-bold"
                      style={{ color: RISK_COLORS[tambon.risk_level] }}
                    >
                      {tambon.flood_percent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">{tambon.risk_level}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t">
        <div className="text-xs text-gray-500">
          Model: XGBoost V2 (AUC-ROC: 0.9131)
          <br />
          Coverage: 6,363 sub-districts nationwide
          <br />
          Updated: Daily at 06:00 AM
        </div>
      </div>
    </div>
  );
}
