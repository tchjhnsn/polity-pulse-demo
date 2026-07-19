import { useState } from "react";
import type { OrientationResult } from "./orientTypes";

interface UseOrientState {
  data: OrientationResult | null;
  loading: boolean;
  error: string | null;
  orient: (address: string) => Promise<void>;
}

export function useOrient(): UseOrientState {
  const [data, setData] = useState<OrientationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function orient(address: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orient", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as OrientationResult;
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return { data, loading, error, orient };
}