"use client";

import { zscoreToColor } from "@/constants/onwrSarZscore";
import MapHudShell, { type HudPosition } from "@/components/map/ui/MapHudShell";

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
  position?: HudPosition;
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
  position = "topRight",
}: Props) {
  return (
    <MapHudShell
      title="SAR Flood Detection"
      subtitle={`${pipelineBasinLabel} · Sentinel-1 VV Z-score`}
      position={position}
    >
      <div className="space-y-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-600 mb-1">
            Date
          </div>
          {loadingDates ? (
            <div className="text-xs text-primary-600 py-1">Loading available dates...</div>
          ) : dates.length === 0 ? (
            <div className="text-xs text-red-700">No dates available</div>
          ) : (
            <select
              value={selectedDate ?? ""}
              onChange={(e) => onDateChange(e.target.value)}
              className="input-mono text-sm"
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
          <div className="px-3 py-2 rounded-mono border border-primary-200 bg-primary-50 text-primary-700">
            Fetching layer...
          </div>
        )}
        {error && !loading && (
          <div className="px-3 py-2 rounded-mono border border-red-200 bg-red-50 text-red-700">
            {error}
          </div>
        )}

        {!loading && featureCount != null && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-mono border border-primary-200 bg-primary-50 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-primary-600">Sub-basins</div>
              <div className="text-lg font-bold font-mono text-primary-900 tabular-nums">{featureCount}</div>
            </div>
            <div className="rounded-mono border border-primary-200 bg-primary-50 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-primary-600">Flooded</div>
              <div className="text-lg font-bold font-mono text-primary-900 tabular-nums">{floodedCount ?? 0}</div>
            </div>
          </div>
        )}

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-600 mb-2">
            Z-score Legend
          </div>
          <div className="space-y-1.5">
            {SAR_FLOOD_LEGEND_STEPS.map(({ range, label, z }) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className="w-3.5 h-3.5 rounded-mono shrink-0 border border-primary-300"
                  style={{ background: zscoreToColor(z) }}
                />
                <div className="text-primary-700">
                  <span className="font-medium text-xs">{label}</span>{" "}
                  <span className="text-[11px] font-mono text-primary-500">{range}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-primary-200 text-[11px] text-primary-600">
          Source: ONWR pipeline · GCS bucket <code className="text-primary-900">onwr-data</code>
          <br />
          Flood threshold: mean Z-score &lt; −3.0
        </div>
      </div>
    </MapHudShell>
  );
}
