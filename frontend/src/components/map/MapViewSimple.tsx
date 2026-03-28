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
import TileHeatmap from "./TileHeatmap";
import TimelapseHeatmap from "./TimelapseHeatmap";
import FloodLayerSAR from "./FloodLayerSAR";
import FoliumFloodProbabilityLayer from "./FoliumFloodProbabilityLayer";

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
        const [{ default: parseGeoraster }, { default: GeoRasterLayer }] = await Promise.all([
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

interface MapViewProps {
  basins?: GeoJSONFeatureCollection | null;
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
  onFoliumFloodLoaded?: (featureCount: number) => void;
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
  p: Record<string, unknown> | undefined
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
  waterLevels,
  rivers,
  dams,
  selectedBasin,
  onwrSarGeoJSON,
  onwrSarDate,
  onwrNationalGeoJSON,
  v3DailyGeoJSON,
  onFoliumFloodLoaded,
  layers,
}: MapViewProps) {
  const flyCenter = selectedBasin ? BASIN_CENTERS[selectedBasin] : undefined;
  const [selectedTile, setSelectedTile] = useState<any>(null);

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
            eventHandlers={{
              tileerror: (e) => {
                // #region agent log
                fetch('http://127.0.0.1:7908/ingest/8ecea870-d1d6-42b5-905e-45e03cf5df70',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d844b9'},body:JSON.stringify({sessionId:'d844b9',runId:'pre-fix',hypothesisId:'H1_browserOfflineOrBlocked',location:'MapViewSimple.tsx:tileerror:esriImagery',message:'Esri imagery tileerror',data:{online:typeof navigator!=='undefined'?navigator.onLine:undefined,url:(e as any)?.tile?.src||null,error:(e as any)?.error?String((e as any).error):null},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
              },
              load: () => {
                // #region agent log
                fetch('http://127.0.0.1:7908/ingest/8ecea870-d1d6-42b5-905e-45e03cf5df70',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d844b9'},body:JSON.stringify({sessionId:'d844b9',runId:'pre-fix',hypothesisId:'H2_tilesReachable',location:'MapViewSimple.tsx:load:esriImagery',message:'Esri imagery tile load event',data:{online:typeof navigator!=='undefined'?navigator.onLine:undefined},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
              },
            }}
          />
          <TileLayer
            attribution=""
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            opacity={0.6}
            eventHandlers={{
              tileerror: (e) => {
                // #region agent log
                fetch('http://127.0.0.1:7908/ingest/8ecea870-d1d6-42b5-905e-45e03cf5df70',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d844b9'},body:JSON.stringify({sessionId:'d844b9',runId:'pre-fix',hypothesisId:'H1_browserOfflineOrBlocked',location:'MapViewSimple.tsx:tileerror:esriLabels',message:'Esri labels tileerror',data:{online:typeof navigator!=='undefined'?navigator.onLine:undefined,url:(e as any)?.tile?.src||null,error:(e as any)?.error?String((e as any).error):null},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
              },
            }}
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
            eventHandlers={{
              tileerror: (e) => {
                // #region agent log
                fetch('http://127.0.0.1:7908/ingest/8ecea870-d1d6-42b5-905e-45e03cf5df70',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d844b9'},body:JSON.stringify({sessionId:'d844b9',runId:'pre-fix',hypothesisId:'H1_browserOfflineOrBlocked',location:'MapViewSimple.tsx:tileerror:esriLabelsOnTiff',message:'Esri labels tileerror (onwrTiffBasemap)',data:{online:typeof navigator!=='undefined'?navigator.onLine:undefined,url:(e as any)?.tile?.src||null,error:(e as any)?.error?String((e as any).error):null},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
              },
            }}
          />
        </>
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: (e) => {
              // #region agent log
              fetch('http://127.0.0.1:7908/ingest/8ecea870-d1d6-42b5-905e-45e03cf5df70',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d844b9'},body:JSON.stringify({sessionId:'d844b9',runId:'pre-fix',hypothesisId:'H1_browserOfflineOrBlocked',location:'MapViewSimple.tsx:tileerror:osm',message:'OSM tileerror',data:{online:typeof navigator!=='undefined'?navigator.onLine:undefined,url:(e as any)?.tile?.src||null,error:(e as any)?.error?String((e as any).error):null},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
            },
          }}
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
        />
      )}

      {/* Tile Heatmap */}
      {!layers.timelapse && layers.heatmap && (
        <TileHeatmap
          visible={layers.heatmap}
          onTileClick={(tile) => setSelectedTile(tile)}
          basinId={selectedBasin}
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
            layer.bindPopup(`
              <div class="text-sm min-w-[200px]">
                <div class="font-bold text-lg mb-2 text-blue-900">${p.name}</div>
                <div class="space-y-1">
                  <div>${p.name_en}</div>
                  <div>Length: ${p.length_km?.toLocaleString()} km</div>
                  <div>Basin: ${p.basin_id}</div>
                  ${p.tributaries?.length > 0 ? `<div>Tributaries: ${p.tributaries.join(", ")}</div>` : ''}
                </div>
              </div>
            `);
          }}
        />
      )}

      {/* Dams */}
      {layers.dams && dams && dams.features?.map((f, i) => {
        const [lon, lat] = f.geometry.coordinates;
        const p = f.properties;
        if (selectedBasin && p.basin_id !== selectedBasin) return null;
        
        return (
          <Marker
            key={`dam-${i}`}
            position={[lat, lon]}
            icon={damIcon}
          >
            <Popup>
              <div className="text-sm min-w-[250px]">
                <div className="font-bold text-lg mb-3 text-primary-900 border-b pb-2">
                  {p.name}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">ชื่ออังกฤษ</span>
                    <span className="font-medium">{p.name_en}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">แม่น้ำ</span>
                    <span className="font-medium">{p.river}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">ความจุ</span>
                    <span className="font-bold text-blue-600">{p.capacity_mcm?.toLocaleString()} ล้าน ลบ.ม.</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">ความสูง</span>
                    <span className="font-medium">{p.height_m} ม.</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">จังหวัด</span>
                    <span className="font-medium">{p.province}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">สร้างเมื่อ</span>
                    <span className="font-medium">พ.ศ. {p.year_built + 543}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">ประเภท</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {p.type === 'multipurpose' ? 'อเนกประสงค์' :
                       p.type === 'hydropower' ? 'ไฟฟ้าพลังน้ำ' :
                       p.type === 'irrigation' ? 'ชลประทาน' : p.type}
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
              const z = zFromOnwrFeatureProperties(feature?.properties as Record<string, unknown>);
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
              layer.bindPopup(`
              <div class="text-sm min-w-[200px]">
                <div class="font-bold text-slate-900 border-b pb-1 mb-2">HYBAS ${p.HYBAS_ID ?? "—"}</div>
                <div>${String(p.NAME || p.name || p.basin_en || p.basin_th || "")}</div>
                <div class="font-mono text-xs mt-1">Date: ${String(p.date ?? "—")}</div>
                <div class="font-mono text-xs">Z-score: ${z != null ? Number(z).toFixed(2) : "—"}</div>
                <div class="font-mono text-xs">Flood signal: <strong>${flood ? "Yes" : "No"}</strong></div>
              </div>
            `);
            }}
          />
        )}

      {layers.onwrSar && onwrSarGeoJSON && onwrSarGeoJSON.features?.length > 0 && (
        <FloodLayerSAR
          geojson={onwrSarGeoJSON}
          date={
            onwrSarDate ??
            String(onwrSarGeoJSON.properties?.date ?? "")
          }
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
              if (label) layer.bindTooltip(label, { sticky: true, direction: "top", opacity: 0.95 });
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
            const suppressFill = layers.onwrSar || layers.foliumFloodProbability;
            return {
              color: isSelected ? "#1e40af" : "#3b82f6",
              weight: isSelected ? 3 : 2,
              fillColor: isSelected ? "#3b82f6" : "#60a5fa",
              fillOpacity: suppressFill
                ? 0
                : isSelected
                  ? 0.15
                  : 0.08,
              dashArray: isSelected ? undefined : "5 5",
            };
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties;
            layer.bindPopup(`
              <div class="text-sm min-w-[250px]">
                <div class="font-bold text-lg mb-3 text-primary-900 border-b pb-2">${p.name}</div>
                <div class="space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-gray-600">📍 จังหวัด</span>
                    <span class="font-medium">${p.provinces?.join(", ") || "-"}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-gray-600">📐 พื้นที่</span>
                    <span class="font-medium">${p.area_sqkm?.toLocaleString() || "-"} ตร.กม.</span>
                  </div>
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
                <div className="text-sm min-w-[250px]">
                  <div className="font-bold text-lg mb-3 text-primary-900 border-b pb-2">
                    {p.name}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Water Level</span>
                      <span className="font-bold text-lg text-primary-900">
                        {p.water_level_m?.toFixed(2)} m
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Province</span>
                      <span className="font-medium">{p.province}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">⏰ เวลา</span>
                      <span className="text-xs font-mono">
                        {p.datetime
                          ? new Date(p.datetime).toLocaleString("th-TH", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-gray-600">สถานะ</span>
                      <span className="font-bold">
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
