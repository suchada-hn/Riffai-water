/**
 * Browser-facing HTTPS URLs for ONWR SAR stats laid out like GCS
 * `Model_Output_v2_Stats/{pipeline}/{year}/GeoJSON/SubBasin_ZScore_*.geojson`.
 *
 * Set `NEXT_PUBLIC_ONWR_PUBLIC_DATA_BASE` to the bucket root over HTTPS, e.g.
 * `https://storage.googleapis.com/onwr-data` (no trailing slash).
 *
 * Mirrors backend `onwr_stats_service._nested_subbasin_zscore_blob`.
 */

/** Same segment as backend `ONWR_STATS_PREFIX` default (without gs:// bucket). */
export const ONWR_MODEL_STATS_SEGMENT = "Model_Output_v2_Stats";

export function onwrPublicDataBaseUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_ONWR_PUBLIC_DATA_BASE || "").trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function isOnwrPublicGcsStatsEnabled(): boolean {
  return onwrPublicDataBaseUrl() !== null;
}

function statsPrefixWithSlash(): string {
  return ONWR_MODEL_STATS_SEGMENT.endsWith("/")
    ? ONWR_MODEL_STATS_SEGMENT
    : `${ONWR_MODEL_STATS_SEGMENT}/`;
}

/**
 * Object path relative to bucket root, e.g.
 * `Model_Output_v2_Stats/EastCoast/2026/GeoJSON/SubBasin_ZScore_EastCoast_2026_03_24.geojson`
 */
export function subBasinZScoreObjectPath(
  pipelineBasin: string,
  dateIso: string,
  defaultYear = 2026
): string {
  const parts = dateIso.split("-");
  let y: string;
  let mo: string;
  let d: string;
  if (
    parts.length === 3 &&
    parts.every((p) => p.length > 0 && /^\d+$/.test(p))
  ) {
    [y, mo, d] = parts;
  } else {
    y = String(defaultYear);
    mo = "01";
    d = "01";
  }
  return `${statsPrefixWithSlash()}${pipelineBasin}/${y}/GeoJSON/SubBasin_ZScore_${pipelineBasin}_${y}_${mo}_${d}.geojson`;
}

/** Manifest: `{ "dates": ["2026-03-24", ...] }` at `{stats}/{pipeline}/dates.json`. */
export function onwrPublicDatesJsonUrl(pipelineBasin: string): string {
  const base = onwrPublicDataBaseUrl();
  if (!base) {
    throw new Error("NEXT_PUBLIC_ONWR_PUBLIC_DATA_BASE is not set");
  }
  return `${base}/${statsPrefixWithSlash()}${pipelineBasin}/dates.json`;
}

export function onwrPublicSubBasinZScoreUrl(
  pipelineBasin: string,
  dateIso: string
): string {
  const base = onwrPublicDataBaseUrl();
  if (!base) {
    throw new Error("NEXT_PUBLIC_ONWR_PUBLIC_DATA_BASE is not set");
  }
  return `${base}/${subBasinZScoreObjectPath(pipelineBasin, dateIso)}`;
}
