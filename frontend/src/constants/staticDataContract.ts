import { APP_TO_ONWR_BASIN } from "@/constants/onwrBasins";

export type DataMode = "backend" | "static";

export interface StaticDataContract {
  map: {
    basins: string;
    rivers: string;
    dams: string;
    waterLevelMap: string;
    subbasinsByBasin: (basinId: string) => string;
    tilesSummaryByBasin: (basinId?: string) => string;
  };
  onwr: {
    dates: (pipelineBasin: string) => string;
    stats: (pipelineBasin: string, dateIso: string) => string;
    national: string;
    latestAlerts: string;
  };
}

export const STATIC_DATA_DEFAULT_BASE = "/data";

export const STATIC_DATA_CONTRACT: StaticDataContract = {
  map: {
    basins: "/map/basins.geojson",
    rivers: "/map/rivers.geojson",
    dams: "/map/dams.geojson",
    waterLevelMap: "/map/water-level-map.geojson",
    subbasinsByBasin: (basinId) => `/map/subbasins/${basinId}.geojson`,
    tilesSummaryByBasin: (basinId) =>
      basinId
        ? `/map/tiles-summary/${basinId}.json`
        : "/map/tiles-summary/all.json",
  },
  onwr: {
    dates: (pipelineBasin) => `/onwr/${pipelineBasin}/dates.json`,
    stats: (pipelineBasin, dateIso) => `/onwr/${pipelineBasin}/${dateIso}.geojson`,
    national: "/onwr/thailand-subbasin-stats.geojson",
    latestAlerts: "/onwr/flood-alerts-latest.json",
  },
};

export function resolveDataMode(): DataMode {
  const mode = String(process.env.NEXT_PUBLIC_DATA_MODE || "backend").toLowerCase();
  return mode === "static" ? "static" : "backend";
}

export function staticDataBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_STATIC_DATA_BASE_URL || "").trim();
  if (!raw) return STATIC_DATA_DEFAULT_BASE;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function appBasinToPipelineOrNull(basinId?: string | null): string | null {
  if (!basinId) return null;
  return APP_TO_ONWR_BASIN[basinId] ?? null;
}

export function staticDataUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = staticDataBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
