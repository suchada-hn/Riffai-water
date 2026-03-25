"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TileLayer } from "react-leaflet";
import TimelapseControl from "./TimelapseControl";
import { mapAPI } from "@/services/api";

type Props = {
  visible: boolean;
  basinId: string;
  opacity: number;
  year: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toParts(d: Date) {
  return { yyyy: d.getFullYear(), mm: pad2(d.getMonth() + 1), dd: pad2(d.getDate()) };
}

function asIsoDate(d: Date) {
  const { yyyy, mm, dd } = toParts(d);
  return `${yyyy}-${mm}-${dd}`;
}

export default function TimelapseZScoreLayer({ visible, basinId, opacity, year }: Props) {
  const [dates, setDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!visible || !basinId) return;
    (async () => {
      try {
        setLoadingDates(true);
        const res = await mapAPI.zscoreDates(basinId, year);
        const list = (res.data?.dates as string[]) || [];
        setDates(list);
        if (list.length > 0) {
          setCurrentDate(new Date(`${list[list.length - 1]}T00:00:00`));
        }
      } catch (e) {
        console.error("Failed to load Z-score dates:", e);
        setDates([]);
      } finally {
        setLoadingDates(false);
      }
    })();
  }, [visible, basinId, year]);

  const availableDateSet = useMemo(() => new Set(dates), [dates]);
  const startDate = useMemo(() => (dates.length ? new Date(`${dates[0]}T00:00:00`) : new Date()), [dates]);
  const endDate = useMemo(
    () => (dates.length ? new Date(`${dates[dates.length - 1]}T00:00:00`) : new Date()),
    [dates]
  );

  const snapToAvailable = (d: Date) => {
    if (!dates.length) return d;
    const iso = asIsoDate(d);
    if (availableDateSet.has(iso)) return new Date(`${iso}T00:00:00`);
    // nearest by absolute day distance
    let best = dates[0];
    let bestDist = Infinity;
    const target = new Date(`${iso}T00:00:00`).getTime();
    for (const s of dates) {
      const t = new Date(`${s}T00:00:00`).getTime();
      const dist = Math.abs(t - target);
      if (dist < bestDist) {
        best = s;
        bestDist = dist;
      }
    }
    return new Date(`${best}T00:00:00`);
  };

  useEffect(() => {
    if (!visible) return;
    if (!isPlaying || dates.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const interval = 1000 / speed;
    intervalRef.current = setInterval(() => {
      setCurrentDate((prev) => {
        const isoPrev = asIsoDate(prev);
        const idx = dates.indexOf(isoPrev);
        const nextIdx = idx >= 0 ? idx + 1 : 0;
        if (nextIdx >= dates.length) {
          setIsPlaying(false);
          return new Date(`${dates[dates.length - 1]}T00:00:00`);
        }
        return new Date(`${dates[nextIdx]}T00:00:00`);
      });
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, isPlaying, speed, dates]);

  if (!visible || !basinId) return null;
  if (loadingDates || dates.length === 0) return null;

  const snapped = snapToAvailable(currentDate);
  const { yyyy, mm, dd } = toParts(snapped);

  const tileUrl = `${API_URL}/api/map/zscore/vv/tiles/${basinId}/${yyyy}/${mm}/${dd}/{z}/{x}/{y}.png`;

  return (
    <>
      <TileLayer url={tileUrl} opacity={opacity} zIndex={450} />
      <TimelapseControl
        currentDate={snapped}
        startDate={startDate}
        endDate={endDate}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying((p) => !p)}
        onDateChange={(d) => setCurrentDate(snapToAvailable(d))}
        speed={speed}
        onSpeedChange={setSpeed}
      />
    </>
  );
}

