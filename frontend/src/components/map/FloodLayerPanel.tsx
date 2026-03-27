"use client";

import type { CSSProperties } from "react";
import { zscoreToColor } from "@/lib/onwrSarZscore";

interface Props {
  dates: string[];
  selectedDate: string | null;
  onDateChange: (d: string) => void;
  loading: boolean;
  loadingDates: boolean;
  error: string | null;
  featureCount?: number;
  floodedCount?: number;
  /** e.g. "EastCoast" for subtitle */
  pipelineBasinLabel?: string;
}

export const SAR_FLOOD_LEGEND_STEPS: {
  range: string;
  label: string;
  z: number | null;
}[] = [
  { range: "Z < −5", label: "Extreme Flood", z: -6 },
  { range: "−5 ≤ Z < −3", label: "Flood Detected", z: -4 },
  { range: "−3 ≤ Z < −1.5", label: "Watch", z: -2 },
  { range: "−1.5 ≤ Z < 0", label: "Below Normal", z: -0.8 },
  { range: "0 ≤ Z < 1.5", label: "Normal", z: 0.7 },
  { range: "Z ≥ 1.5", label: "Above Normal / Dry", z: 2 },
  { range: "—", label: "No Data", z: null },
];

export default function FloodLayerPanel({
  dates,
  selectedDate,
  onDateChange,
  loading,
  loadingDates,
  error,
  featureCount,
  floodedCount,
  pipelineBasinLabel = "EastCoast",
}: Props) {
  const panelStyle: CSSProperties = {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1000,
    background: "rgba(15,23,42,0.93)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderRadius: 14,
    padding: "16px 18px",
    minWidth: 248,
    maxWidth: 284,
    boxShadow: "0 8px 40px rgba(0,0,0,0.55)",
    color: "#f1f5f9",
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 13,
    border: "1px solid rgba(99,102,241,0.3)",
    userSelect: "none",
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>
          🛰️
        </span>
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: "#e2e8f0",
              lineHeight: 1.2,
            }}
          >
            SAR Flood Detection
          </div>
          <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
            {pipelineBasinLabel} · Sentinel-1 VV Z-score
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            color: "#64748b",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 5,
          }}
        >
          Date
        </div>
        {loadingDates ? (
          <div style={{ color: "#818cf8", fontSize: 12, padding: "6px 0" }}>
            Loading available dates…
          </div>
        ) : dates.length === 0 ? (
          <div style={{ color: "#f87171", fontSize: 12 }}>No dates available</div>
        ) : (
          <select
            value={selectedDate ?? ""}
            onChange={(e) => onDateChange(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 8,
              background: "rgba(30,41,59,0.95)",
              color: "#e2e8f0",
              border: "1px solid rgba(99,102,241,0.45)",
              fontSize: 13,
              outline: "none",
              cursor: "pointer",
              appearance: "auto",
            }}
          >
            {[...dates].reverse().map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 11px",
            borderRadius: 8,
            marginBottom: 12,
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.25)",
          }}
        >
          <span style={{ color: "#818cf8", fontSize: 15 }} aria-hidden>
            ⟳
          </span>
          <span style={{ color: "#a5b4fc", fontSize: 12 }}>Fetching layer…</span>
        </div>
      )}
      {error && !loading && (
        <div
          style={{
            padding: "7px 11px",
            borderRadius: 8,
            marginBottom: 12,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {!loading && featureCount != null && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: 8,
              textAlign: "center",
              background: "rgba(30,41,59,0.8)",
              border: "1px solid rgba(99,102,241,0.2)",
            }}
          >
            <div
              style={{
                color: "#94a3b8",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Sub-basins
            </div>
            <div
              style={{
                color: "#e2e8f0",
                fontWeight: 700,
                fontSize: 18,
                marginTop: 2,
              }}
            >
              {featureCount}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: 8,
              textAlign: "center",
              background: "rgba(250,204,21,0.08)",
              border: "1px solid rgba(250,204,21,0.3)",
            }}
          >
            <div
              style={{
                color: "#fde68a",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Flooded
            </div>
            <div
              style={{
                color:
                  floodedCount && floodedCount > 0 ? "#facc15" : "#22c55e",
                fontWeight: 700,
                fontSize: 18,
                marginTop: 2,
              }}
            >
              {floodedCount ?? 0}
            </div>
          </div>
        </div>
      )}

      <div>
        <div
          style={{
            color: "#64748b",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Z-score Legend
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {SAR_FLOOD_LEGEND_STEPS.map(({ range, label, z }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  flexShrink: 0,
                  background: zscoreToColor(z),
                  border: "1px solid rgba(255,255,255,0.15)",
                  boxShadow:
                    z !== null && z < -3
                      ? `0 0 6px ${zscoreToColor(z)}88`
                      : undefined,
                }}
              />
              <div style={{ flex: 1 }}>
                <span style={{ color: "#cbd5e1", fontWeight: 600, fontSize: 12 }}>
                  {label}
                </span>
                <span style={{ color: "#475569", fontSize: 10, marginLeft: 5 }}>
                  {range}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid rgba(99,102,241,0.15)",
          color: "#475569",
          fontSize: 10,
          lineHeight: 1.5,
        }}
      >
        Source: ONWR pipeline · GCS bucket{" "}
        <code style={{ color: "#818cf8" }}>onwr-data</code>
        <br />
        Flood threshold: mean Z-score &lt; −3.0
      </div>
    </div>
  );
}
