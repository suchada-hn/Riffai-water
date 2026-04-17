"use client";

import { useEffect, useState } from "react";
import { Layers, AlertTriangle, Brain, AlertCircle, RefreshCw } from "lucide-react";
import Navbar from "@/components/common/Navbar";
import StatCard from "@/components/common/StatCard";
import BasinCard from "@/components/dashboard/BasinCard";
import WaterLevelChart from "@/components/charts/WaterLevelChart";
import RainfallChart from "@/components/charts/RainfallChart";
import { dashboardAPI, dataAPI, pipelineAPI } from "@/services/api";
import { DashboardOverview } from "@/types";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [waterData, setWaterData] = useState<any[]>([]);
  const [rainData, setRainData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);

  const loadData = async () => {
    try {
      const [res, status] = await Promise.all([
        dashboardAPI.overview(),
        pipelineAPI.status().catch(() => null),
      ]);
      setOverview(res.data);
      setIntegrationStatus(status?.data ?? null);

      // ดึงข้อมูลกราฟของลุ่มน้ำแรก
      const firstBasin = res.data.basins?.[0]?.id;
      if (firstBasin) {
        const [water, rain] = await Promise.all([
          dataAPI.waterLevel(firstBasin, 30).catch(() => ({ data: { data: [] } })),
          dataAPI.rainfall(firstBasin, 30, "daily").catch(() => ({ data: { data: [] } })),
        ]);
        setWaterData(water.data.data || []);
        setRainData(rain.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    setSyncing(true);
    try {
      await pipelineAPI.fetchWater();
      await pipelineAPI.fetchSatellite();
      toast.success("Data synchronized successfully");
      await loadData();
    } catch (err) {
      toast.error("Synchronization failed");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen bg-white">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-900 rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-primary-600 font-medium">Loading system data...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-primary-900">
            <div>
              <h1 className="text-4xl font-bold text-primary-900 tracking-tight">
                Water Situation Overview
              </h1>
              <p className="text-sm text-primary-600 mt-2 font-mono">
                Last updated:{" "}
                {overview?.timestamp
                  ? new Date(overview.timestamp).toLocaleString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </p>
              {integrationStatus && (
                <div className="mt-2 text-xs text-primary-600 font-mono">
                  Forecast feed:{" "}
                  <span className="font-semibold text-primary-900">
                    {integrationStatus?.gcs?.forecast?.fresh ? "fresh" : "stale"}
                  </span>
                  {" · "}
                  SAR feed:{" "}
                  <span className="font-semibold text-primary-900">
                    {integrationStatus?.gcs?.sar?.fresh ? "fresh" : "stale"}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={syncData}
              disabled={syncing}
              className="btn-mono text-sm flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? "Syncing..." : "Sync Data"}
            </button>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Layers}
              label="Total Basins"
              value={overview?.summary?.total_basins?.toString() || "0"}
              color="black"
            />
            <StatCard
              icon={AlertTriangle}
              label="Active Alerts"
              value={overview?.active_alerts?.toString() || "0"}
              color="black"
            />
            <StatCard
              icon={Brain}
              label="AI Accuracy"
              value={
                overview?.model_accuracy
                  ? `${(overview.model_accuracy * 100).toFixed(1)}%`
                  : "—"
              }
              color="black"
            />
            <StatCard
              icon={AlertCircle}
              label="Critical Status"
              value={overview?.summary?.critical_count?.toString() || "0"}
              color="black"
            />
          </div>

          {/* Basin Cards */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6 text-primary-900 tracking-tight">
              Target Basin Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {overview?.basins?.map((basin) => (
                <BasinCard key={basin.id} basin={basin} />
              ))}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <WaterLevelChart data={waterData} />
            <RainfallChart data={rainData} />
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-primary-600 py-8 border-t border-primary-200 mt-12">
            <div className="font-semibold text-primary-900 mb-1">
              RIFFAI Platform v1.0
            </div>
            <div className="font-mono text-xs">
              Supported by National Innovation Agency (NIA) • In collaboration with Office of National Water Resources (ONWR)
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
