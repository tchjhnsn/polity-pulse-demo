import { useEffect, useState } from "react";
import type { BillSummary, BillDetail } from "./billTypes";

/** Fetch the bills index (/api/bills). */
export function useBills(): {
  bills: BillSummary[];
  loading: boolean;
  error: string | null;
} {
  const [bills, setBills] = useState<BillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bills");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { bills: BillSummary[] };
        if (!cancelled) setBills(json.bills ?? []);
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

  return { bills, loading, error };
}

/** Fetch one bill's detail (/api/bill/:slug). `refresh()` re-fetches the
 *  news bypassing the server cache (the news-section refresh button). */
export function useBill(slug: string): {
  bill: BillDetail | null;
  loading: boolean;
  error: string | null;
  refreshingNews: boolean;
  refreshNews: () => void;
} {
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingNews, setRefreshingNews] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/bill/${slug}`);
        if (res.status === 404) throw new Error("Bill not found");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as BillDetail;
        if (!cancelled) setBill(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function refreshNews() {
    setRefreshingNews(true);
    try {
      const res = await fetch(`/api/bill/${slug}?refresh=1`);
      if (res.ok) setBill((await res.json()) as BillDetail);
    } catch {
      /* keep prior state */
    } finally {
      setRefreshingNews(false);
    }
  }

  return { bill, loading, error, refreshingNews, refreshNews };
}
