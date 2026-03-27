"use client";

import MapHudShell, { type HudPosition } from "@/components/map/ui/MapHudShell";

function riskCount(
  dist: Record<string, unknown> | undefined,
  snake: string,
  upper: string
): number {
  if (!dist) return 0;
  const v = dist[snake] ?? dist[upper];
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

interface Props {
  loading: boolean;
  error: string | null;
  featureCount?: number;
  stats: {
    total_sub_districts?: number;
    total_tambons?: number;
    risk_distribution?: Record<string, unknown>;
  } | null;
  position?: HudPosition;
}

const ROWS: { snake: string; upper: string; label: string; color: string }[] = [
  { snake: "very_high", upper: "VERY_HIGH", label: "Very High", color: "#d73027" },
  { snake: "high", upper: "HIGH", label: "High", color: "#fc8d59" },
  { snake: "medium", upper: "MEDIUM", label: "Medium", color: "#fee08b" },
  { snake: "low", upper: "LOW", label: "Low", color: "#91cf60" },
  { snake: "very_low", upper: "VERY_LOW", label: "Safe", color: "#1a9850" },
];

export default function TambonFloodMapLegend({
  loading,
  error,
  featureCount,
  stats,
  position = "topCenter",
}: Props) {
  const dist = stats?.risk_distribution;
  const totalNation =
    stats?.total_sub_districts ??
    stats?.total_tambons ??
    ROWS.reduce((s, r) => s + riskCount(dist, r.snake, r.upper), 0);

  return (
    <MapHudShell
      title="Tambon Flood Prediction"
      subtitle="XGBoost operational forecast"
      position={position}
      dense
    >
      <div className="text-[11px] text-primary-600 mb-2">
        14-day features · Terrain/history · Zoom in for polygon choropleth
      </div>
      {loading ? (
        <div className="text-primary-600">Loading legend...</div>
      ) : error ? (
        <div className="text-red-700">{error}</div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {ROWS.map((r) => (
            <div key={r.snake} className="flex items-center gap-1.5">
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: r.color,
                  border: "1px solid rgba(0,0,0,0.15)",
                  flexShrink: 0,
                }}
              />
              <span className="text-primary-700">
                {r.label}:{" "}
                <strong className="font-mono tabular-nums text-primary-900">
                  {riskCount(dist, r.snake, r.upper).toLocaleString()}
                </strong>
              </span>
            </div>
          ))}
          <div className="ml-1 pl-3 border-l border-primary-200 font-semibold text-primary-900 font-mono tabular-nums">
            Total: {totalNation.toLocaleString()}
          </div>
          {featureCount != null && (
            <div className="text-[11px] text-primary-600 font-mono tabular-nums">
              Points on map: {featureCount.toLocaleString()}
            </div>
          )}
        </div>
      )}
    </MapHudShell>
  );
}
