"use client";

import { useCallback, useEffect, useState } from "react";
import { GeoJSON, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { mapAPI } from "@/services/api";

interface TileStats {
  avgWaterLevel: number;
  rainfall24h: number;
  stationCount: number;
  populationAtRisk: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
}

interface TileProperties {
  id: string;
  center: [number, number];
  riskLevel: string;
  stats: TileStats;
  provinces: string[];
  rivers: string[];
  dams: any[];
  aiPrediction: {
    floodProbability: number;
    daysAhead: number;
  };
  lastUpdate: string;
}

interface TileFeature {
  type: "Feature";
  id: string;
  properties: TileProperties;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

export interface TileHeatmapProps {
  visible: boolean;
  onTileClick?: (tile: TileProperties) => void;
  basinId?: string | null;
  basemapMode?: "light" | "imagery";
  onTilesLoaded?: (tiles: TileProperties[]) => void;
  focusCenter?: [number, number] | null;
}

const RISK_COLORS: Record<string, string> = {
  safe: "#10b981",      // green-500
  normal: "#84cc16",    // lime-500
  watch: "#eab308",     // yellow-500
  warning: "#f97316",   // orange-500
  critical: "#ef4444",  // red-500
};

const RISK_LABELS: Record<string, string> = {
  safe: "ปลอดภัย",
  normal: "ปกติ",
  watch: "เฝ้าระวัง",
  warning: "เตือนภัย",
  critical: "วิกฤต",
};

export default function TileHeatmap({
  visible,
  onTileClick,
  basinId,
  basemapMode = "light",
  onTilesLoaded,
  focusCenter,
}: TileHeatmapProps) {
  const [tiles, setTiles] = useState<TileFeature[]>([]);
  const [selectedTile, setSelectedTile] = useState<TileProperties | null>(null);
  const [loading, setLoading] = useState(true);
  const map = useMap();
  const [zoom, setZoom] = useState<number>(() => map.getZoom());

  const loadTiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await mapAPI.tiles({ basin_id: basinId || undefined });
      const feats = (res.data.features || []) as TileFeature[];
      setTiles(feats);
      onTilesLoaded?.(feats.map((f) => f.properties));
    } catch (error) {
      console.error("Failed to load tiles:", error);
    } finally {
      setLoading(false);
    }
  }, [basinId, onTilesLoaded]);

  useEffect(() => {
    if (visible) loadTiles();
  }, [visible, loadTiles]);

  useEffect(() => {
    if (!visible) return;
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map, visible]);

  useEffect(() => {
    if (!visible) return;
    if (!focusCenter) return;
    map.flyTo(focusCenter as L.LatLngExpression, Math.max(9, map.getZoom()), {
      duration: 0.8,
    });
  }, [focusCenter, map, visible]);

  const styleForContext = (riskLevel: string) => {
    const color = RISK_COLORS[riskLevel] || "#94a3b8";
    const isImagery = basemapMode === "imagery";
    const z = zoom;
    const fillOpacity = isImagery
      ? z <= 6
        ? 0.52
        : z <= 8
          ? 0.58
          : 0.65
      : z <= 6
        ? 0.35
        : z <= 8
          ? 0.44
          : 0.52;

    const weight = z <= 6 ? 0.7 : z <= 8 ? 0.9 : 1.2;
    const strokeOpacity = isImagery ? 0.9 : 0.75;
    const strokeColor = isImagery ? "rgba(15,23,42,0.55)" : "rgba(15,23,42,0.25)";

    return {
      fillColor: color,
      fillOpacity,
      color: strokeColor,
      weight,
      opacity: strokeOpacity,
    };
  };

  const getTileStyle = (feature: TileFeature) => {
    const riskLevel = feature.properties.riskLevel;
    return styleForContext(riskLevel);
  };

  const onEachFeature = (feature: TileFeature, layer: L.Layer) => {
    const props = feature.properties;
    
    // Hover effect
    layer.on({
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({
          fillOpacity: styleForContext(props.riskLevel).fillOpacity + 0.12,
          weight: Math.max(1.5, styleForContext(props.riskLevel).weight + 0.9),
          opacity: 1,
        });
      },
      mouseout: (e) => {
        const layer = e.target;
        layer.setStyle(styleForContext(props.riskLevel));
      },
      click: () => {
        setSelectedTile(props);
        if (onTileClick) {
          onTileClick(props);
        }
        // Zoom to tile
        map.flyTo(props.center as L.LatLngExpression, 9, { duration: 1 });
      },
    });

    // Tooltip on hover
    layer.bindTooltip(
      `
      <div class="map-tooltip-panel">
        <div class="map-tooltip-title">${RISK_LABELS[props.riskLevel] ?? props.riskLevel}</div>
        <div class="map-tooltip-meta">
          WL ${props.stats.avgWaterLevel.toFixed(1)} m · Rain ${props.stats.rainfall24h.toFixed(0)} mm
        </div>
        <div class="map-tooltip-code">${props.provinces.join(", ")}</div>
      </div>
      `,
      {
        sticky: true,
        className: "map-tooltip-mono",
      }
    );
  };

  if (!visible || loading) return null;

  return (
    <>
      <GeoJSON
        data={{ type: "FeatureCollection", features: tiles } as any}
        style={getTileStyle as any}
        onEachFeature={onEachFeature as any}
      />

      {selectedTile && (
        <Popup
          position={selectedTile.center as L.LatLngExpression}
          eventHandlers={{
            remove: () => setSelectedTile(null),
          }}
        >
          <div className="map-popup-panel">
            <div className="map-popup-title">
              {RISK_LABELS[selectedTile.riskLevel] ?? selectedTile.riskLevel}
            </div>
            <div className="map-popup-subtitle">
              {selectedTile.provinces?.slice(0, 3).join(", ") || "—"}
            </div>
            <div className="map-popup-rows">
              <div className="map-popup-row">
                <span className="map-popup-label">Avg water level</span>
                <span className="font-mono tabular-nums text-primary-900">
                  {selectedTile.stats.avgWaterLevel.toFixed(2)} m
                </span>
              </div>
              <div className="map-popup-row">
                <span className="map-popup-label">Rain (24h)</span>
                <span className="font-mono tabular-nums text-primary-900">
                  {selectedTile.stats.rainfall24h.toFixed(0)} mm
                </span>
              </div>
              <div className="map-popup-row">
                <span className="map-popup-label">Stations</span>
                <span className="font-mono tabular-nums text-primary-900">
                  {selectedTile.stats.stationCount.toLocaleString()}
                </span>
              </div>
              <div className="map-popup-row">
                <span className="map-popup-label">Population at risk</span>
                <span className="font-mono tabular-nums text-primary-900">
                  ~{selectedTile.stats.populationAtRisk.toLocaleString()}
                </span>
              </div>
              <div className="map-popup-row">
                <span className="map-popup-label">AI flood probability</span>
                <span className="font-mono tabular-nums text-primary-900">
                  {selectedTile.aiPrediction.floodProbability.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-200 text-[10px] text-gray-500 font-mono">
              tile_id={selectedTile.id} · updated {selectedTile.lastUpdate}
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}
