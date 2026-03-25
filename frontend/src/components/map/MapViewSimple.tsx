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
import "leaflet/dist/leaflet.css";
import { GeoJSONFeatureCollection } from "@/types";
import TileHeatmap from "./TileHeatmap";
import TimelapseHeatmap from "./TimelapseHeatmap";
import TimelapseZScoreLayer from "./TimelapseZScoreLayer";

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
  const size = risk === "critical" ? 18 : risk === "warning" ? 15 : 12;
  return L.divIcon({
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
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

interface MapViewProps {
  basins?: GeoJSONFeatureCollection | null;
  waterLevels?: GeoJSONFeatureCollection | null;
  rivers?: GeoJSONFeatureCollection | null;
  dams?: GeoJSONFeatureCollection | null;
  selectedBasin?: string | null;
  zscoreDate?: string; // YYYY-MM-DD
  zscoreOpacity?: number; // 0..1
  layers: {
    basins: boolean;
    waterLevels: boolean;
    rivers: boolean;
    dams: boolean;
    satellite: boolean;
    floodDepth: boolean;
    rainfall: boolean;
    heatmap: boolean;
    timelapse: boolean;
    zscoreOverlay: boolean;
    zscoreTimelapse: boolean;
    zscoreSummary: boolean;
  };
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
  zscoreDate,
  zscoreOpacity = 0.7,
  layers,
}: MapViewProps) {
  const flyCenter = selectedBasin ? BASIN_CENTERS[selectedBasin] : undefined;
  const [selectedTile, setSelectedTile] = useState<any>(null);
  const [zscoreYear, setZscoreYear] = useState<number>(() => new Date().getFullYear());

  useEffect(() => {
    if (zscoreDate) {
      const y = Number(zscoreDate.slice(0, 4));
      if (!Number.isNaN(y)) setZscoreYear(y);
    }
  }, [zscoreDate]);

  // Dam icon
  const damIcon = L.divIcon({
    html: '<div style="font-size:16px;font-weight:bold;">DAM</div>',
    iconSize: [30, 20],
    className: "",
  });

  return (
    <MapContainer
      center={[13.7, 100.5]}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
      className="rounded-lg shadow-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {flyCenter && <FlyTo center={flyCenter} zoom={8} />}

      {/* Z-score VV timelapse (raster) */}
      {layers.zscoreTimelapse && selectedBasin && (
        <TimelapseZScoreLayer
          visible={layers.zscoreTimelapse}
          basinId={selectedBasin}
          year={zscoreYear}
          opacity={zscoreOpacity}
        />
      )}

      {/* Z-score VV single-date overlay (raster) */}
      {layers.zscoreOverlay && !layers.zscoreTimelapse && selectedBasin && zscoreDate && (
        <TileLayer
          url={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/map/zscore/vv/tiles/${selectedBasin}/${zscoreDate.slice(0, 4)}/${zscoreDate.slice(5, 7)}/${zscoreDate.slice(8, 10)}/{z}/{x}/{y}.png`}
          opacity={zscoreOpacity}
          zIndex={450}
        />
      )}

      {/* Time-lapse Animation */}
      {layers.timelapse && !layers.zscoreTimelapse && (
        <TimelapseHeatmap
          visible={layers.timelapse}
          startDate={new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
          endDate={new Date()}
          basinId={selectedBasin}
        />
      )}

      {/* Tile Heatmap */}
      {!layers.timelapse && !layers.zscoreTimelapse && layers.heatmap && (
        <TileHeatmap
          visible={layers.heatmap}
          onTileClick={(tile) => setSelectedTile(tile)}
          basinId={selectedBasin}
        />
      )}

      {/* Z-score summary grid (vector) */}
      {layers.zscoreSummary && !layers.zscoreTimelapse && selectedBasin && zscoreDate && (
        <TileHeatmap
          visible={layers.zscoreSummary}
          mode="zscore"
          basinId={selectedBasin}
          zscoreDate={zscoreDate}
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
