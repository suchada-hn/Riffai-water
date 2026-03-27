"use client";

import type { CSSProperties } from "react";

/** External stats API uses snake_case keys; normalize for display */
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
}: Props) {
  const wrap: CSSProperties = {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 1000,
    maxWidth: "min(96vw, 720px)",
    pointerEvents: "none",
  };

  const inner: CSSProperties = {
    pointerEvents: "auto",
    background: "rgba(255,255,255,0.96)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    borderRadius: 10,
    padding: "10px 14px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
    border: "1px solid rgba(15,23,42,0.08)",
    fontFamily: "system-ui, sans-serif",
    fontSize: 12,
    color: "#0f172a",
  };

  const dist = stats?.risk_distribution;
  const totalNation =
    stats?.total_sub_districts ??
    stats?.total_tambons ??
    ROWS.reduce((s, r) => s + riskCount(dist, r.snake, r.upper), 0);

  return (
    <div style={wrap} className="map-tambon-flood-legend">
      <div style={inner}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 13,
            marginBottom: 6,
            letterSpacing: "0.02em",
          }}
        >
          Flood forecast — Tambon (XGBoost)
        </div>
        <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8 }}>
          14-day features · Terrain & history · Real forecast (operational model)
        </div>
        {loading ? (
          <div style={{ color: "#64748b" }}>Loading legend…</div>
        ) : error ? (
          <div style={{ color: "#b91c1c" }}>{error}</div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "8px 14px",
            }}
          >
            {ROWS.map((r) => (
              <div
                key={r.snake}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
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
                <span>
                  {r.label}:{" "}
                  <strong>{riskCount(dist, r.snake, r.upper).toLocaleString()}</strong>
                </span>
              </div>
            ))}
            <div
              style={{
                marginLeft: 4,
                paddingLeft: 12,
                borderLeft: "1px solid #e2e8f0",
                fontWeight: 600,
              }}
            >
              Total: {totalNation.toLocaleString()}
            </div>
            {featureCount != null && (
              <div style={{ color: "#64748b", fontSize: 11 }}>
                Points on map: {featureCount.toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
