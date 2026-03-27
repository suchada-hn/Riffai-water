import { mapAPI, onwrAPI, pipelineAPI } from "@/services/api";
import type { GeoJSONFeatureCollection } from "@/types";
import {
  appBasinToPipelineOrNull,
  resolveDataMode,
  STATIC_DATA_CONTRACT,
  staticDataUrl,
} from "@/constants/staticDataContract";
import {
  isOnwrPublicGcsStatsEnabled,
  onwrPublicDatesJsonUrl,
  onwrPublicSubBasinZScoreUrl,
} from "@/constants/onwrStatsPublicUrls";

export interface OnwrAlertItem {
  pipeline_basin: string;
  app_basin_id?: string;
  HYBAS_ID?: number;
  name?: string;
  date: string;
  mean_z_score?: number;
}

interface OnwrAlertsPayload {
  alerts?: OnwrAlertItem[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (HTTP ${res.status})`);
  }
  return (await res.json()) as T;
}

export function isStaticDataMode(): boolean {
  return resolveDataMode() === "static";
}

export const dataClient = {
  async getBasins(): Promise<GeoJSONFeatureCollection> {
    if (!isStaticDataMode()) {
      const { data } = await mapAPI.basins();
      return data as GeoJSONFeatureCollection;
    }
    return fetchJson<GeoJSONFeatureCollection>(
      staticDataUrl(STATIC_DATA_CONTRACT.map.basins)
    );
  },

  async getRivers(): Promise<GeoJSONFeatureCollection> {
    if (!isStaticDataMode()) {
      const { data } = await mapAPI.rivers();
      return data as GeoJSONFeatureCollection;
    }
    return fetchJson<GeoJSONFeatureCollection>(
      staticDataUrl(STATIC_DATA_CONTRACT.map.rivers)
    );
  },

  async getDams(): Promise<GeoJSONFeatureCollection> {
    if (!isStaticDataMode()) {
      const { data } = await mapAPI.dams();
      return data as GeoJSONFeatureCollection;
    }
    return fetchJson<GeoJSONFeatureCollection>(
      staticDataUrl(STATIC_DATA_CONTRACT.map.dams)
    );
  },

  async getWaterLevelMap(
    basinId?: string
  ): Promise<GeoJSONFeatureCollection | null> {
    if (!isStaticDataMode()) {
      const { data } = await mapAPI.waterLevelMap(basinId);
      return data as GeoJSONFeatureCollection;
    }
    try {
      const fc = await fetchJson<GeoJSONFeatureCollection>(
        staticDataUrl(STATIC_DATA_CONTRACT.map.waterLevelMap)
      );
      if (!basinId) return fc;
      return {
        ...fc,
        features: (fc.features || []).filter((f) => f?.properties?.basin_id === basinId),
      };
    } catch {
      return null;
    }
  },

  async getSubbasins(
    basinId: string
  ): Promise<GeoJSONFeatureCollection | null> {
    if (!isStaticDataMode()) {
      const { data } = await mapAPI.subbasins(basinId);
      return data as GeoJSONFeatureCollection;
    }
    try {
      return await fetchJson<GeoJSONFeatureCollection>(
        staticDataUrl(STATIC_DATA_CONTRACT.map.subbasinsByBasin(basinId))
      );
    } catch {
      return null;
    }
  },

  async getTilesSummary(basinId?: string): Promise<Record<string, unknown> | null> {
    if (!isStaticDataMode()) {
      const { data } = await mapAPI.tilesSummary({ basin_id: basinId || undefined });
      return data as Record<string, unknown>;
    }
    try {
      return await fetchJson<Record<string, unknown>>(
        staticDataUrl(STATIC_DATA_CONTRACT.map.tilesSummaryByBasin(basinId))
      );
    } catch {
      return null;
    }
  },

  async getOnwrDatesByAppBasin(basinId: string): Promise<string[]> {
    const pipeline = appBasinToPipelineOrNull(basinId);
    if (!pipeline) return [];
    // 1) Public HTTPS bucket layout (GCS-shaped paths); works without backend.
    if (isOnwrPublicGcsStatsEnabled()) {
      try {
        const payload = await fetchJson<{ dates?: string[] }>(
          onwrPublicDatesJsonUrl(pipeline)
        );
        return payload.dates ?? [];
      } catch {
        return [];
      }
    }
    if (!isStaticDataMode()) {
      const { data } = await onwrAPI.dates(pipeline);
      return (data?.dates ?? []) as string[];
    }
    try {
      const payload = await fetchJson<{ dates?: string[] }>(
        staticDataUrl(STATIC_DATA_CONTRACT.onwr.dates(pipeline))
      );
      return payload.dates ?? [];
    } catch {
      return [];
    }
  },

  async getOnwrFloodLayerByAppBasin(
    basinId: string,
    date: string
  ): Promise<GeoJSONFeatureCollection> {
    const pipeline = appBasinToPipelineOrNull(basinId);
    if (!pipeline) {
      throw new Error(`Unsupported basin id: ${basinId}`);
    }
    // 1) Public HTTPS — same object layout as `gs://…/Model_Output_v2_Stats/…`
    if (isOnwrPublicGcsStatsEnabled()) {
      return fetchJson<GeoJSONFeatureCollection>(
        onwrPublicSubBasinZScoreUrl(pipeline, date)
      );
    }
    if (!isStaticDataMode()) {
      const { data } = await mapAPI.floodLayer(basinId, date);
      return data as GeoJSONFeatureCollection;
    }
    return fetchJson<GeoJSONFeatureCollection>(
      staticDataUrl(STATIC_DATA_CONTRACT.onwr.stats(pipeline, date))
    );
  },

  async getOnwrNationalStats(): Promise<GeoJSONFeatureCollection | null> {
    if (!isStaticDataMode()) {
      const { data } = await onwrAPI.thailandSubbasinStatsUrl();
      if (!data?.url) return null;
      return fetchJson<GeoJSONFeatureCollection>(String(data.url));
    }
    try {
      return await fetchJson<GeoJSONFeatureCollection>(
        staticDataUrl(STATIC_DATA_CONTRACT.onwr.national)
      );
    } catch {
      return null;
    }
  },

  async getOnwrFloodAlertsLatest(limit = 200): Promise<OnwrAlertItem[]> {
    if (!isStaticDataMode()) {
      const { data } = await onwrAPI.floodAlertsLatest(limit);
      const alerts = (data?.alerts ?? []) as OnwrAlertItem[];
      return alerts.slice(0, limit);
    }
    try {
      const payload = await fetchJson<OnwrAlertsPayload>(
        staticDataUrl(STATIC_DATA_CONTRACT.onwr.latestAlerts)
      );
      return (payload.alerts ?? []).slice(0, limit);
    } catch {
      return [];
    }
  },

  async refreshWaterPipeline(basinId?: string): Promise<void> {
    if (isStaticDataMode()) return;
    await pipelineAPI.fetchWater(basinId || undefined);
  },
};
