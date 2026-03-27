"use client";

import { useEffect, useMemo, useState } from "react";
import { GeoJSON } from "react-leaflet";
import L from "leaflet";
import type { GeoJSONFeatureCollection } from "@/types";

type AnyProps = Record<string, unknown>;

const BAND_COLORS: { min: number; max: number; color: string }[] = [
  { min: 80, max: 100, color: "#d73027" }, // Very High
  { min: 60, max: 80, color: "#fc8d59" }, // High
  { min: 40, max: 60, color: "#fee08b" }, // Medium
  { min: 20, max: 40, color: "#91cf60" }, // Low
  { min: 0, max: 20, color: "#1a9850" }, // Very Low
];

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function probPctFromProps(p: AnyProps): number | null {
  const direct = toNumber(p.prob_pct);
  if (direct != null) return direct;
  const fp = toNumber(p.flood_percent);
  if (fp != null) return fp;
  const prob = toNumber(p.flood_probability);
  if (prob == null) return null;
  return prob <= 1 ? prob * 100 : prob;
}

function colorForProbPct(probPct: number | null): string {
  if (probPct == null) return "#94a3b8";
  const v = Math.max(0, Math.min(100, probPct));
  for (const b of BAND_COLORS) {
    if (v >= b.min && v <= b.max) return b.color;
  }
  return "#94a3b8";
}

export default function TambonFloodPolygons({ visible }: { visible: boolean }) {
  const [fc, setFc] = useState<GeoJSONFeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const res = await fetch("/geojson/tambon_flood_probability_polygons.geojson");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as GeoJSONFeatureCollection;
        if (!cancelled) setFc(json);
      } catch (e) {
        if (!cancelled) {
          setFc(null);
          setError(e instanceof Error ? e.message : "Failed to load polygons");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const geojson = useMemo(() => {
    if (!fc?.features?.length) return null;
    return fc;
  }, [fc]);

  if (!visible || !geojson) return null;
  if (error) return null;

  return (
    <GeoJSON
      key={`tambon-polygons-${geojson.features.length}`}
      data={geojson}
      style={(feature) => {
        const p = ((feature as any)?.properties || {}) as AnyProps;
        const pct = probPctFromProps(p);
        const fill = colorForProbPct(pct);
        return {
          color: "rgba(51,51,51,0.9)",
          weight: 0.5,
          fillColor: fill,
          fillOpacity: 0.65,
        } as L.PathOptions;
      }}
      onEachFeature={(feature, layer) => {
        const p = ((feature as any)?.properties || {}) as AnyProps;
        const tb = String(p.tb_tn ?? "—");
        const ap = String(p.ap_tn ?? "");
        const pv = String(p.pv_tn ?? "");
        const pct = probPctFromProps(p);
        const pctStr = pct == null ? "—" : pct.toFixed(1);
        const rank = p.rank != null ? String(p.rank) : "—";
        const freq = p.freq != null ? String(p.freq) : "—";
        const actual = p.actual != null ? String(p.actual) : "—";
        const tbIdn = p.tb_idn != null ? String(p.tb_idn) : "—";

        layer.bindPopup(`
          <div class="text-sm min-w-[240px]">
            <div class="font-bold text-slate-900 border-b pb-1 mb-2">${tb}</div>
            <div class="text-xs text-slate-600">${ap} · ${pv}</div>
            <div class="mt-2 font-mono text-xs">Flood %: <strong>${pctStr}%</strong></div>
            <div class="font-mono text-xs">Risk rank: ${rank}</div>
            <div class="font-mono text-xs">Avg freq: ${freq}</div>
            <div class="font-mono text-xs">Actual 2024: ${actual}</div>
            <div class="font-mono text-xs text-slate-500 mt-1">tb_idn: ${tbIdn}</div>
          </div>
        `);

        layer.on({
          mouseover: (e: any) => {
            const t = e.target as L.Path;
            t.setStyle({ weight: 2, fillOpacity: 0.78 });
          },
          mouseout: (e: any) => {
            const t = e.target as L.Path;
            t.setStyle({ weight: 0.5, fillOpacity: 0.65 });
          },
        });
      }}
    />
  );
}

