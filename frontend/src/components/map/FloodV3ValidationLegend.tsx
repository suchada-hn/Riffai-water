"use client";

import type { CSSProperties } from "react";

export const V3_CONFUSION_COLORS: { key: string; label: string; hex: string }[] = [
  { key: "TP", label: "True positive", hex: "#2ecc71" },
  { key: "TN", label: "True negative", hex: "#3498db" },
  { key: "FP", label: "False positive", hex: "#f39c12" },
  { key: "FN", label: "False negative", hex: "#e74c3c" },
];

interface Props {
  featureCount?: number;
  loading?: boolean;
  error?: string | null;
}

export default function FloodV3ValidationLegend({
  featureCount,
  loading,
  error,
}: Props) {
  const panelStyle: CSSProperties = {
    position: "absolute",
    bottom: 16,
    left: 16,
    zIndex: 1000,
    background: "rgba(15,23,42,0.93)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderRadius: 14,
    padding: "14px 16px",
    minWidth: 240,
    maxWidth: 300,
    boxShadow: "0 8px 40px rgba(0,0,0,0.55)",
    color: "#f1f5f9",
    fontFamily: "system-ui, sans-serif",
    fontSize: 12,
    border: "1px solid rgba(99,102,241,0.3)",
    userSelect: "none",
  };

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginBottom: 8 }}>
        V3 daily validation
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.45, marginBottom: 10 }}>
        CV AUC 0.9609 · TB AUC 0.9973 · threshold 0.2
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px 12px",
          fontSize: 11,
          marginBottom: 10,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <span>TP 213</span>
        <span>FN 8</span>
        <span>FP 46</span>
        <span>TN 6096</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {V3_CONFUSION_COLORS.map(({ key, label, hex }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: hex,
                flexShrink: 0,
                boxShadow: "0 0 0 1px rgba(255,255,255,0.2)",
              }}
            />
            <span style={{ color: "#cbd5e1" }}>
              <strong style={{ color: "#f8fafc" }}>{key}</strong> · {label}
            </span>
          </div>
        ))}
      </div>
      {loading && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>Loading points…</div>
      )}
      {error && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#fca5a5" }}>{error}</div>
      )}
      {featureCount != null && !loading && !error && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
          {featureCount.toLocaleString()} tambon points
        </div>
      )}
    </div>
  );
}
