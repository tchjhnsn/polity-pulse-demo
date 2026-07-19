import { useEffect, useRef, useState, useCallback } from "react";
import type { PulseResponse } from "./types";

interface UsePulseState {
  data: PulseResponse | null;
  error: string | null;
  loading: boolean;
  paused: boolean;
  pause: () => void;
  resume: () => void;
  refresh: () => void;
}

const POLL_INTERVAL_MS = 20_000;

/**
 * Polls /api/pulse every 20s (matching the prior inline-HTML cadence).
 * `paused` stops the interval but keeps the last-good data visible.
 * `refresh()` triggers an immediate beat without resetting the interval.
 */
export function usePulse(): UsePulseState {
  const [data, setData] = useState<PulseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const beat = useCallback(async () => {
    try {
      const res = await fetch("/api/pulse", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PulseResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    beat();
    intervalRef.current = setInterval(beat, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [beat, paused]);

  const refresh = useCallback(() => {
    void beat();
  }, [beat]);

  return {
    data,
    error,
    loading,
    paused,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    refresh,
  };
}