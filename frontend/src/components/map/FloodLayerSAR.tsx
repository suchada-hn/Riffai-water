"use client";

import { useCallback, useEffect } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import type { GeoJSONFeatureCollection } from "@/types";
import { zscoreToColor, zscoreToLabel } from "@/constants/onwrSarZscore";

export { zscoreToColor, zscoreToLabel } from "@/constants/onwrSarZscore";

function SarFitBounds({ data }: { data: GeoJSONFeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    if (!data?.features?.length) return;
    const layer = L.geoJSON(data as unknown as GeoJSON.GeoJSON);
    try {
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [40, 40], duration: 1.2, maxZoom: 9 });
      }
    } finally {
      layer.remove();
    }
  }, [data, map]);
  return null;
}

interface Props {
  geojson: GeoJSONFeatureCollection;
  date: string;
  onFeatureClick?: (props: Record<string, unknown>) => void;
}

export default function FloodLayerSAR({ geojson, date, onFeatureClick }: Props) {
  const styleFn = useCallback((feature: GeoJSON.Feature | undefined) => {
    const z = feature?.properties?.mean_z_score;
    const flooded = !!feature?.properties?.flood_detected;
    const color = zscoreToColor(
      z as number | null | undefined
    );
    return {
      fillColor: color,
      fillOpacity: 0.72,
      color: flooded ? "#ffffff" : "#e5e7eb",
      weight: flooded ? 2 : 0.8,
      dashArray: flooded ? undefined : ("3 2" as const),
    };
  }, []);

  const onEach = useCallback(
    (feature: GeoJSON.Feature, layer: L.Layer) => {
      const p = (feature.properties || {}) as Record<string, unknown>;
      const z =
        p.mean_z_score != null ? Number(p.mean_z_score).toFixed(3) : "N/A";
      const flooded = !!p.flood_detected;
      const name =
        String(p.NAME || p.name || p.SUB_NAME || p.HYBAS_ID || "Sub-basin");
      const fc =
        p.flood_pixel_count != null
          ? Number(p.flood_pixel_count).toLocaleString()
          : "N/A";
      const thr = p.z_flood_threshold ?? -3.0;

      layer.bindPopup(
        `<div style="min-width:200px;font-family:sans-serif;">
            <div style="font-weight:700;font-size:14px;margin-bottom:6px;
                        border-bottom:2px solid ${zscoreToColor(p.mean_z_score as number)};padding-bottom:4px;">
              ${name}
            </div>
            <table style="width:100%;font-size:12px;border-collapse:collapse;">
              <tr><td style="color:#6b7280;padding:2px 4px;">Date</td>
                  <td style="padding:2px 4px;font-weight:600;">${String(p.date || date)}</td></tr>
              <tr><td style="color:#6b7280;padding:2px 4px;">Mean Z-score</td>
                  <td style="padding:2px 4px;font-weight:600;color:${zscoreToColor(p.mean_z_score as number)}">${z}</td></tr>
              <tr><td style="color:#6b7280;padding:2px 4px;">Status</td>
                  <td style="padding:2px 4px;font-weight:600;">
                    ${flooded ? '<span style="color:#facc15;">Flood Detected</span>' : `<span style="color:#22c55e;">${zscoreToLabel(p.mean_z_score as number)}</span>`}
                  </td></tr>
              <tr><td style="color:#6b7280;padding:2px 4px;">Flood Pixels</td>
                  <td style="padding:2px 4px;">${fc}</td></tr>
              <tr><td style="color:#6b7280;padding:2px 4px;">HYBAS ID</td>
                  <td style="padding:2px 4px;">${String(p.HYBAS_ID ?? "—")}</td></tr>
            </table>
            <div style="margin-top:6px;font-size:10px;color:#9ca3af;">
              Threshold: Z &lt; ${thr} → flood | Sentinel-1 SAR VV
            </div>
          </div>`,
        { maxWidth: 280 }
      );

      const path = layer as L.Path;
      layer.on("add", () => {
        const el = path.getElement?.();
        if (el && flooded) el.classList.add("sar-flood-pulse");
      });

      layer.on({
        mouseover(e) {
          (e.target as L.Path).setStyle({
            fillOpacity: 0.92,
            weight: 2.5,
            color: "#fff",
          });
          (e.target as L.Path).bringToFront();
        },
        mouseout(e) {
          const target = e.target as L.Path;
          const fz = p.mean_z_score;
          const ff = !!p.flood_detected;
          target.setStyle({
            fillOpacity: 0.72,
            weight: ff ? 2 : 0.8,
            color: ff ? "#ffffff" : "#e5e7eb",
            fillColor: zscoreToColor(fz as number),
            dashArray: ff ? undefined : "3 2",
          });
        },
        click() {
          onFeatureClick?.(p);
        },
      });
    },
    [date, onFeatureClick]
  );

  return (
    <>
      <SarFitBounds data={geojson} />
      <GeoJSON
        key={`${date}-${geojson.features?.length ?? 0}`}
        data={geojson}
        style={styleFn}
        onEachFeature={onEach}
      />
    </>
  );
}
