"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Layer } from "leaflet";
import "leaflet/dist/leaflet.css";
import { GeoJSONFeatureCollection } from "@/types";
import { escapeHtml, mapPopupRow } from "@/lib/mapLeafletHtml";
import TileHeatmap from "./TileHeatmap";
import TimelapseHeatmap from "./TimelapseHeatmap";
import FloodLayerSAR from "./FloodLayerSAR";
import FoliumFloodProbabilityLayer, {
  type FoliumFloodLoadPayload,
} from "./FoliumFloodProbabilityLayer";

// Fix default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const RISK_COLORS: Record<string, string> = {
  normal: "#22c55e",
  watch: "#eab308",
  warning: "#f97316",
  critical: "#ef4444",
};

function stationIcon(risk?: string) {
  const color = RISK_COLORS[risk || ""] || "#3b82f6";
  const size = risk === "critical" ? 26 : risk === "warning" ? 24 : 22;
  return L.divIcon({
    html: `
      <div class="map-marker-shell map-marker-water" style="width:${size}px;height:${size}px;background:${color};">
        <svg viewBox="0 0 24 24" width="${Math.round(size * 0.68)}" height="${Math.round(size * 0.68)}" fill="none" stroke="white" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-label="Water station marker" role="img">
          <path d="M12 3v16"></path>
          <path d="M9 8h6"></path>
          <path d="M9 12h6"></path>
          <path d="M9 16h6"></path>
          <path d="M6 21h12"></path>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    className: "",
  });
}

function FlyTo({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 8, { duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
}

function OnwrTiffBasemapLayer({
  visible,
  url,
  opacity = 0.9,
}: {
  visible: boolean;
  url: string;
  opacity?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    let rasterLayer: Layer | null = null;

    (async () => {
      try {
        const [{ default: parseGeoraster }, { default: GeoRasterLayer }] =
          await Promise.all([
            import("georaster"),
            import("georaster-layer-for-leaflet"),
          ]);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const georaster = await parseGeoraster(arrayBuffer);
        if (cancelled) return;

        const layer = new GeoRasterLayer({
          georaster,
          opacity,
          resolution: 256,
        }) as Layer & { getBounds?: () => L.LatLngBounds };
        layer.addTo(map);
        rasterLayer = layer;

        const bounds = layer.getBounds?.();
        if (bounds?.isValid?.()) {
          map.fitBounds(bounds, {
            padding: [24, 24],
            animate: false,
          });
        }
      } catch (error) {
        console.error("Failed to load ONWR TIFF basemap:", error);
      }
    })();

    return () => {
      cancelled = true;
      if (rasterLayer) {
        map.removeLayer(rasterLayer);
      }
    };
  }, [map, opacity, visible, url]);

  return null;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function ensureBasinLinearGradient(
  svg: SVGSVGElement,
  gradId: string,
  seed: number,
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
  const spread = (seed % 5) * 0.04;
  lg.setAttribute("x1", "0");
  lg.setAttribute("y1", "0");
  lg.setAttribute("x2", String(0.62 + spread));
  lg.setAttribute("y2", "1");

  const mid = ["#7dd3fc", "#60a5fa", "#38bdf8", "#93c5fd", "#3b82f6"][seed % 5];

  const stops: [string, string, string][] = [
    ["0%", "#f8fafc", "0.38"],
    ["40%", mid, "0.48"],
    ["100%", "#0f172a", "0.52"],
  ];

  for (const [offset, color, op] of stops) {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    stop.setAttribute("stop-opacity", op);
    lg.appendChild(stop);
  }
  defs.appendChild(lg);
}

/** ONWR Thailand main basins: SVG gradient fill + themed tooltip/popup */
function ThailandMainBasinsGeoJSON({
  collection,
  suppressFill,
}: {
  collection: GeoJSONFeatureCollection;
  suppressFill: boolean;
}) {
  const map = useMap();

  return (
    <GeoJSON
      key={`thailand-basins-${collection.features.length}-s${suppressFill ? 1 : 0}`}
      data={collection}
      style={() => ({
        fillOpacity: 0,
        weight: 1,
        color: "#262626",
        fillColor: "#e5e7eb",
      })}
      onEachFeature={(feature, layer) => {
        const p = (feature.properties || {}) as Record<string, unknown>;
        const rawId = String(p.id ?? "basin");
        const gradId = `riffai_basin_${rawId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
        const seed = hashString(rawId);

        layer.on("add", () => {
          const pane = map.getPane("overlayPane");
          const svg = pane?.querySelector("svg") as SVGSVGElement | undefined;
          if (svg) ensureBasinLinearGradient(svg, gradId, seed);
          const pathish = layer as L.Layer & {
            setStyle?: (s: L.PathOptions) => void;
          };
          if (suppressFill) {
            pathish.setStyle?.({
              fillOpacity: 0,
              weight: 1.25,
              color: "#404040",
              opacity: 0.88,
            });
          } else {
            pathish.setStyle?.({
              fillColor: `url(#${gradId})`,
              fillOpacity: 1,
              weight: 1.25,
              color: "#171717",
              opacity: 0.92,
            });
          }
        });

        const name = String(
          p.name ?? p.name_en ?? p.name_th ?? p.id ?? "",
        ).trim();
        const nameTh = String(p.name_th ?? "").trim();
        const nameEn = String(p.name_en ?? "").trim();
        const code = String(p.mb_code ?? "").trim();
        const area = p.area_sqkm;
        const areaStr =
          area != null && area !== "" && !Number.isNaN(Number(area))
            ? `${Number(area).toLocaleString()} ตร.กม.`
            : "";

        const tipParts: string[] = [
          `<div class="map-tooltip-title">${escapeHtml(name || rawId)}</div>`,
        ];
        if (areaStr) {
          tipParts.push(
            `<div class="map-tooltip-meta">${escapeHtml(areaStr)}</div>`,
          );
        }
        if (code) {
          tipParts.push(
            `<div class="map-tooltip-code">MB ${escapeHtml(code)}</div>`,
          );
        }

        layer.bindTooltip(
          `<div class="map-tooltip-panel">${tipParts.join("")}</div>`,
          {
            sticky: true,
            direction: "top",
            opacity: 1,
            className: "map-tooltip-mono",
          },
        );

        const rows: string[] = [];
        if (nameTh && nameTh !== name)
          rows.push(mapPopupRow("ชื่อ (ไทย)", nameTh));
        if (nameEn && nameEn !== name)
          rows.push(mapPopupRow("ชื่อ (EN)", nameEn));
        // if (code) rows.push(mapPopupRow("รหัส MB", code));
        if (areaStr) rows.push(mapPopupRow("พื้นที่", areaStr));

        layer.bindPopup(
          `<div class="map-popup-panel">
            <div class="map-popup-title">${escapeHtml(name || rawId)}</div>
            <div class="map-popup-subtitle">ลุ่มน้ำหลัก · ONWR (ชั้นภูมิศาสตร์)</div>
            <div class="map-popup-rows">${rows.join("")}</div>
          </div>`,
        );
      }}
    />
  );
}

interface MapViewProps {
  basins?: GeoJSONFeatureCollection | null;
  /** ONWR main-basin polygons (national layer); visual only, not tied to selectedBasin */
  thailandBasins?: GeoJSONFeatureCollection | null;
  waterLevels?: GeoJSONFeatureCollection | null;
  rivers?: GeoJSONFeatureCollection | null;
  dams?: GeoJSONFeatureCollection | null;
  selectedBasin?: string | null;
  onwrSarGeoJSON?: GeoJSONFeatureCollection | null;
  /** Active SAR stats date (YYYY-MM-DD); used for popups / layer key */
  onwrSarDate?: string | null;
  /** National aggregate from GCS thailand_subbasin_stats.geojson (optional; may be filtered client-side) */
  onwrNationalGeoJSON?: GeoJSONFeatureCollection | null;
  /** Static Folium-export validation points (TP/TN/FP/FN) */
  v3DailyGeoJSON?: GeoJSONFeatureCollection | null;
  onFoliumFloodLoaded?: (payload: FoliumFloodLoadPayload) => void;
  basemapMode?: "light" | "imagery";
  onHeatmapTilesLoaded?: (tiles: any[]) => void;
  heatmapFocusCenter?: [number, number] | null;
  layers: {
    osmBasemap: boolean;
    esriBasemap: boolean;
    onwrTiffBasemap: boolean;
    basins: boolean;
    waterLevels: boolean;
    rivers: boolean;
    dams: boolean;
    satellite: boolean;
    floodDepth: boolean;
    rainfall: boolean;
    heatmap: boolean;
    timelapse: boolean;
    tambonFlood: boolean;
    foliumFloodProbability: boolean;
    onwrSar: boolean;
    onwrNational: boolean;
    v3DailyValidation: boolean;
  };
}

function lerpChannel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * Math.min(1, Math.max(0, t)));
}

export function zFromOnwrFeatureProperties(
  p: Record<string, unknown> | undefined,
): number | null | undefined {
  if (!p) return undefined;
  for (const k of ["mean_z_score", "zscore", "z_score", "mean_z", "mean"]) {
    const v = p[k];
    if (v != null && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

/** Blue (z &lt; -3) → yellow (~0) → red (z &gt; 3) */
export function zScoreChoroplethColor(z: number | null | undefined): string {
  if (z == null || Number.isNaN(Number(z))) return "#94a3b8";
  const v = Number(z);
  if (v <= -3) return "#1e40af";
  if (v >= 3) return "#b91c1c";
  if (v < 0) {
    const t = (v + 3) / 3;
    const r = lerpChannel(30, 250, t);
    const g = lerpChannel(64, 204, t);
    const b = lerpChannel(175, 21, t);
    return `rgb(${r},${g},${b})`;
  }
  const t = v / 3;
  const r = lerpChannel(250, 185, t);
  const g = lerpChannel(204, 28, t);
  const b = lerpChannel(21, 28, t);
  return `rgb(${r},${g},${b})`;
}

const BASIN_CENTERS: Record<string, [number, number]> = {
  mekong_north: [19.5, 100.0],
  eastern_coast: [12.5, 101.8],
  southern_east: [6.5, 101.0],
};

export default function MapViewSimple({
  basins,
  thailandBasins,
  waterLevels,
  rivers,
  dams,
  selectedBasin,
  onwrSarGeoJSON,
  onwrSarDate,
  onwrNationalGeoJSON,
  v3DailyGeoJSON,
  onFoliumFloodLoaded,
  basemapMode,
  onHeatmapTilesLoaded,
  heatmapFocusCenter,
  layers,
}: MapViewProps) {
  const flyCenter = selectedBasin ? BASIN_CENTERS[selectedBasin] : undefined;
  const [selectedTile, setSelectedTile] = useState<any>(null);
  const resolvedBasemapMode: "light" | "imagery" =
    basemapMode ??
    (layers.esriBasemap || layers.onwrTiffBasemap ? "imagery" : "light");

  // Dam icon
  const damIcon = L.divIcon({
    html: `
      <div class="map-marker-shell map-marker-dam">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f8fafc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Dam marker" role="img">
          <path d="M4 19h16"></path>
          <path d="M6 19V9l2-4"></path>
          <path d="M10 19V8l2-3"></path>
          <path d="M14 19v-8l2-2"></path>
          <path d="M18 19v-6"></path>
        </svg>
      </div>
    `,
    iconSize: [24, 24],
    className: "",
  });

  // Folium static flood polygons use SVG `url(#gradient)` fills; `preferCanvas` would drop those fills.
  return (
    <MapContainer
      center={[13.7, 100.5]}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
      className="rounded-mono shadow-mono-lg"
    >
      {layers.esriBasemap ? (
        <>
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          <TileLayer
            attribution=""
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            opacity={0.6}
          />
        </>
      ) : layers.onwrTiffBasemap ? (
        <>
          <OnwrTiffBasemapLayer
            visible={layers.onwrTiffBasemap}
            url="/onwr-basemap-water-border-basin.tif"
            opacity={0.9}
          />
          <TileLayer
            attribution=""
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            opacity={0.65}
          />
        </>
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}

      {flyCenter && <FlyTo center={flyCenter} zoom={8} />}

      {/* Time-lapse Animation */}
      {layers.timelapse && (
        <TimelapseHeatmap
          visible={layers.timelapse}
          startDate={new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
          endDate={new Date()}
          basinId={selectedBasin}
          basemapMode={resolvedBasemapMode}
        />
      )}

      {/* Tile Heatmap */}
      {!layers.timelapse && layers.heatmap && (
        <TileHeatmap
          visible={layers.heatmap}
          onTileClick={(tile) => setSelectedTile(tile)}
          basinId={selectedBasin}
          basemapMode={resolvedBasemapMode}
          onTilesLoaded={onHeatmapTilesLoaded as any}
          focusCenter={heatmapFocusCenter ?? null}
        />
      )}

      {layers.basins &&
        thailandBasins &&
        thailandBasins.features?.length > 0 && (
          <ThailandMainBasinsGeoJSON
            collection={thailandBasins}
            suppressFill={layers.onwrSar || layers.foliumFloodProbability}
          />
        )}

      {/* Rivers */}
      {layers.rivers && rivers && (
        <GeoJSON
          data={rivers}
          style={() => ({
            color: "#3b82f6",
            weight: 3,
            opacity: 0.7,
          })}
          onEachFeature={(feature, layer) => {
            const p = feature.properties;
            const tribut =
              Array.isArray(p.tributaries) && p.tributaries.length > 0
                ? p.tributaries.join(", ")
                : "";
            const rows = [
              p.name_en ? mapPopupRow("ชื่อ (EN)", String(p.name_en)) : "",
              mapPopupRow(
                "ความยาว",
                `${p.length_km != null ? Number(p.length_km).toLocaleString() : "-"} km`,
              ),
              mapPopupRow("ลุ่มน้ำ (id)", String(p.basin_id ?? "-")),
              tribut ? mapPopupRow("สาขา", tribut) : "",
            ]
              .filter(Boolean)
              .join("");
            layer.bindPopup(`
              <div class="map-popup-panel">
                <div class="map-popup-title">${escapeHtml(String(p.name ?? ""))}</div>
                <div class="map-popup-subtitle">แม่น้ำสายหลัก</div>
                <div class="map-popup-rows">${rows}</div>
              </div>
            `);
          }}
        />
      )}

      {/* Dams */}
      {layers.dams &&
        dams &&
        dams.features?.map((f, i) => {
          const [lon, lat] = f.geometry.coordinates;
          const p = f.properties;
          if (selectedBasin && p.basin_id !== selectedBasin) return null;

          return (
            <Marker key={`dam-${i}`} position={[lat, lon]} icon={damIcon}>
              <Popup>
                <div className="map-popup-panel text-sm">
                  <div className="map-popup-title">{p.name}</div>
                  <div className="map-popup-subtitle">เขื่อน / อ่างเก็บน้ำ</div>
                  <div className="map-popup-rows">
                    <div className="map-popup-row">
                      <span className="map-popup-label">ชื่ออังกฤษ</span>
                      <span className="map-popup-value">{p.name_en}</span>
                    </div>
                    <div className="map-popup-row">
                      <span className="map-popup-label">แม่น้ำ</span>
                      <span className="map-popup-value">{p.river}</span>
                    </div>
                    <div className="map-popup-row">
                      <span className="map-popup-label">ความจุ</span>
                      <span className="map-popup-value font-semibold">
                        {p.capacity_mcm?.toLocaleString()} ล้าน ลบ.ม.
                      </span>
                    </div>
                    <div className="map-popup-row">
                      <span className="map-popup-label">ความสูง</span>
                      <span className="map-popup-value">{p.height_m} ม.</span>
                    </div>
                    <div className="map-popup-row">
                      <span className="map-popup-label">จังหวัด</span>
                      <span className="map-popup-value">{p.province}</span>
                    </div>
                    <div className="map-popup-row">
                      <span className="map-popup-label">สร้างเมื่อ</span>
                      <span className="map-popup-value">
                        พ.ศ. {p.year_built + 543}
                      </span>
                    </div>
                    <div className="map-popup-row">
                      <span className="map-popup-label">ประเภท</span>
                      <span className="map-popup-value">
                        <span className="inline-flex text-xs border border-gray-300 bg-gray-100 text-gray-800 px-2 py-0.5 rounded-mono">
                          {p.type === "multipurpose"
                            ? "อเนกประสงค์"
                            : p.type === "hydropower"
                              ? "ไฟฟ้าพลังน้ำ"
                              : p.type === "irrigation"
                                ? "ชลประทาน"
                                : p.type}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

      {/* ONWR national sub-basin choropleth (under per-basin layer) */}
      {layers.onwrNational &&
        onwrNationalGeoJSON &&
        onwrNationalGeoJSON.features?.length > 0 && (
          <GeoJSON
            key={`onwr-national-${onwrNationalGeoJSON.features.length}`}
            data={onwrNationalGeoJSON}
            style={(feature) => {
              const z = zFromOnwrFeatureProperties(
                feature?.properties as Record<string, unknown>,
              );
              const fill = zScoreChoroplethColor(z);
              return {
                color: "#64748b",
                weight: 0.5,
                fillColor: fill,
                fillOpacity: 0.4,
              };
            }}
            onEachFeature={(feature, layer) => {
              const p = (feature.properties || {}) as Record<string, unknown>;
              const z = zFromOnwrFeatureProperties(p);
              const flood =
                p.flood_detected === true || (typeof z === "number" && z <= -3);
              const nm = String(
                p.NAME || p.name || p.basin_en || p.basin_th || "",
              );
              const hy = String(p.HYBAS_ID ?? "—");
              const dt = String(p.date ?? "—");
              const zStr = z != null ? Number(z).toFixed(2) : "—";
              layer.bindPopup(`
              <div class="map-popup-panel">
                <div class="map-popup-title">HYBAS ${escapeHtml(hy)}</div>
                <div class="map-popup-subtitle">Thailand SAR aggregate</div>
                <div class="map-popup-rows">
                  ${mapPopupRow("ชื่อ", nm)}
                  ${mapPopupRow("วันที่", dt)}
                  ${mapPopupRow("Z-score", zStr)}
                  ${mapPopupRow("Flood signal", flood ? "Yes" : "No")}
                </div>
              </div>
            `);
            }}
          />
        )}

      {layers.onwrSar &&
        onwrSarGeoJSON &&
        onwrSarGeoJSON.features?.length > 0 && (
          <FloodLayerSAR
            geojson={onwrSarGeoJSON}
            date={onwrSarDate ?? String(onwrSarGeoJSON.properties?.date ?? "")}
          />
        )}

      {layers.v3DailyValidation &&
        v3DailyGeoJSON &&
        v3DailyGeoJSON.features?.length > 0 && (
          <GeoJSON
            key={`v3-daily-${v3DailyGeoJSON.features.length}`}
            data={v3DailyGeoJSON}
            pointToLayer={(feature, latlng) => {
              const p = (feature.properties || {}) as Record<string, unknown>;
              const fill = String(p.fill ?? "#94a3b8");
              return L.circleMarker(latlng, {
                radius: 3,
                color: fill,
                weight: 0.5,
                fillColor: fill,
                fillOpacity: 0.8,
                opacity: 1,
              });
            }}
            onEachFeature={(feature, layer) => {
              const p = (feature.properties || {}) as Record<string, unknown>;
              const label = String(p.label ?? "");
              if (label)
                layer.bindTooltip(
                  `<div class="map-tooltip-panel font-mono text-[11px]">${escapeHtml(
                    label,
                  )}</div>`,
                  {
                    sticky: true,
                    direction: "top",
                    opacity: 1,
                    className: "map-tooltip-mono",
                  },
                );
            }}
          />
        )}

      {layers.foliumFloodProbability && (
        <FoliumFloodProbabilityLayer
          visible={layers.foliumFloodProbability}
          onLoaded={onFoliumFloodLoaded}
        />
      )}

      {/* Basin boundaries */}
      {layers.basins && basins && (
        <GeoJSON
          data={basins}
          style={(feature) => {
            const isSelected = feature?.properties.id === selectedBasin;
            const suppressFill =
              layers.onwrSar || layers.foliumFloodProbability;
            return {
              color: isSelected ? "#1e40af" : "#3b82f6",
              weight: isSelected ? 3 : 2,
              fillColor: isSelected ? "#3b82f6" : "#60a5fa",
              fillOpacity: suppressFill ? 0 : isSelected ? 0.15 : 0.08,
              dashArray: isSelected ? undefined : "5 5",
            };
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties;
            const prov = (p.provinces || []).join(", ") || "-";
            const area =
              p.area_sqkm != null
                ? `${Number(p.area_sqkm).toLocaleString()} ตร.กม.`
                : "-";
            layer.bindPopup(`
              <div class="map-popup-panel">
                <div class="map-popup-title">${escapeHtml(String(p.name ?? ""))}</div>
                <div class="map-popup-subtitle">ลุ่มน้ำนำร่อง · API</div>
                <div class="map-popup-rows">
                  ${mapPopupRow("จังหวัด", prov)}
                  ${mapPopupRow("พื้นที่", area)}
                </div>
              </div>
            `);
          }}
        />
      )}

      {layers.waterLevels &&
        waterLevels?.features?.map((f, i) => {
          const [lon, lat] = f.geometry.coordinates;
          const p = f.properties;
          if (selectedBasin && p.basin_id !== selectedBasin) return null;

          return (
            <Marker
              key={`water-${i}`}
              position={[lat, lon]}
              icon={stationIcon(p.risk_level)}
            >
              <Popup>
                <div className="map-popup-panel text-sm">
                  <div className="map-popup-title">{p.name}</div>
                  <div className="map-popup-subtitle">สถานีระดับน้ำ</div>
                  <div className="map-popup-rows">
                    <div className="map-popup-row">
                      <span className="map-popup-label">ระดับน้ำ</span>
                      <span className="map-popup-value font-semibold text-base">
                        {p.water_level_m?.toFixed(2)} m
                      </span>
                    </div>
                    <div className="map-popup-row">
                      <span className="map-popup-label">จังหวัด</span>
                      <span className="map-popup-value">{p.province}</span>
                    </div>
                    <div className="map-popup-row">
                      <span className="map-popup-label">เวลาวัด</span>
                      <span className="map-popup-value text-xs font-mono">
                        {p.datetime
                          ? new Date(p.datetime).toLocaleString("th-TH", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "-"}
                      </span>
                    </div>
                    <div className="map-popup-row border-t border-gray-200 pt-2 mt-1">
                      <span className="map-popup-label">สถานะ</span>
                      <span className="map-popup-value font-semibold">
                        {p.risk_level === "critical"
                          ? "Critical"
                          : p.risk_level === "warning"
                            ? "Warning"
                            : p.risk_level === "watch"
                              ? "Watch"
                              : "Normal"}
                      </span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </MapContainer>
  );
}
