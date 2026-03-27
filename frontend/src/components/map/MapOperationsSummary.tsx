"use client";

import { RefreshCw } from "lucide-react";
import { GeoJSONFeatureCollection } from "@/types";

interface OnwrAlert {
  pipeline_basin: string;
  app_basin_id?: string;
  HYBAS_ID?: number;
  name?: string;
  date: string;
  mean_z_score?: number;
}

interface MapOperationsSummaryProps {
  onwrAlerts: OnwrAlert[];
  tileSummary: {
    totalTiles?: number;
    riskCounts?: {
      critical?: number;
      warning?: number;
      watch?: number;
      safe?: number;
    };
    totalPopulationAtRisk?: number;
  } | null;
  waterLevels: GeoJSONFeatureCollection | null;
  lastUpdate: Date;
  onRefresh: () => void;
  loading?: boolean;
}

function countRisk(fc: GeoJSONFeatureCollection | null, risk: string) {
  return fc?.features?.filter((f) => f.properties?.risk_level === risk).length ?? 0;
}

export default function MapOperationsSummary({
  onwrAlerts,
  tileSummary,
  waterLevels,
  lastUpdate,
  onRefresh,
  loading = false,
}: MapOperationsSummaryProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-600">Operations Summary</h3>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary-600">
          SAR flood anomalies (latest pass)
        </div>
        <div className="max-h-40 overflow-y-auto space-y-1 text-xs border border-primary-200 rounded-mono p-2 bg-primary-50/70">
          {loading && onwrAlerts.length === 0 ? (
            <span className="text-primary-600">Loading latest anomalies...</span>
          ) : onwrAlerts.length === 0 ? (
            <span className="text-primary-600">No sub-basin alerts or data not loaded.</span>
          ) : (
            onwrAlerts.slice(0, 40).map((a, i) => (
              <div
                key={`${a.HYBAS_ID}-${a.date}-${i}`}
                className="flex justify-between gap-2 py-1 border-b border-primary-200 last:border-0"
              >
                <span className="truncate text-primary-800">
                  {a.name || `HYBAS ${a.HYBAS_ID}`}
                  <span className="text-primary-500 font-mono ml-1">{a.pipeline_basin}</span>
                </span>
                <span className="font-mono shrink-0 text-primary-900 tabular-nums">
                  z={a.mean_z_score?.toFixed(2) ?? "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-3 rounded-mono border border-primary-200 bg-primary-50">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary-700 mb-2">Legend</div>
        <div className="text-xs font-medium text-primary-700 mb-2">Water Level Status</div>
        <div className="space-y-2">
          {[
            { color: "bg-primary-300", label: "Normal", range: "< 3.0 m" },
            { color: "bg-primary-500", label: "Watch", range: "3.0 - 4.0 m" },
            { color: "bg-primary-700", label: "Warning", range: "4.0 - 4.5 m" },
            { color: "bg-primary-900", label: "Critical", range: "> 4.5 m" },
          ].map(({ color, label, range }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 ${color}`} />
                <span className="text-xs text-primary-700 font-medium">{label}</span>
              </div>
              <span className="text-xs text-primary-500 font-mono">{range}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh map operational data"
        className="w-full btn-mono text-sm flex items-center justify-center gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        Refresh Data
      </button>

      <div className="p-3 rounded-mono border border-primary-200 bg-primary-50">
        <div className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-2">Heatmap Summary</div>
        {loading && !tileSummary ? (
          <div className="text-xs text-primary-600">Loading heatmap summary...</div>
        ) : tileSummary ? (
          <div className="space-y-2 text-sm text-primary-700">
            <div className="flex justify-between">
              <span>Grid Tiles</span>
              <strong className="font-mono tabular-nums text-primary-900">
                {(tileSummary.totalTiles ?? 0).toLocaleString()}
              </strong>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>{tileSummary.riskCounts?.critical ?? 0} Critical</div>
              <div>{tileSummary.riskCounts?.warning ?? 0} Warning</div>
              <div>{tileSummary.riskCounts?.watch ?? 0} Watch</div>
              <div>{tileSummary.riskCounts?.safe ?? 0} Safe</div>
            </div>
            <div className="pt-2 border-t border-primary-200">
              <div className="text-xs text-primary-600">Population at Risk</div>
              <div className="text-base font-bold font-mono tabular-nums text-primary-900">
                ~{(tileSummary.totalPopulationAtRisk ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-primary-600">Heatmap summary not available.</div>
        )}
      </div>

      <div className="p-3 rounded-mono border border-primary-200 bg-primary-50">
        <div className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-2">Summary</div>
        {loading && !waterLevels ? (
          <div className="text-xs text-primary-600">Loading water level summary...</div>
        ) : waterLevels ? (
          <div className="space-y-1 text-sm text-primary-700">
            <div className="flex justify-between">
              <span>Stations</span>
              <strong className="font-mono tabular-nums text-primary-900">
                {(waterLevels.features?.length ?? 0).toLocaleString()}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Critical</span>
              <strong className="font-mono tabular-nums text-primary-900">{countRisk(waterLevels, "critical")}</strong>
            </div>
            <div className="flex justify-between">
              <span>Warning</span>
              <strong className="font-mono tabular-nums text-primary-900">{countRisk(waterLevels, "warning")}</strong>
            </div>
            <div className="flex justify-between">
              <span>Watch</span>
              <strong className="font-mono tabular-nums text-primary-900">{countRisk(waterLevels, "watch")}</strong>
            </div>
          </div>
        ) : (
          <div className="text-xs text-primary-600">Water level summary not available.</div>
        )}
      </div>

      <div className="p-3 rounded-mono border border-primary-200 bg-primary-50" aria-live="polite">
        <div className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-1">Last Update</div>
        <div className="text-sm text-primary-700 font-mono tabular-nums">
          {lastUpdate.toLocaleString("th-TH", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </div>
      </div>

      <div className="p-3 rounded-mono border border-primary-200 bg-primary-50 text-xs text-primary-700">
        <strong>Tip:</strong> Click on markers for detailed information. Use layer controls to toggle different data
        views.
      </div>
    </section>
  );
}
