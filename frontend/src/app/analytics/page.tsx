"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/common/Navbar";
import api, { mapAPI } from "@/services/api";
import {
  TrendingUp,
  TrendingDown,
  Droplets,
  Cloud,
  AlertTriangle,
  Users,
  MapPin,
  Activity,
} from "lucide-react";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [dashboard, tiles] = await Promise.all([
        api.get("/api/dashboard/summary").then((r) => r.data),
        mapAPI.tilesSummary().then((r) => r.data),
      ]);
      
      setStats({ dashboard, tiles });
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </>
    );
  }

  const StatCard = ({ icon: Icon, label, value, change, color }: any) => (
    <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {change && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              change > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {change > 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Analytics Dashboard
            </h1>
            <p className="text-gray-600">
              วิเคราะห์ข้อมูลและแนวโน้มการเปลี่ยนแปลงของระดับน้ำ
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="mb-6 flex gap-2">
            {[
              { value: "24h", label: "24 ชั่วโมง" },
              { value: "7d", label: "7 วัน" },
              { value: "30d", label: "30 วัน" },
              { value: "90d", label: "90 วัน" },
            ].map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timeRange === range.value
                    ? "bg-primary-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              icon={Droplets}
              label="ระดับน้ำเฉลี่ย"
              value={`${stats?.dashboard?.avgWaterLevel?.toFixed(2) || "0.00"} ม.`}
              change={12}
              color="bg-blue-500"
            />
            <StatCard
              icon={Cloud}
              label="ปริมาณฝนสะสม"
              value={`${stats?.dashboard?.totalRainfall?.toFixed(0) || "0"} มม.`}
              change={-8}
              color="bg-sky-500"
            />
            <StatCard
              icon={AlertTriangle}
              label="พื้นที่เสี่ยง"
              value={stats?.tiles?.riskCounts?.critical + stats?.tiles?.riskCounts?.warning || 0}
              change={5}
              color="bg-orange-500"
            />
            <StatCard
              icon={Users}
              label="ประชากรเสี่ยง"
              value={`${(stats?.tiles?.totalPopulationAtRisk / 1000).toFixed(0)}K`}
              change={3}
              color="bg-red-500"
            />
          </div>

          {/* Risk Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Risk Levels Chart */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                การกระจายระดับความเสี่ยง
              </h3>
              <div className="space-y-3">
                {[
                  { level: "วิกฤต", count: stats?.tiles?.riskCounts?.critical || 0, color: "bg-red-500" },
                  { level: "เตือนภัย", count: stats?.tiles?.riskCounts?.warning || 0, color: "bg-orange-500" },
                  { level: "เฝ้าระวัง", count: stats?.tiles?.riskCounts?.watch || 0, color: "bg-yellow-500" },
                  { level: "ปกติ", count: stats?.tiles?.riskCounts?.normal || 0, color: "bg-lime-500" },
                  { level: "ปลอดภัย", count: stats?.tiles?.riskCounts?.safe || 0, color: "bg-green-500" },
                ].map((item) => {
                  const total = stats?.tiles?.totalTiles || 1;
                  const percentage = (item.count / total) * 100;
                  return (
                    <div key={item.level}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {item.level}
                        </span>
                        <span className="text-sm text-gray-600">
                          {item.count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`${item.color} h-3 rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Basin Statistics */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                สถิติตามลุ่มน้ำ
              </h3>
              <div className="space-y-4">
                {[
                  { name: "ลุ่มน้ำโขงตอนบน", stations: 6, avgLevel: 3.8, status: "warning" },
                  { name: "ลุ่มน้ำชายฝั่งตะวันออก", stations: 8, avgLevel: 3.2, status: "watch" },
                  { name: "ลุ่มน้ำภาคใต้ฝั่งตะวันออก", stations: 4, avgLevel: 2.9, status: "normal" },
                ].map((basin) => (
                  <div
                    key={basin.name}
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary-600" />
                        <span className="font-medium text-gray-900">
                          {basin.name}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          basin.status === "warning"
                            ? "bg-orange-100 text-orange-700"
                            : basin.status === "watch"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {basin.status === "warning"
                          ? "เตือนภัย"
                          : basin.status === "watch"
                          ? "เฝ้าระวัง"
                          : "ปกติ"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">สถานี:</span>
                        <span className="ml-2 font-medium">{basin.stations}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">ระดับน้ำ:</span>
                        <span className="ml-2 font-medium">{basin.avgLevel} ม.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trend Analysis */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              การวิเคราะห์แนวโน้ม
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Activity className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-900 mb-1">
                  +12%
                </div>
                <div className="text-sm text-gray-600">
                  ระดับน้ำเพิ่มขึ้น (7 วัน)
                </div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-900 mb-1">
                  68%
                </div>
                <div className="text-sm text-gray-600">
                  ความแม่นยำของ AI
                </div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-900 mb-1">
                  -5%
                </div>
                <div className="text-sm text-gray-600">
                  ประชากรเสี่ยงลดลง
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              กิจกรรมล่าสุด
            </h3>
            <div className="space-y-3">
              {[
                { time: "5 นาทีที่แล้ว", event: "ระดับน้ำเพิ่มขึ้น 0.2 ม. ที่สถานี กทม-01", type: "warning" },
                { time: "15 นาทีที่แล้ว", event: "AI ทำนายโอกาสน้ำท่วม 75% ในพื้นที่ภาคเหนือ", type: "critical" },
                { time: "1 ชั่วโมงที่แล้ว", event: "ข้อมูลดาวเทียมอัพเดทสำเร็จ", type: "success" },
                { time: "2 ชั่วโมงที่แล้ว", event: "ระดับน้ำลดลงที่ลุ่มน้ำภาคใต้", type: "success" },
              ].map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${
                      activity.type === "critical"
                        ? "bg-red-500"
                        : activity.type === "warning"
                        ? "bg-orange-500"
                        : "bg-green-500"
                    }`}
                  ></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.event}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
