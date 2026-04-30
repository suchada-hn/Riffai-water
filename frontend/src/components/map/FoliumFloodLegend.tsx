"use client";

import MapHudShell, { type HudPosition } from "@/components/map/ui/MapHudShell";
import type { FloodBandCounts } from "@/lib/floodStaticGeojson";

interface Props {
  featureCount?: number;
  bandCounts?: FloodBandCounts | null;
  position?: HudPosition;
}

const STEPS: {
  key: keyof Pick<
    FloodBandCounts,
    "veryHigh" | "high" | "medium" | "low" | "safe"
  >;
  shortLabel: string;
  rangeLabel: string;
  color: string;
}[] = [
  { key: "veryHigh", shortLabel: "Very High", rangeLabel: "80–100%", color: "#d73027" },
  { key: "high", shortLabel: "High", rangeLabel: "60–80%", color: "#fc8d59" },
  { key: "medium", shortLabel: "Medium", rangeLabel: "40–60%", color: "#fee08b" },
  { key: "low", shortLabel: "Low", rangeLabel: "20–40%", color: "#91cf60" },
  { key: "safe", shortLabel: "Safe", rangeLabel: "0–20%", color: "#1a9850" },
];

export default function FoliumFloodLegend({
  featureCount,
  bandCounts,
  position = "topCenter",
}: Props) {
  const showCounts = bandCounts && bandCounts.total > 0;

  return (
    <MapHudShell
      title="Flood forecast (static GeoJSON)"
      subtitle="Tambon polygons — no API; replace file in public/geojson to update"
      position={position}
      dense
    >
      <div className="text-[11px] text-primary-600 mb-2">
        Dark outlines; polygon fills use shared SVG gradients per risk band (not
        one gradient per polygon), tuned for OSM and Esri satellite basemaps.
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {STEPS.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: s.color,
                border: "1px solid rgba(0,0,0,0.35)",
                flexShrink: 0,
              }}
            />
            <span className="text-primary-800 text-[11px]">
              {showCounts ? (
                <span className="tabular-nums">
                  {s.shortLabel}:{" "}
                  <strong>{bandCounts![s.key].toLocaleString()}</strong>
                  <span className="text-primary-600 ml-0.5">({s.rangeLabel})</span>
                </span>
              ) : (
                <>
                  {s.shortLabel}{" "}
                  <span className="text-primary-600">({s.rangeLabel})</span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
      {showCounts && bandCounts!.unknown > 0 && (
        <div className="mt-1 text-[11px] text-primary-600">
          No data: {bandCounts!.unknown.toLocaleString()}
        </div>
      )}
      {showCounts && (
        <div className="mt-2 text-[11px] font-semibold text-primary-900 tabular-nums">
          Total: {bandCounts!.total.toLocaleString()}
        </div>
      )}
      {featureCount != null && (
        <div className="mt-1 text-[11px] text-primary-600 font-mono tabular-nums">
          Loaded polygons: {featureCount.toLocaleString()}
        </div>
      )}
    </MapHudShell>
  );
}
