"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import type { GeoJSONFeatureCollection } from "@/types";
import {
  STATIC_FLOOD_GEOJSON_URL,
  aggregateBandCounts,
  featureToTambonRow,
} from "@/lib/floodStaticGeojson";

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
  const [stats, setStats] = useState<{
    total_sub_districts: number;
    risk_distribution: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    if (!visible) {
      setTambons([]);
      setStats(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(STATIC_FLOOD_GEOJSON_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const fc = (await res.json()) as GeoJSONFeatureCollection;
        if (cancelled) return;

        const rows: TambonData[] = [];
        for (const f of fc.features || []) {
          const row = featureToTambonRow(f);
          if (row) rows.push(row);
        }

        let filtered = rows;
        if (riskFilter) {
          filtered = filtered.filter((t) => t.risk_level === riskFilter);
        }
        if (minProbability !== undefined) {
          filtered = filtered.filter(
            (t) => t.flood_probability >= minProbability,
          );
        }

        const sorted = [...filtered].sort(
          (a, b) => b.flood_percent - a.flood_percent,
        );

        const bands = aggregateBandCounts(fc);
        setStats({
          total_sub_districts: fc.features?.length ?? 0,
          risk_distribution: {
            VERY_HIGH: bands.veryHigh,
            HIGH: bands.high,
            MEDIUM: bands.medium,
            LOW: bands.low,
            VERY_LOW: bands.safe + bands.unknown,
          },
        });
        setTambons(sorted.slice(0, 500));
      } catch (e) {
        console.error("Error loading static tambon flood GeoJSON:", e);
        if (!cancelled) {
          setTambons([]);
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, riskFilter, minProbability]);

  if (!visible) return null;

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-[1000]">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <div>
          <h3 className="font-bold text-black">Tambon flood risk</h3>
          <p className="text-xs text-gray-600">
            Static GeoJSON (same file as Folium layer)
          </p>
        </div>
      </div>

      {stats && (
        <div className="mb-4 space-y-2">
          <div className="text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-600">Polygons loaded</span>
              <span className="font-bold text-black">
                {stats.total_sub_districts.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            {Object.entries(RISK_COLORS).map(([level, color]) => {
              const count = stats.risk_distribution[level] || 0;
              const percent = stats.total_sub_districts
                ? ((count / stats.total_sub_districts) * 100).toFixed(1)
                : "0";

              return (
                <div key={level} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-gray-600 flex-1">
                    {level.replace(/_/g, " ")}
                  </span>
                  <span className="font-medium text-black">
                    {count.toLocaleString()} ({percent}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-red-600" />
          <h4 className="font-bold text-sm text-black">Highest risk (top 500)</h4>
        </div>

        {loading ? (
          <div className="text-center py-4 text-gray-500 text-sm">Loading…</div>
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
                    <div className="text-xs text-gray-500">
                      {tambon.risk_level}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t">
        <div className="text-xs text-gray-500">
          Source: <code className="text-[10px]">public/geojson/</code> — replace
          after offline export (Folium / geopandas). No backend API.
        </div>
      </div>
    </div>
  );
}
