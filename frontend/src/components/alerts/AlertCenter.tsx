"use client";

import { useState, useEffect } from "react";
import { Bell, X, AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/services/api";

interface Alert {
  id: number;
  type: "info" | "warning" | "critical" | "success";
  title: string;
  message: string;
  location?: string;
  timestamp: string;
  read: boolean;
}

export default function AlertCenter() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadAlerts();
    // Poll for new alerts every 30 seconds
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const count = alerts.filter((a) => !a.read).length;
    setUnreadCount(count);
  }, [alerts]);

  const loadAlerts = async () => {
    try {
      // #region agent log
      if (typeof window !== "undefined") {
        fetch("http://127.0.0.1:7908/ingest/8ecea870-d1d6-42b5-905e-45e03cf5df70", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "cac839" },
          body: JSON.stringify({
            sessionId: "cac839",
            runId: "pre-fix",
            hypothesisId: "H1",
            location: "frontend/src/components/alerts/AlertCenter.tsx:loadAlerts",
            message: "Loading alerts (endpoint + baseURL check)",
            data: {
              apiUrlEnv: process.env.NEXT_PUBLIC_API_URL ? "[set]" : "[unset]",
              attemptedPath: "/api/alerts",
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion

      const data = (await api.get("/api/alerts")).data;
      
      // Check for new alerts
      const newAlerts = data.filter(
        (alert: Alert) => !alerts.find((a) => a.id === alert.id)
      );
      
      if (newAlerts.length > 0) {
        // Show toast for critical alerts
        newAlerts.forEach((alert: Alert) => {
          if (alert.type === "critical") {
            toast.error(`🚨 ${alert.title}`, {
              duration: 5000,
            });
          }
        });
      }
      
      setAlerts(data);
    } catch (error) {
      // #region agent log
      if (typeof window !== "undefined") {
        const anyErr: any = error;
        fetch("http://127.0.0.1:7908/ingest/8ecea870-d1d6-42b5-905e-45e03cf5df70", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "cac839" },
          body: JSON.stringify({
            sessionId: "cac839",
            runId: "pre-fix",
            hypothesisId: "H1",
            location: "frontend/src/components/alerts/AlertCenter.tsx:loadAlerts:catch",
            message: "Failed to load alerts",
            data: {
              attemptedPath: "/api/alerts",
              status: anyErr?.response?.status,
              statusText: anyErr?.response?.statusText,
              message: anyErr?.message,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion
      console.error("Failed to load alerts:", error);
    }
  };

  const markAsRead = async (alertId: number) => {
    try {
      await api.post(`/api/alerts/${alertId}/read`);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, read: true } : a))
      );
    } catch (error) {
      console.error("Failed to mark alert as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await Promise.all(
        alerts.filter((a) => !a.read).map((a) =>
          api.post(`/api/alerts/${a.id}/read`)
        )
      );
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const deleteAlert = async (alertId: number) => {
    try {
      await api.delete(`/api/alerts/${alertId}`);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error("Failed to delete alert:", error);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-orange-50 border-orange-200";
      case "success":
        return "bg-green-50 border-green-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <>
      {/* Alert Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-[1001] p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Alert Panel */}
      {isOpen && (
        <div className="fixed top-20 right-4 z-[1001] w-96 max-h-[600px] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b bg-gradient-to-r from-primary-600 to-primary-700 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                <h3 className="font-bold text-lg">การแจ้งเตือน</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-white/90 hover:text-white underline"
              >
                ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว
              </button>
            )}
          </div>

          {/* Alert List */}
          <div className="flex-1 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>ไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      getAlertColor(alert.type)
                    } ${!alert.read ? "ring-2 ring-primary-300" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-bold text-sm text-gray-900">
                            {alert.title}
                          </h4>
                          <button
                            onClick={() => deleteAlert(alert.id)}
                            className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            <X className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-700 mb-2">
                          {alert.message}
                        </p>
                        {alert.location && (
                          <div className="text-xs text-gray-600 mb-2">
                            📍 {alert.location}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {new Date(alert.timestamp).toLocaleString("th-TH", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {!alert.read && (
                            <button
                              onClick={() => markAsRead(alert.id)}
                              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                            >
                              ทำเครื่องหมายว่าอ่านแล้ว
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t bg-gray-50 text-center">
            <button
              onClick={loadAlerts}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              🔄 รีเฟรช
            </button>
          </div>
        </div>
      )}
    </>
  );
}
