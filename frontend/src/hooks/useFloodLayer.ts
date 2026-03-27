import { useState, useEffect, useCallback } from "react";
import { dataClient } from "@/services/dataClient";
import type { GeoJSONFeatureCollection } from "@/types";

export interface FloodLayerState {
  geojson: GeoJSONFeatureCollection | null;
  dates: string[];
  selectedDate: string | null;
  loading: boolean;
  loadingDates: boolean;
  error: string | null;
  setSelectedDate: (d: string) => void;
  refresh: () => void;
}

export function useFloodLayer(
  basinId: string | null,
  enabled: boolean
): FloodLayerState {
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !basinId) {
      setDates([]);
      setSelectedDate(null);
      setGeojson(null);
      setError(null);
      return;
    }

    setLoadingDates(true);
    dataClient
      .getOnwrDatesByAppBasin(basinId)
      .then((d) => {
        setDates(d);
        if (d.length > 0) {
          setSelectedDate((prev) =>
            prev && d.includes(prev) ? prev : d[d.length - 1]
          );
        } else {
          setSelectedDate(null);
        }
      })
      .catch(() => setDates([]))
      .finally(() => setLoadingDates(false));
  }, [enabled, basinId]);

  const fetchLayer = useCallback(() => {
    if (!enabled || !basinId || !selectedDate) return;

    setLoading(true);
    setError(null);
    dataClient
      .getOnwrFloodLayerByAppBasin(basinId, selectedDate)
      .then((fc) => setGeojson(fc as GeoJSONFeatureCollection))
      .catch((e: { response?: { data?: { detail?: string } } }) => {
        setError(
          e?.response?.data?.detail ??
            (e instanceof Error ? e.message : "Failed to load flood layer")
        );
        setGeojson(null);
      })
      .finally(() => setLoading(false));
  }, [enabled, basinId, selectedDate]);

  useEffect(() => {
    fetchLayer();
  }, [fetchLayer, tick]);

  return {
    geojson,
    dates,
    selectedDate,
    loading,
    loadingDates,
    error,
    setSelectedDate,
    refresh: () => setTick((t) => t + 1),
  };
}
