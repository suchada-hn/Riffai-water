"use client";

import { useEffect, useState } from "react";

export default function WelcomeBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Show only once per browser (persisted in localStorage).
    try {
      const welcomed = window.localStorage.getItem("riffai_welcomed");
      if (!welcomed) setOpen(true);
    } catch {
      // If storage is unavailable, just show the banner once per session.
      setOpen(true);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem("riffai_welcomed", "true");
    } catch {
      // Ignore localStorage errors.
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[10000] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-primary-200 rounded-mono shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-primary-900 tracking-tight">
              RIFFAI Water Platform
            </h2>
            <p className="mt-2 text-sm text-primary-600 font-mono">
              Flood-risk and satellite intelligence for Thailand, powered by SAR
              analytics and ML predictions.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss welcome banner"
            className="p-2 rounded-mono hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button type="button" onClick={dismiss} className="btn-mono">
            Got it
          </button>
          <p className="text-xs text-gray-600">
            Tip: Use the layer toggles to explore flood risk and watershed context.
          </p>
        </div>
      </div>
    </div>
  );
}

