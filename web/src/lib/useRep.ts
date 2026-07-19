import { useEffect, useState } from "react";
import type { RepPageData } from "./repTypes";

interface UseRepState {
  data: RepPageData | null;
  loading: boolean;
  error: string | null;
  refreshingNews: boolean;
  refreshNews: () => void;
}

export function useRep(slug: string | null): UseRepState {
  const [data, setData] = useState<RepPageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingNews, setRefreshingNews] = useState(false);

  useEffect(() => {
    if (!slug) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/rep/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as RepPageData;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function refreshNews() {
    if (!slug) return;
    setRefreshingNews(true);
    try {
      const r = await fetch(`/api/rep/${encodeURIComponent(slug)}?refresh=1`);
      if (r.ok) setData((await r.json()) as RepPageData);
    } catch {
      /* keep prior state */
    } finally {
      setRefreshingNews(false);
    }
  }

  return { data, loading, error, refreshingNews, refreshNews };
}