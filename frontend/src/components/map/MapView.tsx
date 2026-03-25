"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
  LayersControl,
  ScaleControl,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GeoJSONFeatureCollection } from "@/types";

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

const FLOOD_DEPTH_COLORS: Record<number, string> = {
  0: "#dbeafe",
  0.5: "#93c5fd",
  1.0: "#3b82f6",
  1.5: "#1e40af",
  2.0: "#1e3a8a",
  2.5: "#172554",
};

function stationIcon(risk?: string, type?: string) {
  const color = RISK_COLORS[risk || ""] || "#3b82f6";
  const size = risk === "critical" ? 18 : risk === "warning" ? 15 : 12;
  const icon = type === "rainfall" ? "☔" : "💧";
  
  return L.divIcon({
    html: `
      <div style="
        background:${color};
        width:${size}px;
        height:${size}px;
        border-radius:50%;
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:${size - 4}px;
        position:relative;
      ">
        ${risk === "critical" ? '<div style="position:absolute;width:100%;height:100%;border-radius:50%;border:2px solid ' + color + ';animation:pulse 2s infinite;"></div>' : ''}
      </div>
    `,
    iconSize: [size, size],
    className: "",
  });
}

// Satellite overlay icon
function satelliteIcon() {
  return L.divIcon({
    html: `
      <div style="
        background:linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
        width:24px;
        height:24px;
        border-radius:4px;
        border:2px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:14px;
      ">🛰️</div>
    `,
    iconSize: [24, 24],
    className: "",
  });
}

// Fly to basin when selected
function FlyTo({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 8, { duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
}

// Auto-fit bounds
function FitBounds({ bounds }: { bounds?: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [bounds, map]);
  return null;
}

interface MapViewProps {
  basins?: GeoJSONFeatureCollection | null;
  waterLevels?: GeoJSONFeatureCollection | null;
  selectedBasin?: string | null;
  layers: {
    basins: boolean;
    waterLevels: boolean;
    satellite: boolean;
    floodDepth: boolean;
    rainfall: boolean;
    waterBorder: boolean;
    waterBorder: boolean;
  };
}

const BASIN_CENTERS: Record<string, [number, number]> = {
  mekong_north: [19.5, 100.0],
  eastern_coast: [12.5, 101.8],
  southern_east: [6.5, 101.0],
};

export default function MapView({
  basins,
  waterLevels,
  selectedBasin,
  layers,
}: MapViewProps) {
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const flyCenter = selectedBasin ? BASIN_CENTERS[selectedBasin] : undefined;

  // Calculate bounds for selected basin
  const basinBounds = basins?.features?.find(
    (f) => f.properties.id === selectedBasin
  )?.geometry;

  return (
    <MapContainer
      center={[13.7, 100.5]}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
      className="rounded-lg shadow-lg"
      zoomControl={false}
    >
      {/* Base layers */}
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="🗺️ Street Map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="🛰️ Satellite">
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="🌍 Terrain">
          <TileLayer
            attribution='&copy; <a href="https://www.opentopomap.org">OpenTopoMap</a>'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {/* Controls */}
      <ZoomControl position="bottomright" />
      <ScaleControl position="bottomleft" imperial={false} />

      {flyCenter && <FlyTo center={flyCenter} zoom={8} />}

      {/* ONWR Water Border raster */}
      {layers.waterBorder && (
        <TileLayer
          url="https://tiles.riffai.com/onwr-water-border/{z}/{x}/{y}.png"
          attribution="&copy; ONWR"
          opacity={0.6}
        />
      )
      }

      {/* Basin boundaries */}
      {layers.basins && basins && (
        <GeoJSON
          data={basins}
          style={(feature) => {
            const isSelected = feature?.properties.id === selectedBasin;
            return {
              color: isSelected ? "#1e40af" : "#3b82f6",
              weight: isSelected ? 3 : 2,
              fillColor: isSelected ? "#3b82f6" : "#60a5fa",
              fillOpacity: isSelected ? 0.15 : 0.08,
              dashArray: isSelected ? undefined : "5 5",
            };
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties;
            layer.on({
              click: () => setSelectedFeature(feature),
              mouseover: (e) => {
                const layer = e.target;
                layer.setStyle({
                  fillOpacity: 0.25,
                  weight: 3,
                });
              },
              mouseout: (e) => {
                const layer = e.target;
                const isSelected = p.id === selectedBasin;
                layer.setStyle({
                  fillOpacity: isSelected ? 0.15 : 0.08,
                  weight: isSelected ? 3 : 2,
                });
              },
            });
            
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
                  <div class="flex justify-between items-center">
                    <span class="text-gray-600">🌊 แม่น้ำหลัก</span>
                    <span class="font-medium">${p.main_river || "-"}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-gray-600">📊 สถานี</span>
                    <span class="font-medium">${p.station_count || 0} สถานี</span>
                  </div>
                </div>
              </div>
            `);
          }}
        />
      )}

      {/* Flood depth overlay */}
      {layers.floodDepth && selectedBasin && (
        <>
          {/* Mock flood depth circles - in production, use actual flood prediction data */}
          {waterLevels?.features
            ?.filter((f) => f.properties.basin_id === selectedBasin)
            ?.filter((f) => f.properties.risk_level !== "normal")
            ?.map((f, i) => {
              const [lon, lat] = f.geometry.coordinates;
              const depth = f.properties.water_level_m > 4.5 ? 2.5 :
                           f.properties.water_level_m > 4.0 ? 1.5 :
                           f.properties.water_level_m > 3.5 ? 1.0 : 0.5;
              const radius = depth * 5000; // 5km per meter depth
              
              return (
                <Circle
                  key={`flood-${i}`}
                  center={[lat, lon]}
                  radius={radius}
                  pathOptions={{
                    fillColor: FLOOD_DEPTH_COLORS[depth] || "#3b82f6",
                    fillOpacity: 0.3,
                    color: "#1e40af",
                    weight: 1,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold mb-2">Predicted Flood Depth</div>
                      <div>Depth: {depth} m</div>
                      <div>Radius: {(radius / 1000).toFixed(1)} km</div>
                    </div>
                  </Popup>
                </Circle>
              );
            })}
        </>
      )}

      {/* Water level markers */}
      {layers.waterLevels &&
        waterLevels?.features?.map((f, i) => {
          const [lon, lat] = f.geometry.coordinates;
          const p = f.properties;
          if (selectedBasin && p.basin_id !== selectedBasin) return null;
          
          return (
            <Marker
              key={`water-${i}`}
              position={[lat, lon]}
              icon={stationIcon(p.risk_level, "water")}
              eventHandlers={{
                click: () => setSelectedFeature(f),
              }}
            >
              <Popup>
                <div className="text-sm min-w-[250px]">
                  <div className="font-bold text-lg mb-3 text-primary-900 border-b pb-2">
                    {p.name}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">💧 ระดับน้ำ</span>
                      <span className="font-bold text-lg text-primary-900">
                        {p.water_level_m?.toFixed(2)} ม.
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">📍 จังหวัด</span>
                      <span className="font-medium">{p.province}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">🏞️ ลุ่มน้ำ</span>
                      <span className="font-medium">{p.basin_name || "-"}</span>
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
                          ? "🔴 วิกฤต"
                          : p.risk_level === "warning"
                          ? "🟠 เตือนภัย"
                          : p.risk_level === "watch"
                          ? "🟡 เฝ้าระวัง"
                          : "🟢 ปกติ"}
                      </span>
                    </div>
                    {p.trend && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">📈 แนวโน้ม</span>
                        <span>
                          {p.trend === "rising" ? "⬆️ เพิ่มขึ้น" :
                           p.trend === "falling" ? "⬇️ ลดลง" : "➡️ คงที่"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

      {/* Rainfall markers */}
      {layers.rainfall &&
        waterLevels?.features
          ?.filter((f) => f.properties.station_type === "rainfall")
          ?.map((f, i) => {
            const [lon, lat] = f.geometry.coordinates;
            const p = f.properties;
            if (selectedBasin && p.basin_id !== selectedBasin) return null;
            
            const rainfall = p.rainfall_mm || 0;
            const riskLevel = rainfall > 100 ? "critical" :
                            rainfall > 50 ? "warning" :
                            rainfall > 20 ? "watch" : "normal";
            
            return (
              <Marker
                key={`rain-${i}`}
                position={[lat, lon]}
                icon={stationIcon(riskLevel, "rainfall")}
              >
                <Popup>
                  <div className="text-sm min-w-[250px]">
                    <div className="font-bold text-lg mb-3 text-primary-900 border-b pb-2">
                      {p.name}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">☔ ปริมาณฝน</span>
                        <span className="font-bold text-lg text-primary-900">
                          {rainfall.toFixed(1)} มม.
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">📍 จังหวัด</span>
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
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

      {/* Satellite imagery markers */}
      {layers.satellite && selectedBasin && (
        <>
          {/* Mock satellite coverage - in production, show actual satellite image tiles */}
          {BASIN_CENTERS[selectedBasin] && (
            <Marker
              position={BASIN_CENTERS[selectedBasin]}
              icon={satelliteIcon()}
            >
              <Popup>
                <div className="text-sm min-w-[250px]">
                  <div className="font-bold text-lg mb-3 text-primary-900 border-b pb-2">
                    🛰️ Satellite Coverage
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Sentinel-2</span>
                      <span className="font-medium text-green-600">✓ Available</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Sentinel-1 SAR</span>
                      <span className="font-medium text-green-600">✓ Available</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Resolution</span>
                      <span className="font-medium">10m</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Cloud Cover</span>
                      <span className="font-medium">< 5%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Last Update</span>
                      <span className="text-xs font-mono">
                        {new Date().toLocaleDateString("th-TH")}
                      </span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </>
      )}

      {/* Connection lines between stations (optional) */}
      {layers.waterLevels && selectedBasin && waterLevels?.features && (
        <>
          {waterLevels.features
            .filter((f) => f.properties.basin_id === selectedBasin)
            .slice(0, -1)
            .map((f, i) => {
              const next = waterLevels.features[i + 1];
              if (!next || next.properties.basin_id !== selectedBasin) return null;
              
              const [lon1, lat1] = f.geometry.coordinates;
              const [lon2, lat2] = next.geometry.coordinates;
              
              return (
                <Polyline
                  key={`line-${i}`}
                  positions={[
                    [lat1, lon1],
                    [lat2, lon2],
                  ]}
                  pathOptions={{
                    color: "#3b82f6",
                    weight: 1,
                    opacity: 0.3,
                    dashArray: "5 5",
                  }}
                />
              );
            })}
        </>
      )}
    </MapContainer>
  );
}
