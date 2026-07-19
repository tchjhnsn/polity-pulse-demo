import { useEffect, useState } from "react";
import type { OrientationOfficial } from "./orientTypes";

interface UseRepsState {
  officials: OrientationOfficial[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetch the full Austin/Travis fixture set for the /reps directory
 * (address-optional browse). One-shot on mount; the directory is static
 * for the session. Address-scoped "yours" resolution is layered on top by
 * the caller via useOrient — this hook is just the browse baseline.
 */
export function useReps(): UseRepsState {
  const [officials, setOfficials] = useState<OrientationOfficial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/reps");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { officials: OrientationOfficial[] };
        if (!cancelled) setOfficials(json.officials ?? []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { officials, loading, error };
}
