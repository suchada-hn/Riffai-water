"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import TimelapseControl from "./TimelapseControl";
import { mapAPI } from "@/services/api";

interface TimelapseHeatmapProps {
  visible: boolean;
  startDate: Date;
  endDate: Date;
  basinId?: string | null;
  basemapMode?: "light" | "imagery";
}

const RISK_COLORS: Record<string, string> = {
  safe: "#10b981",
  normal: "#84cc16",
  watch: "#eab308",
  warning: "#f97316",
  critical: "#ef4444",
};

export default function TimelapseHeatmap({
  visible,
  startDate,
  endDate,
  basinId,
  basemapMode = "light",
}: TimelapseHeatmapProps) {
  const [currentDate, setCurrentDate] = useState(endDate);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tiles, setTiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const map = useMap();
  const [zoom, setZoom] = useState<number>(() => map.getZoom());

  const loadTilesForDate = useCallback(
    async (date: Date) => {
      try {
        setLoading(true);
        const day = date.toISOString().slice(0, 10);
        const res = await mapAPI.tiles({
          basin_id: basinId || undefined,
          date: day,
        });
        setTiles(res.data.features || []);
      } catch (error) {
        console.error("Failed to load tiles:", error);
      } finally {
        setLoading(false);
      }
    },
    [basinId],
  );

  useEffect(() => {
    if (visible) loadTilesForDate(currentDate);
  }, [visible, currentDate, loadTilesForDate]);

  useEffect(() => {
    if (!visible) return;
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map, visible]);

  useEffect(() => {
    if (isPlaying) {
      const interval = 1000 / speed; // milliseconds per day
      intervalRef.current = setInterval(() => {
        setCurrentDate((prev) => {
          const next = new Date(prev.getTime() + 24 * 60 * 60 * 1000);
          if (next > endDate) {
            setIsPlaying(false);
            return endDate;
          }
          return next;
        });
      }, interval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, speed, endDate]);

  const styleForContext = (riskLevel: string) => {
    const color = RISK_COLORS[riskLevel] || "#94a3b8";
    const isImagery = basemapMode === "imagery";
    const z = zoom;
    const fillOpacity = isImagery
      ? z <= 6
        ? 0.5
        : z <= 8
          ? 0.56
          : 0.62
      : z <= 6
        ? 0.34
        : z <= 8
          ? 0.42
          : 0.5;

    const weight = z <= 6 ? 0.7 : z <= 8 ? 0.9 : 1.2;
    const strokeOpacity = isImagery ? 0.9 : 0.75;
    const strokeColor = isImagery
      ? "rgba(15,23,42,0.55)"
      : "rgba(15,23,42,0.25)";

    return {
      fillColor: color,
      fillOpacity,
      color: strokeColor,
      weight,
      opacity: strokeOpacity,
    };
  };

  const getTileStyle = (feature: any) => {
    return styleForContext(feature?.properties?.riskLevel);
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const props = feature.properties;
    
    layer.bindTooltip(
      `
      <div class="map-tooltip-panel">
        <div class="map-tooltip-title">${String(props.riskLevel || "").toUpperCase()}</div>
        <div class="map-tooltip-meta">
          WL ${props.stats.avgWaterLevel.toFixed(1)} m · Rain ${props.stats.rainfall24h.toFixed(0)} mm
        </div>
      </div>
      `,
      { sticky: true, className: "map-tooltip-mono" }
    );
  };

  if (!visible) return null;

  return (
    <>
      {!loading && tiles.length > 0 && (
        <GeoJSON
          key={currentDate.toISOString()}
          data={{ type: "FeatureCollection", features: tiles } as any}
          style={getTileStyle as any}
          onEachFeature={onEachFeature as any}
        />
      )}

      <TimelapseControl
        currentDate={currentDate}
        startDate={startDate}
        endDate={endDate}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onDateChange={setCurrentDate}
        speed={speed}
        onSpeedChange={setSpeed}
      />

      {loading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white rounded-lg shadow-lg px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        </div>
      )}
    </>
  );
}
