"use client";

import MapHudShell, { type HudPosition } from "@/components/map/ui/MapHudShell";

export type HeatmapRiskLevel = "safe" | "normal" | "watch" | "warning" | "critical";

export const HEATMAP_RISK_COLORS: Record<HeatmapRiskLevel, string> = {
  safe: "#10b981",
  normal: "#84cc16",
  watch: "#eab308",
  warning: "#f97316",
  critical: "#ef4444",
};

export const HEATMAP_RISK_LABELS_TH: Record<HeatmapRiskLevel, string> = {
  safe: "ปลอดภัย",
  normal: "ปกติ",
  watch: "เฝ้าระวัง",
  warning: "เตือนภัย",
  critical: "วิกฤต",
};

export interface HeatmapTileLite {
  id: string;
  center: [number, number];
  riskLevel: string;
  provinces?: string[];
  stats?: {
    populationAtRisk?: number;
    avgWaterLevel?: number;
    rainfall24h?: number;
    stationCount?: number;
  };
}

export default function FloodRiskHeatmapPanel(props: {
  position?: HudPosition;
  basinId?: string | null;
  tileSummary: {
    totalTiles?: number;
    riskCounts?: Partial<Record<HeatmapRiskLevel, number>> & { watch?: number; safe?: number; normal?: number };
    totalPopulationAtRisk?: number;
  } | null;
  topTiles: HeatmapTileLite[];
  onFocusTile: (center: [number, number]) => void;
  basemapMode: "light" | "imagery";
}) {
  const {
    position = "inline",
    basinId,
    tileSummary,
    topTiles,
    onFocusTile,
    basemapMode,
  } = props;

  const riskCounts = tileSummary?.riskCounts || {};

  return (
    <MapHudShell
      title="Flood Risk Heatmap"
      subtitle={[
        basinId ? `basin=${basinId}` : "all basins",
        basemapMode === "imagery" ? "imagery basemap" : "OSM basemap",
      ].join(" · ")}
      position={position}
      dense
    >
      <div className="space-y-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-600 mb-2">
            Legend
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            {(Object.keys(HEATMAP_RISK_COLORS) as HeatmapRiskLevel[]).map((k) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-primary-300 shrink-0"
                    style={{ background: HEATMAP_RISK_COLORS[k] }}
                  />
                  <span className="text-primary-800 truncate">{HEATMAP_RISK_LABELS_TH[k]}</span>
                </span>
                <span className="font-mono tabular-nums text-primary-900">
                  {(riskCounts as any)?.[k] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-mono border border-primary-200 bg-primary-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-primary-600">
              Tiles
            </div>
            <div className="text-base font-bold font-mono tabular-nums text-primary-900">
              {(tileSummary?.totalTiles ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded-mono border border-primary-200 bg-primary-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-primary-600">
              Population at risk
            </div>
            <div className="text-base font-bold font-mono tabular-nums text-primary-900">
              ~{(tileSummary?.totalPopulationAtRisk ?? 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-600 mb-2">
            Top tiles (population at risk)
          </div>
          {topTiles.length === 0 ? (
            <div className="text-[11px] text-primary-600">
              Zoom in and click a tile to explore details.
            </div>
          ) : (
            <div className="space-y-1">
              {topTiles.slice(0, 10).map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onFocusTile(t.center)}
                  className="w-full text-left px-2 py-1.5 rounded-mono border border-primary-200 bg-white hover:bg-primary-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-primary-900 font-medium truncate">
                      #{i + 1}{" "}
                      {t.provinces?.[0]
                        ? t.provinces.slice(0, 2).join(", ")
                        : "Tile"}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-primary-900">
                      ~{Number(t.stats?.populationAtRisk ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-primary-600 font-mono truncate">
                    {String(t.riskLevel || "").toUpperCase()} · stations{" "}
                    {Number(t.stats?.stationCount ?? 0)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </MapHudShell>
  );
}

