"use client";

/**
 * Loads static tambon flood polygons from `public/geojson/`. No backend.
 * Shared SVG band gradients + basin-style tooltips/popups (globals.css).
 */

import { useEffect, useMemo, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import type { GeoJSONFeatureCollection } from "@/types";
import {
  STATIC_FLOOD_GEOJSON_URL,
  aggregateBandCounts,
  bandFromPct,
  colorForFloodPct,
  floodBandGradientStops,
  floodBandShortLabel,
  floodGradientDomId,
  floodProbabilityPercent,
  type FloodBandKey,
} from "@/lib/floodStaticGeojson";
import { escapeHtml, mapPopupRow } from "@/lib/mapLeafletHtml";

const ALL_FLOOD_BANDS: FloodBandKey[] = [
  "veryHigh",
  "high",
  "medium",
  "low",
  "safe",
  "unknown",
];

const FLOOD_STROKE = "#171717";
const FLOOD_WEIGHT = 1.25;
const FLOOD_OPACITY = 0.9;
const FLOOD_FILL_OPACITY = 1;
const FLOOD_HOVER_WEIGHT = 2.2;
const FLOOD_HOVER_FILL_OPACITY = 0.92;

type FeatureProps = Record<string, unknown>;

export interface FoliumFloodLoadPayload {
  featureCount: number;
  bandCounts: ReturnType<typeof aggregateBandCounts>;
}

interface Props {
  visible: boolean;
  onLoaded?: (payload: FoliumFloodLoadPayload) => void;
}

function ensureFloodLinearGradient(
  svg: SVGSVGElement,
  gradId: string,
  hexStops: string[],
) {
  if (svg.querySelector(`#${CSS.escape(gradId)}`)) return;

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  const lg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "linearGradient",
  );
  lg.setAttribute("id", gradId);
  lg.setAttribute("gradientUnits", "objectBoundingBox");
  lg.setAttribute("x1", "0");
  lg.setAttribute("y1", "0");
  lg.setAttribute("x2", "0.72");
  lg.setAttribute("y2", "1");

  const n = hexStops.length;
  hexStops.forEach((color, i) => {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    const offset = n === 1 ? "0%" : `${(i / (n - 1)) * 100}%`;
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    const op = i === 0 ? "0.88" : i === n - 1 ? "0.98" : "0.94";
    stop.setAttribute("stop-opacity", op);
    lg.appendChild(stop);
  });
  defs.appendChild(lg);
}

function ensureAllFloodBandGradients(svg: SVGSVGElement) {
  for (const band of ALL_FLOOD_BANDS) {
    ensureFloodLinearGradient(
      svg,
      floodGradientDomId(band),
      floodBandGradientStops(band),
    );
  }
}

/** Idempotent shared defs on the overlay SVG (small fixed set, not per feature). */
function FoliumFloodGradientDefs({ visible }: { visible: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!visible) return;

    const inject = () => {
      const pane = map.getPane("overlayPane");
      const svg = pane?.querySelector("svg") as SVGSVGElement | undefined;
      if (svg) ensureAllFloodBandGradients(svg);
    };

    inject();
    const raf = requestAnimationFrame(inject);
    const t = window.setTimeout(inject, 0);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [map, visible]);

  return null;
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
    <>
      <FoliumFloodGradientDefs visible={visible} />
      <GeoJSON
        key={`folium-flood-layer-${layerData.features.length}`}
        data={layerData}
        style={(feature) => {
          const p = (feature?.properties || {}) as FeatureProps;
          const prob = floodProbabilityPercent(p);
          return {
            color: FLOOD_STROKE,
            weight: FLOOD_WEIGHT,
            opacity: FLOOD_OPACITY,
            fillColor: colorForFloodPct(prob),
            fillOpacity: 0.85,
          } as L.PathOptions;
        }}
        onEachFeature={(feature, layer) => {
          const p = (feature.properties || {}) as FeatureProps;
          const prob = floodProbabilityPercent(p);
          const band = bandFromPct(prob);
          const gradId = floodGradientDomId(band);
          const probText = prob == null ? "—" : `${prob.toFixed(1)}%`;
          const rank = p.rank != null ? String(p.rank) : "—";
          const freq = p.freq != null ? String(p.freq) : "—";
          const actual = p.actual != null ? String(p.actual) : "—";
          const tbName = String(p.tb_tn ?? "—");
          const ap = String(p.ap_tn ?? "");
          const pv = String(p.pv_tn ?? "");
          const locLine = [ap, pv].filter(Boolean).join(" · ");

          layer.on("add", () => {
            const path = layer as L.Path;
            const el = path.getElement?.() as SVGElement | undefined;
            const svg = el?.closest("svg") as SVGSVGElement | undefined;
            if (svg) ensureAllFloodBandGradients(svg);
            path.setStyle({
              color: FLOOD_STROKE,
              weight: FLOOD_WEIGHT,
              opacity: FLOOD_OPACITY,
              fillOpacity: FLOOD_FILL_OPACITY,
              fillColor: `url(#${gradId})`,
            });
          });

          layer.bindTooltip(
            [
              `<div class="map-tooltip-panel font-mono text-[11px]">`,
              `<div class="map-tooltip-title">${escapeHtml(tbName)}</div>`,
              locLine
                ? `<div class="map-tooltip-meta">${escapeHtml(locLine)}</div>`
                : "",
              `<div class="map-tooltip-meta">Flood probability: <strong>${escapeHtml(probText)}</strong></div>`,
              `<div class="map-tooltip-code">${escapeHtml(floodBandShortLabel(band))}</div>`,
              `</div>`,
            ]
              .filter(Boolean)
              .join(""),
            {
              sticky: true,
              direction: "top",
              className: "map-tooltip-mono",
              opacity: 1,
            },
          );

          const popupRows = [
            mapPopupRow("Flood probability (%)", probText),
            mapPopupRow("Risk band", floodBandShortLabel(band)),
            mapPopupRow("Risk rank", rank),
            mapPopupRow("Avg frequency", freq),
            mapPopupRow("Actual 2024", actual),
            mapPopupRow("tb_idn", String(p.tb_idn ?? "—")),
            ap ? mapPopupRow("District", ap) : "",
            pv ? mapPopupRow("Province", pv) : "",
          ].filter(Boolean);

          layer.bindPopup(
            `<div class="map-popup-panel">
              <div class="map-popup-title">${escapeHtml(tbName)}</div>
              <div class="map-popup-subtitle">Flood probability · static GeoJSON</div>
              <div class="map-popup-rows">${popupRows.join("")}</div>
            </div>`,
          );

          layer.on({
            mouseover: (e: { target: L.Path }) => {
              e.target.setStyle({
                weight: FLOOD_HOVER_WEIGHT,
                fillOpacity: FLOOD_HOVER_FILL_OPACITY,
              });
            },
            mouseout: (e: { target: L.Path }) => {
              e.target.setStyle({
                weight: FLOOD_WEIGHT,
                fillOpacity: FLOOD_FILL_OPACITY,
              });
            },
          });
        }}
      />
    </>
  );
}
