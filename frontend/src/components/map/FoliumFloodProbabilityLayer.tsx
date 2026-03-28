"use client";

/**
 * Loads static tambon flood polygons from `public/geojson/`. No backend.
 * Replace `STATIC_FLOOD_GEOJSON_URL` file after offline Folium/geopandas export.
 */

import { useEffect, useMemo, useState } from "react";
import { GeoJSON } from "react-leaflet";
import L from "leaflet";
import type { GeoJSONFeatureCollection } from "@/types";
import {
  STATIC_FLOOD_GEOJSON_URL,
  aggregateBandCounts,
  colorForFloodPct,
  floodProbabilityPercent,
} from "@/lib/floodStaticGeojson";

type FeatureProps = Record<string, unknown>;

export interface FoliumFloodLoadPayload {
  featureCount: number;
  bandCounts: ReturnType<typeof aggregateBandCounts>;
}

interface Props {
  visible: boolean;
  onLoaded?: (payload: FoliumFloodLoadPayload) => void;
}

export default function FoliumFloodProbabilityLayer({
  visible,
  onLoaded,
}: Props) {
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!visible || hasFetched) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(STATIC_FLOOD_GEOJSON_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as GeoJSONFeatureCollection;
        if (!cancelled) {
          setGeojson(data);
          setHasFetched(true);
        }
      } catch {
        if (!cancelled) {
          setGeojson(null);
          setHasFetched(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, hasFetched]);

  useEffect(() => {
    if (!onLoaded) return;
    if (!visible) {
      onLoaded({
        featureCount: 0,
        bandCounts: aggregateBandCounts(null),
      });
      return;
    }
    if (!geojson?.features?.length) {
      onLoaded({
        featureCount: 0,
        bandCounts: aggregateBandCounts(null),
      });
      return;
    }
    onLoaded({
      featureCount: geojson.features.length,
      bandCounts: aggregateBandCounts(geojson),
    });
  }, [visible, geojson, onLoaded]);

  const layerData = useMemo(() => {
    if (!visible || !geojson?.features?.length) return null;
    return geojson;
  }, [visible, geojson]);

  if (!layerData) return null;

  return (
    <GeoJSON
      key={`folium-flood-layer-${layerData.features.length}`}
      data={layerData}
      style={(feature) => {
        const p = (feature?.properties || {}) as FeatureProps;
        const prob = floodProbabilityPercent(p);
        return {
          color: "#1f2937",
          weight: 1.2,
          opacity: 0.95,
          fillColor: colorForFloodPct(prob),
          fillOpacity: 0.72,
        } as L.PathOptions;
      }}
      onEachFeature={(feature, layer) => {
        const p = (feature.properties || {}) as FeatureProps;
        const prob = floodProbabilityPercent(p);
        const probText = prob == null ? "—" : `${prob.toFixed(1)}%`;
        const rank = p.rank != null ? String(p.rank) : "—";
        const freq = p.freq != null ? String(p.freq) : "—";
        const actual = p.actual != null ? String(p.actual) : "—";

        layer.bindPopup(`
          <div class="text-sm min-w-[240px]">
            <div class="font-bold text-slate-900 border-b pb-1 mb-2">${String(p.tb_tn ?? "—")}</div>
            <div class="text-xs text-slate-600">${String(p.ap_tn ?? "")} · ${String(p.pv_tn ?? "")}</div>
            <div class="mt-2 font-mono text-xs">Flood Prob (%): <strong>${probText}</strong></div>
            <div class="font-mono text-xs">Risk Rank: ${rank}</div>
            <div class="font-mono text-xs">Avg Freq: ${freq}</div>
            <div class="font-mono text-xs">Actual 2024: ${actual}</div>
            <div class="font-mono text-xs text-slate-500 mt-1">tb_idn: ${String(p.tb_idn ?? "—")}</div>
          </div>
        `);

        layer.on({
          mouseover: (e: { target: L.Path }) => {
            const target = e.target;
            target.setStyle({
              weight: 2.2,
              fillOpacity: 0.82,
            });
          },
          mouseout: (e: { target: L.Path }) => {
            const target = e.target;
            target.setStyle({
              weight: 1.2,
              fillOpacity: 0.72,
            });
          },
        });
      }}
    />
  );
}
