"use client";

import MapHudShell, { type HudPosition } from "@/components/map/ui/MapHudShell";

interface Props {
  featureCount?: number;
  position?: HudPosition;
}

const STEPS = [
  { label: "Very High (80-100%)", color: "#d73027" },
  { label: "High (60-80%)", color: "#fc8d59" },
  { label: "Medium (40-60%)", color: "#fee08b" },
  { label: "Low (20-40%)", color: "#91cf60" },
  { label: "Very Low (0-20%)", color: "#1a9850" },
];

export default function FoliumFloodLegend({ featureCount, position = "topCenter" }: Props) {
  return (
    <MapHudShell
      title="Folium Flood Probability"
      subtitle="High-contrast choropleth mode"
      position={position}
      dense
    >
      <div className="text-[11px] text-primary-600 mb-2">
        Dark outlines + stronger fill opacity for visibility on OSM and satellite base maps.
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {STEPS.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
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
            <span className="text-primary-800 text-[11px]">{s.label}</span>
          </div>
        ))}
      </div>
      {featureCount != null && (
        <div className="mt-2 text-[11px] text-primary-600 font-mono tabular-nums">
          Loaded polygons: {featureCount.toLocaleString()}
        </div>
      )}
    </MapHudShell>
  );
}

