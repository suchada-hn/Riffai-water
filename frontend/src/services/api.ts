import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Auto attach token
api.interceptors.request.use((config) => {
  // #region agent log
  if (typeof window !== "undefined") {
    const dbg = {
      sessionId: "0ae64a",
      runId: "pre-fix",
      hypothesisId: "H1",
      location: "frontend/src/services/api.ts:request-interceptor",
      message: "Axios request config (baseURL/url)",
      data: {
        apiUrlEnv: process.env.NEXT_PUBLIC_API_URL ? "[set]" : "[unset]",
        apiUrlDefault: API_URL,
        baseURL: config.baseURL,
        url: config.url,
        method: config.method,
      },
      timestamp: Date.now(),
    };
    fetch("http://127.0.0.1:7908/ingest/8ecea870-d1d6-42b5-905e-45e03cf5df70", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0ae64a" },
      body: JSON.stringify(dbg),
    }).catch(() => {});
  }
  // #endregion

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("riffai_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    // #region agent log
    if (typeof window !== "undefined") {
      const cfg = error?.config;
      const resp = error?.response;
      const dbg = {
        sessionId: "0ae64a",
        runId: "pre-fix",
        hypothesisId: "H2",
        location: "frontend/src/services/api.ts:response-error-interceptor",
        message: "Axios response error (network/config)",
        data: {
          message: error?.message,
          code: error?.code,
          name: error?.name,
          baseURL: cfg?.baseURL,
          url: cfg?.url,
          method: cfg?.method,
          timeout: cfg?.timeout,
          status: resp?.status,
          statusText: resp?.statusText,
        },
        timestamp: Date.now(),
      };
      fetch("http://127.0.0.1:7908/ingest/8ecea870-d1d6-42b5-905e-45e03cf5df70", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0ae64a" },
        body: JSON.stringify(dbg),
      }).catch(() => {});
    }
    // #endregion
    return Promise.reject(error);
  }
);

// ═══════════ Auth ═══════════
export const authAPI = {
  login: (email: string, password: string) =>
    api.post("/api/auth/login", { email, password }),
  register: (data: { email: string; name: string; password: string; organization?: string }) =>
    api.post("/api/auth/register", data),
  me: () => api.get("/api/auth/me"),
};

// ═══════════ Dashboard ═══════════
export const dashboardAPI = {
  overview: () => api.get("/api/dashboard/overview"),
  basinStats: (basinId: string, days = 30) =>
    api.get(`/api/dashboard/stats/${basinId}`, { params: { days } }),
};

// ═══════════ Map ═══════════
export const mapAPI = {
  basins: () => api.get("/api/map/basins"),
  subbasins: (basinId: string) => api.get("/api/map/subbasins", { params: { basin_id: basinId } }),
  rivers: () => api.get("/api/map/rivers"),
  dams: () => api.get("/api/map/dams"),
  stations: (basinId?: string) =>
    api.get("/api/map/stations", { params: { basin_id: basinId } }),
  waterLevelMap: (basinId?: string) =>
    api.get("/api/map/water-level-map", { params: { basin_id: basinId } }),
  floodLayer: (basinId: string, date?: string) =>
    api.get(`/api/map/flood-layer/${basinId}`, { params: { date } }),
  satellite: (basinId: string, index = "ndwi") =>
    api.get(`/api/map/satellite/${basinId}`, { params: { index } }),
  tiles: (params?: { risk_level?: string; basin_id?: string; date?: string }) =>
    api.get("/api/map/tiles", { params }),
  tilesSummary: (params?: { basin_id?: string; date?: string }) =>
    api.get("/api/map/tiles/summary", { params }),
  tile: (tileId: string) => api.get(`/api/map/tiles/${tileId}`),
  tileHistory: (tileId: string, days = 7) =>
    api.get(`/api/map/tiles/${tileId}/history`, { params: { days } }),
  tileSatellite: (tileId: string) =>
    api.get(`/api/map/tiles/${tileId}/satellite`),
};

// ═══════════ Prediction ═══════════
export const predictAPI = {
  flood: (basinId: string, daysAhead = 30) =>
    api.post("/api/predict/flood", null, {
      params: { basin_id: basinId, days_ahead: daysAhead },
    }),
  history: (basinId: string, days = 90) =>
    api.get(`/api/predict/history/${basinId}`, { params: { days } }),
  accuracy: () => api.get("/api/predict/accuracy"),
};

// ═══════════ Alerts ═══════════
export const alertsAPI = {
  active: (basinId?: string) =>
    api.get("/api/alerts/active", { params: { basin_id: basinId } }),
  check: () => api.post("/api/alerts/check"),
  acknowledge: (id: number) => api.put(`/api/alerts/${id}/acknowledge`),
  resolve: (id: number) => api.put(`/api/alerts/${id}/resolve`),
  history: (days = 30) => api.get("/api/alerts/history", { params: { days } }),
};

// ═══════════ Data ═══════════
export const dataAPI = {
  waterLevel: (basinId: string, days = 30) =>
    api.get(`/api/data/water-level/${basinId}`, { params: { days } }),
  rainfall: (basinId: string, days = 30, aggregate = "daily") =>
    api.get(`/api/data/rainfall/${basinId}`, { params: { days, aggregate } }),
  satelliteIndices: (basinId: string, days = 365) =>
    api.get(`/api/data/satellite-indices/${basinId}`, { params: { days } }),
  comparison: (basinId: string, year1: number, year2: number) =>
    api.get(`/api/data/comparison/${basinId}`, { params: { year1, year2 } }),
};

// ═══════════ Tambon Flood Prediction ═══════════
export const tambonAPI = {
  getTambon: (tbIdn: string) =>
    api.get(`/api/flood/tambon/${tbIdn}`),
  getProvinceTambons: (provinceName: string) =>
    api.get(`/api/flood/tambon/province/${provinceName}`),
  getTopRisk: (limit = 100) =>
    api.get("/api/flood/tambon/top-risk", { params: { limit } }),
  search: (query: string) =>
    api.get("/api/flood/tambon/search", { params: { q: query } }),
  getStats: () =>
    api.get("/api/flood/tambon/stats"),
  getBasinSummary: (basinId: string) =>
    api.get(`/api/flood/tambon/basin/${basinId}/summary`),
  getMapGeoJSON: (params?: { risk_level?: string; min_probability?: number; limit?: number }) =>
    api.get("/api/flood/tambon/map/geojson", { params }),
};

// ═══════════ Pipeline ═══════════
export const pipelineAPI = {
  fetchWater: (basinId?: string) =>
    api.post("/api/pipeline/fetch-water", null, {
      params: { basin_id: basinId },
    }),
  fetchSatellite: (basinId?: string) =>
    api.post("/api/pipeline/fetch-satellite", null, {
      params: { basin_id: basinId },
    }),
};

// ═══════════ Reports ═══════════
export const reportsAPI = {
  daily: (date?: string) =>
    api.get("/api/reports/daily", { params: { date } }),
};

export default api;
