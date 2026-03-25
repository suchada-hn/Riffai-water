"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Brain, Settings, Calendar, Droplets, Maximize2, Target, Cpu, Database, TrendingUp, Clock, MapPin, Layers, Map } from "lucide-react";
import Navbar from "@/components/common/Navbar";
import RiskBadge from "@/components/common/RiskBadge";
import FloodDepthLegend from "@/components/prediction/FloodDepthLegend";
import { predictAPI, pipelineAPI } from "@/services/api";
import { PredictionResult } from "@/types";
import toast from "react-hot-toast";

const BASINS = [
  { id: "mekong_north", name: "ลุ่มน้ำโขงเหนือ" },
  { id: "eastern_coast", name: "ลุ่มน้ำชายฝั่งทะเลตะวันออก" },
  { id: "southern_east", name: "ลุ่มน้ำภาคใต้ฝั่งตะวันออกตอนล่าง" },
];

function PredictContent() {
  const searchParams = useSearchParams();
  const [basinId, setBasinId] = useState<string>(() => {
    return searchParams?.get("basin") || "mekong_north";
  });
  const [daysAhead, setDaysAhead] = useState(30);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    predictAPI
      .history(basinId)
      .then((res) => setHistory(res.data.predictions || []))
      .catch(() => {});
  }, [basinId, result]);

  const prepareAndPredict = async () => {
    if (!basinId) {
      toast.error("กรุณาเลือกลุ่มน้ำก่อนรันการทำนาย");
      return;
    }
    setPreparing(true);
    try {
      toast.loading("กำลังดึงข้อมูลล่าสุด...", { id: "predict" });
      await pipelineAPI.fetchWater(basinId);
      await pipelineAPI.fetchSatellite(basinId);
      toast.loading("กำลังรัน AI Model...", { id: "predict" });
    } catch {
      // ไม่เป็นไร ใช้ข้อมูลเก่าได้
    }
    setPreparing(false);

    setLoading(true);
    try {
      const res = await predictAPI.flood(basinId, daysAhead);
      setResult(res.data);
      toast.success("พยากรณ์สำเร็จ!", { id: "predict" });
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "เกิดข้อผิดพลาด",
        { id: "predict" }
      );
    } finally {
      setLoading(false);
    }
  };

  const probColor = (prob: number) => {
    if (prob > 0.7) return "text-red-600";
    if (prob > 0.4) return "text-orange-600";
    if (prob > 0.2) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 pb-6 border-b-2 border-primary-900">
          <h1 className="text-4xl font-bold text-primary-900 tracking-tight flex items-center gap-3">
            <Brain className="w-9 h-9" strokeWidth={2.5} />
            AI Flood Prediction
          </h1>
          <p className="text-sm text-primary-600 mt-2 font-mono">
            Advanced machine learning model for flood forecasting
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Config */}
          <div className="space-y-6">
            <div className="card-mono p-6">
              <h3 className="font-bold mb-4 text-primary-900 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configuration
              </h3>

              {/* Basin */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">
                  Select Basin
                </label>
                <div className="space-y-2">
                  {BASINS.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBasinId(b.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-mono border text-sm transition-all font-medium ${
                        basinId === b.id
                          ? "bg-primary-900 border-primary-900 text-white"
                          : "border-primary-300 hover:bg-primary-50 text-primary-700"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Days */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">
                  Forecast Period
                </label>
                <div className="flex gap-2">
                  {[7, 14, 30, 60, 90].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDaysAhead(d)}
                      className={`px-3 py-1.5 rounded-mono text-sm transition-all font-mono ${
                        daysAhead === d
                          ? "bg-primary-900 text-white"
                          : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Run button */}
              <button
                onClick={prepareAndPredict}
                disabled={loading || preparing}
                className="w-full btn-mono py-3 font-medium flex items-center justify-center gap-2"
              >
                {preparing ? (
                  <>
                    <Database className="w-4 h-4 animate-pulse" />
                    Fetching Data...
                  </>
                ) : loading ? (
                  <>
                    <Brain className="w-4 h-4 animate-pulse" />
                    Processing AI...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    Run Prediction
                  </>
                )}
              </button>
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="card-mono p-6">
                <h3 className="font-bold mb-4 text-primary-900 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Recent History
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {history.slice(0, 10).map((h: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 bg-primary-50 border border-primary-200 rounded-mono text-xs"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-primary-600 font-mono">
                          {new Date(h.predict_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "2-digit",
                          })}
                        </div>
                        <RiskBadge level={h.risk_level} size="sm" />
                      </div>
                      <div className="text-primary-500 font-mono text-[10px]">
                        → {new Date(h.target_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "2-digit",
                        })}
                      </div>
                      <div className="font-bold mt-1 text-primary-900 font-mono">
                        {(h.flood_probability * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Result */}
          <div className="lg:col-span-2">
            {result ? (
              <div className="space-y-6">
                {/* Main Result Card */}
                <div className="card-mono p-8">
                  <h3 className="text-xl font-bold mb-6 text-primary-900 tracking-tight flex items-center gap-2">
                    <TrendingUp className="w-6 h-6" />
                    Prediction Results
                  </h3>

                  {/* Big number */}
                  <div className="text-center mb-6 pb-6 border-b border-primary-200">
                    <div className="text-7xl font-bold text-primary-900 font-mono">
                      {(result.flood_probability * 100).toFixed(1)}%
                    </div>
                    <div className="text-primary-600 mt-2 text-sm uppercase tracking-wider font-semibold">
                      Flood Probability
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="mb-8 h-3 bg-primary-200 rounded-mono overflow-hidden">
                    <div
                      className="h-full bg-primary-900 transition-all duration-500"
                      style={{
                        width: `${Math.min(result.flood_probability * 100, 100)}%`,
                      }}
                    />
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <DetailBox
                      icon={MapPin}
                      label="Basin"
                      value={result.basin_name}
                    />
                    <DetailBox
                      icon={Calendar}
                      label="Target Date"
                      value={new Date(result.target_date).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "2-digit", year: "numeric" }
                      )}
                    />
                    <DetailBox
                      icon={Droplets}
                      label="Predicted Level"
                      value={`${result.predicted_water_level.toFixed(2)} m`}
                    />
                    <DetailBox
                      icon={Maximize2}
                      label="Affected Area"
                      value={`${result.affected_area_sqkm.toFixed(0)} km²`}
                    />
                    <DetailBox
                      icon={Target}
                      label="Confidence"
                      value={`${(result.confidence * 100).toFixed(1)}%`}
                    />
                    <DetailBox
                      icon={Cpu}
                      label="Model Version"
                      value={result.model_version}
                    />
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-6">
                    <RiskBadge level={result.risk_level} size="lg" />
                  </div>

                  {/* Input summary */}
                  <div className="mt-6 p-4 bg-primary-50 border border-primary-200 rounded-mono text-xs text-primary-700 font-mono">
                    <div className="flex items-center justify-center gap-4">
                      <span>Satellite: {result.input_summary.satellite_records}</span>
                      <span>•</span>
                      <span>Water: {result.input_summary.water_records}</span>
                      <span>•</span>
                      <span>Rainfall: {result.input_summary.rainfall_records}</span>
                    </div>
                  </div>
                </div>

                {/* Flood Depth Visualization */}
                <div className="card-mono p-6">
                  <h3 className="text-lg font-bold mb-4 text-primary-900 tracking-tight flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    Flood Depth Analysis
                  </h3>
                  
                  {/* Legend */}
                  <div className="mb-4">
                    <FloodDepthLegend />
                  </div>

                  {/* Visualization placeholder */}
                  <div className="aspect-video bg-primary-50 border-2 border-primary-200 rounded-mono flex items-center justify-center">
                    <div className="text-center">
                      <Map className="w-12 h-12 mx-auto mb-3 text-primary-400" strokeWidth={1.5} />
                      <div className="text-sm text-primary-600 font-medium">
                        Flood depth heatmap visualization
                      </div>
                      <div className="text-xs text-primary-500 mt-1 font-mono">
                        Integration with mapping service required
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-mono p-12 text-center">
                <Brain className="w-20 h-20 mx-auto mb-4 text-primary-400" strokeWidth={1.5} />
                <h3 className="text-xl font-bold text-primary-900 mb-2">
                  AI Flood Prediction System
                </h3>
                <p className="text-primary-600 mb-6 text-sm">
                  Select basin → Choose forecast period → Run prediction
                </p>
                <div className="text-xs text-primary-500 space-y-1 font-mono max-w-md mx-auto">
                  <div>CNN + LSTM analysis of Sentinel-1/2 satellite imagery</div>
                  <div>
                    Combined with water level, rainfall, and NDVI/NDWI/MNDWI indices
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailBox({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-primary-50 border border-primary-200 rounded-mono p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-primary-600" strokeWidth={2.5} />
        <div className="text-xs text-primary-600 font-semibold uppercase tracking-wider">
          {label}
        </div>
      </div>
      <div className="font-bold text-primary-900 font-mono">{value}</div>
    </div>
  );
}

export default function PredictPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <PredictContent />
      </Suspense>
    </>
  );
}
