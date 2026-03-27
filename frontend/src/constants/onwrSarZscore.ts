/** SAR sub-basin choropleth: yellow → green → teal → blue → purple (no data = gray) */
export function zscoreToColor(z: number | null | undefined): string {
  if (z === null || z === undefined || Number.isNaN(Number(z))) return "#9ca3af";
  const v = Number(z);
  if (v < -5) return "#facc15";
  if (v < -3) return "#22c55e";
  if (v < -1.5) return "#0d9488";
  if (v < 0) return "#3b82f6";
  if (v < 1.5) return "#6366f1";
  return "#7c3aed";
}

export function zscoreToLabel(z: number | null | undefined): string {
  if (z === null || z === undefined || Number.isNaN(Number(z))) return "No data";
  const v = Number(z);
  if (v < -5) return "Extreme Flood";
  if (v < -3) return "Flood Detected";
  if (v < -1.5) return "Watch";
  if (v < 0) return "Below Normal";
  if (v < 1.5) return "Normal";
  return "Above Normal / Dry";
}
