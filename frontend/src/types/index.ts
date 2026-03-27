export type RiskLevel = "normal" | "watch" | "warning" | "critical";

export interface Basin {
  id: string;
  name: string;
  provinces: string[];
  current_water_level: number | null;
  today_rainfall_mm: number;
  risk_level: RiskLevel;
  prediction: {
    flood_probability: number | null;
    target_date: string | null;
    affected_area_sqkm: number | null;
    model_accuracy: number | null;
  } | null;
}

export interface DashboardOverview {
  timestamp: string;
  active_alerts: number;
  model_accuracy: number | null;
  basins: Basin[];
  summary: {
    total_basins: number;
    critical_count: number;
    warning_count: number;
  };
}

export interface Alert {
  id: number;
  basin_id: string;
  level: RiskLevel;
  title: string;
  message: string;
  trigger_type: string;
  trigger_value: number;
  created_at: string;
  acknowledged: boolean;
}

export interface PredictionResult {
  prediction_id: number;
  basin_id: string;
  basin_name: string;
  predict_date: string;
  target_date: string;
  days_ahead: number;
  flood_probability: number;
  risk_level: RiskLevel;
  predicted_water_level: number;
  affected_area_sqkm: number;
  confidence: number;
  model_version: string;
  input_summary: {
    satellite_records: number;
    water_records: number;
    rainfall_records: number;
  };
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
  properties?: Record<string, unknown>;
}

export interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, any>;
  geometry: {
    type: string;
    coordinates: any;
  };
}
