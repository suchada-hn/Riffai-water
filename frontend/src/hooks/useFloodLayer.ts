import { useState, useEffect, useCallback } from "react";
import api, { mapAPI } from "@/services/api";
import { APP_TO_ONWR_BASIN } from "@/constants/onwrBasins";
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

    const pipelineName = APP_TO_ONWR_BASIN[basinId];
    if (!pipelineName) {
      setDates([]);
      setSelectedDate(null);
      setGeojson(null);
      setError(null);
      return;
    }

    setLoadingDates(true);
    api
      .get<{ dates?: string[] }>(`/api/basins/${encodeURIComponent(pipelineName)}/dates`)
      .then((res) => {
        const d: string[] = res.data?.dates ?? [];
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
    if (!APP_TO_ONWR_BASIN[basinId]) return;

    setLoading(true);
    setError(null);
    mapAPI
      .floodLayer(basinId, selectedDate)
      .then((res) => setGeojson(res.data as GeoJSONFeatureCollection))
      .catch((e: { response?: { data?: { detail?: string } } }) => {
        setError(e?.response?.data?.detail ?? "Failed to load flood layer");
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
