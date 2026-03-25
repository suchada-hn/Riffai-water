"use client";

interface FloodRiskMapEmbedProps {
  visible: boolean;
}

export default function FloodRiskMapEmbed({ visible }: FloodRiskMapEmbedProps) {
  if (!visible) return null;

  return (
    <iframe
      src="/flood_risk_map_v2.html"
      title="Flood Risk Map"
      className="absolute inset-0 w-full h-full border-0 rounded-lg shadow-lg z-[400]"
    />
  );
}
