"use client";

import MapHudShell, { type HudPosition } from "@/components/map/ui/MapHudShell";

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
  position?: HudPosition;
}

export default function FloodV3ValidationLegend({
  featureCount,
  loading,
  error,
  position = "bottomLeft",
}: Props) {
  return (
    <MapHudShell
      title="V3 Daily Validation"
      subtitle="Static confusion snapshot (TP/TN/FP/FN)"
      position={position}
      dense
    >
      <div className="text-[11px] text-primary-600 leading-relaxed mb-2 font-mono tabular-nums">
        CV AUC 0.9609 · TB AUC 0.9973 · threshold 0.2
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mb-2 font-mono tabular-nums text-primary-700">
        <span>TP 213</span>
        <span>FN 8</span>
        <span>FP 46</span>
        <span>TN 6096</span>
      </div>
      <div className="space-y-1.5">
        {V3_CONFUSION_COLORS.map(({ key, label, hex }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-primary-300 shrink-0" style={{ background: hex }} />
            <span className="text-primary-700">
              <strong className="text-primary-900 font-mono">{key}</strong> · {label}
            </span>
          </div>
        ))}
      </div>
      {loading && (
        <div className="mt-2 text-[11px] text-primary-600">Loading points...</div>
      )}
      {error && (
        <div className="mt-2 text-[11px] text-red-700">{error}</div>
      )}
      {featureCount != null && !loading && !error && (
        <div className="mt-2 text-[11px] text-primary-600 font-mono tabular-nums">
          {featureCount.toLocaleString()} tambon points
        </div>
      )}
    </MapHudShell>
  );
}
