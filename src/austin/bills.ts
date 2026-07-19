/**
 * Bills data layer for the /api/bills index and /api/bill/:slug detail.
 *
 * HACKATHON-ONLY. Reads Layer 1's real `bills` table (Neon Postgres),
 * joins the resolved sponsor (officeholder → person → party/position), and
 * — on the detail page — pulls per-bill GDELT news + the cached AI margin
 * note. Every query degrades gracefully; nothing here can crash a page.
 *
 * The sponsor join is the key to the rep↔bill cross-link (C1): each bill's
 * sponsor carries a bioguide, which resolves to a federal rep page via
 * /api/rep/member-<bioguide> (see resolveMemberByBioguide in resolve.ts).
 */

import { neon } from "@neondatabase/serverless";

export interface BillSponsor {
  name: string | null;
  bioguideId: string | null;
  party: string | null;
  /** e.g. "TX-9" — the sponsor's district, when resolved. */
  district: string | null;
  /** Persistent rep-page slug for the cross-link, or null when unresolved. */
  repSlug: string | null;
}

export interface BillSummary {
  slug: string;
  billType: string;
  billNumber: number;
  congress: number;
  /** Formal designator, e.g. "H.R. 196". */
  designator: string;
  title: string;
  shortTitle: string | null;
  status: string;
  chamber: string;
  introducedDate: string | null;
  fullTextUrl: string | null;
  lastIngestedAt: string;
  sponsor: BillSponsor;
}

export interface BillNewsItem {
  title: string;
  url: string | null;
  domain: string;
  timestamp: string;
}

export interface BillDetail extends BillSummary {
  /** CRS or editorial summary of the bill, or null. */
  summary: string | null;
  /** "crs" | "editorial" | "pending" — the summary's provenance. */
  summarySource: string | null;
  /** AI-extracted topics/keywords from the bill (the analyzer). Drives the
   *  live news search — the live-data-makes-AI-better loop. */
  topics: string[];
  /** AI margin note (from the pulse narration cache), or null. */
  narration: string | null;
  /** Per-bill GDELT news matched by designator/title. May be empty. */
  news: BillNewsItem[];
  newsNote: string | null;
  sourceUrl: string | null;
  fetchedAt: string;
}

interface BillsEnv {
  DATABASE_URL?: string;
  PULSE_KV: KVNamespace;
  /** LLM (Cloudflare Workers AI Nemotron) — powers the bill analyzer. */
  NEMOTRON_BASE_URL?: string;
  NEMOTRON_API_KEY?: string;
  NEMOTRON_MODEL?: string;
}

/** Uppercase bill-type → designator prefix. */
const DESIGNATOR: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
  hconres: "H.Con.Res.",
  sconres: "S.Con.Res.",
  hres: "H.Res.",
  sres: "S.Res.",
};

export function billDesignator(billType: string, billNumber: number): string {
  return `${DESIGNATOR[billType] ?? billType.toUpperCase()} ${billNumber}`;
}

/** SQL selecting a bill + its resolved sponsor. Shared by list + detail. */
const SPONSOR_JOIN = `
  LEFT JOIN officeholders o ON o.id = b.sponsor_officeholder_id
  LEFT JOIN persons p ON p.id = o.person_id
  LEFT JOIN parties pa ON pa.id = o.party_id
  LEFT JOIN positions pos ON pos.id = o.position_id
`;

interface RawBillRow {
  slug: string;
  bill_type: string;
  bill_number: number;
  congress_number: number;
  title: string;
  short_title: string | null;
  status: string;
  chamber: string;
  introduced_date: string | null;
  full_text_url: string | null;
  source_url: string;
  last_ingested_at: string;
  sponsor_name: string | null;
  sponsor_bioguide: string | null;
  sponsor_party: string | null;
  sponsor_district: string | null;
}

function toSummary(r: RawBillRow): BillSummary {
  return {
    slug: r.slug,
    billType: r.bill_type,
    billNumber: r.bill_number,
    congress: r.congress_number,
    designator: billDesignator(r.bill_type, r.bill_number),
    title: r.title,
    shortTitle: r.short_title,
    status: r.status,
    chamber: r.chamber,
    introducedDate: r.introduced_date,
    fullTextUrl: r.full_text_url,
    lastIngestedAt: r.last_ingested_at,
    sponsor: {
      name: r.sponsor_name,
      bioguideId: r.sponsor_bioguide,
      party: r.sponsor_party,
      district: r.sponsor_district,
      repSlug: r.sponsor_bioguide ? `member-${r.sponsor_bioguide.toLowerCase()}` : null,
    },
  };
}

/** List recent bills with sponsors. Empty array on any failure. */
export async function listBills(env: BillsEnv): Promise<BillSummary[]> {
  if (!env.DATABASE_URL) return [];
  try {
    const sql = neon(env.DATABASE_URL);
    const rows = (await sql(`
      SELECT b.slug, b.bill_type, b.bill_number, b.congress_number, b.title,
             b.short_title, b.status, b.chamber, b.introduced_date,
             b.full_text_url, b.source_url, b.last_ingested_at,
             p.full_name AS sponsor_name, p.bioguide_id AS sponsor_bioguide,
             pa.name AS sponsor_party, pos.district_id AS sponsor_district
      FROM bills b
      ${SPONSOR_JOIN}
      ORDER BY b.last_ingested_at DESC
      LIMIT 50
    `)) as unknown as RawBillRow[];
    return rows.map(toSummary);
  } catch {
    return [];
  }
}

/**
 * Bills sponsored by a given federal member (by bioguide), from Layer 1.
 * Powers the rep page's "Sponsored legislation" section — the return leg
 * of the C1 cross-link (rep → their bills → /bill/:slug). Empty on failure.
 */
export async function billsBySponsorBioguide(
  env: BillsEnv,
  bioguide: string,
): Promise<BillSummary[]> {
  if (!env.DATABASE_URL) return [];
  try {
    const sql = neon(env.DATABASE_URL);
    const rows = (await sql(
      `
      SELECT b.slug, b.bill_type, b.bill_number, b.congress_number, b.title,
             b.short_title, b.status, b.chamber, b.introduced_date,
             b.full_text_url, b.source_url, b.last_ingested_at,
             p.full_name AS sponsor_name, p.bioguide_id AS sponsor_bioguide,
             pa.name AS sponsor_party, pos.district_id AS sponsor_district
      FROM bills b
      ${SPONSOR_JOIN}
      WHERE p.bioguide_id = $1
      ORDER BY b.introduced_date DESC
      LIMIT 20
    `,
      [bioguide.toUpperCase()],
    )) as unknown as RawBillRow[];
    return rows.map(toSummary);
  } catch {
    return [];
  }
}

/**
 * One bill by slug, with summary, narration + per-bill news. Null when not
 * found. `refresh` bypasses the per-bill news cache (the "refresh" button).
 */
export async function getBill(
  env: BillsEnv,
  slug: string,
  refresh = false,
): Promise<BillDetail | null> {
  if (!env.DATABASE_URL) return null;
  let summary: BillSummary | null = null;
  let sourceUrl: string | null = null;
  let billSummary: string | null = null;
  let summarySource: string | null = null;
  try {
    const sql = neon(env.DATABASE_URL);
    const rows = (await sql(
      `
      SELECT b.slug, b.bill_type, b.bill_number, b.congress_number, b.title,
             b.short_title, b.status, b.chamber, b.introduced_date,
             b.full_text_url, b.source_url, b.last_ingested_at,
             b.summary, b.summary_source,
             p.full_name AS sponsor_name, p.bioguide_id AS sponsor_bioguide,
             pa.name AS sponsor_party, pos.district_id AS sponsor_district
      FROM bills b
      ${SPONSOR_JOIN}
      WHERE b.slug = $1
      LIMIT 1
    `,
      [slug],
    )) as unknown as Array<RawBillRow & { summary: string | null; summary_source: string | null }>;
    if (!rows[0]) return null;
    summary = toSummary(rows[0]);
    sourceUrl = rows[0].source_url;
    billSummary = rows[0].summary;
    summarySource = rows[0].summary_source;
  } catch {
    return null;
  }

  // Narration — the pulse feed caches it under `narration:civic:<slug>`.
  let narration: string | null = null;
  try {
    narration = await env.PULSE_KV.get(`narration:civic:${slug}`);
  } catch {
    /* uncached — fine */
  }

  // The analyzer: AI reads the full bill context (title, summary, sponsor,
  // status) → extracts display topics AND crafts an optimized GDELT query →
  // we run that query for live news. This is the core "live data makes AI
  // useful, AI makes live data findable" loop. Cached (it doesn't change).
  const analysis = await analyzeBill(env, summary, billSummary, refresh);
  const { news, newsNote } = await fetchBillNews(
    env,
    summary,
    refresh,
    analysis.query,
    analysis.topics,
  );

  return {
    ...summary,
    summary: billSummary,
    summarySource,
    topics: analysis.topics,
    narration,
    news,
    newsNote,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
  };
}

interface BillAnalysis {
  /** Short display topics (chips on the bill page). */
  topics: string[];
  /** GDELT-ready boolean query the model crafted from the full bill context. */
  query: string;
}

/**
 * The bill analyzer — call the LLM (Cloudflare Workers AI Nemotron) with the
 * FULL page context (title, summary, sponsor, status) and get back both
 * display topics AND a purpose-built GDELT query. Letting the model craft
 * the query (mixing headline-friendly terms with OR/quoted phrases) gets far
 * better live-news hits than OR-ing long exact phrases. Cached in KV.
 * Degrades to `{ topics: [], query: "" }` when the LLM is unavailable —
 * fetchBillNews then falls back to the bill designator.
 */
async function analyzeBill(
  env: BillsEnv,
  bill: BillSummary,
  summary: string | null,
  refresh = false,
): Promise<BillAnalysis> {
  const cacheKey = `bill:analysis:${bill.slug}`;
  const empty: BillAnalysis = { topics: [], query: "" };
  if (!refresh) {
    try {
      const cached = await env.PULSE_KV.get(cacheKey, "json");
      if (cached) return cached as BillAnalysis;
    } catch {
      /* ignore */
    }
  }
  if (!env.NEMOTRON_BASE_URL || !env.NEMOTRON_API_KEY || !env.NEMOTRON_MODEL) {
    return empty;
  }

  // As much relevant context from the page as we have.
  const context =
    `Title: ${bill.title}\n` +
    `Summary: ${summary ?? "(none)"}\n` +
    `Sponsor: ${bill.sponsor.name ?? "unknown"}` +
    `${bill.sponsor.party ? ` (${bill.sponsor.party})` : ""}` +
    `${bill.sponsor.district ? `, ${bill.sponsor.district}` : ""}\n` +
    `Chamber: ${bill.chamber}\nStatus: ${bill.status.replace(/_/g, " ")}`;

  const base = env.NEMOTRON_BASE_URL.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.NEMOTRON_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.NEMOTRON_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You prepare a live-news search for a U.S. bill. Read the " +
              "context and answer with two lines, nothing else:\n" +
              "TOPICS: 3-5 short terms (2-4 words each) a citizen would see in " +
              "news headlines about this bill's subject — policy areas, " +
              "affected groups, named programs. Lowercase, comma-separated. " +
              "Not the bill number.\n" +
              "QUERY: a short news search combining a few of those terms with " +
              "OR, double-quoting multi-word phrases. Favor words that appear " +
              "in real headlines. Do not count characters; keep it brief.",
          },
          { role: "user", content: context },
        ],
        // Nemotron-3 is a reasoning model — it spends tokens thinking before
        // writing `content`. Give ample room or `content` comes back null
        // (finish_reason: "length"). Do NOT impose character limits in the
        // prompt — it sends the model into obsessive counting.
        max_tokens: 1400,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";

    const topicsLine = text.match(/TOPICS:\s*(.+)/i)?.[1] ?? "";
    const queryLine = text.match(/QUERY:\s*(.+)/i)?.[1] ?? "";

    const topics = topicsLine
      .split(/[,\n]/)
      .map((t) =>
        t.replace(/^[\s\d.\-*"'•]+/, "").replace(/["'.]+$/, "").trim().toLowerCase(),
      )
      .filter((t) => t.length >= 3 && t.length <= 60)
      .slice(0, 5);

    // Sanitize the model's query: single line, bounded length, must have a
    // letter. If it's unusable, we leave it empty and fetchBillNews ORs the
    // topics itself.
    let query = queryLine.trim().replace(/\s+/g, " ");
    if (query.length > 220) query = query.slice(0, 220);
    if (!/[a-z]/i.test(query)) query = "";

    const result: BillAnalysis = { topics, query };
    if (topics.length > 0 || query) {
      void env.PULSE_KV.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 60 * 60 * 24 * 7,
      });
    }
    return result;
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Per-bill GDELT news, matched by the bill designator + a title keyword.
 * Cached 5 min in KV. Degrades to empty + a note on throttle/error — our
 * bills are 119th-opening-days bills, so an empty result is the honest
 * common case, not a failure.
 */
async function fetchBillNews(
  env: BillsEnv,
  bill: BillSummary,
  refresh = false,
  analyzerQuery = "",
  topics: string[] = [],
): Promise<{ news: BillNewsItem[]; newsNote: string | null }> {
  const cacheKey = `bill:news:${bill.slug}`;
  if (!refresh) {
    try {
      const cached = await env.PULSE_KV.get(cacheKey, "json");
      if (cached) return cached as { news: BillNewsItem[]; newsNote: string | null };
    } catch {
      /* ignore */
    }
  }

  // Query priority: (1) the Nemotron-crafted query built from the full bill
  // context — the AI-improves-live-search payoff; (2) OR of the display
  // topics; (3) the bare bill designator. Always US-scoped.
  const withScope = (q: string) =>
    /sourcecountry:/i.test(q) ? q : `${q} sourcecountry:US`;
  const query = analyzerQuery
    ? withScope(analyzerQuery)
    : topics.length > 0
      ? `(${topics.map((t) => `"${t}"`).join(" OR ")}) sourcecountry:US`
      : `"${bill.designator}" sourcecountry:US`;
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}` +
    `&mode=artlist&format=json&timespan=14days&sort=datedesc&maxrecords=8`;

  let result: { news: BillNewsItem[]; newsNote: string | null };
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "polity-pulse-demo/0.1 (hackathon)" },
    });
    const body = await r.text();
    const trimmed = body.trimStart();
    if (!r.ok || !trimmed.startsWith("{")) {
      result = {
        news: [],
        newsNote: !r.ok ? `GDELT HTTP ${r.status}` : "GDELT throttled",
      };
    } else {
      const parsed = JSON.parse(trimmed) as {
        articles?: Array<{ url?: string; title?: string; seendate?: string; domain?: string }>;
      };
      const news: BillNewsItem[] = (parsed.articles ?? []).map((a) => ({
        title: a.title?.trim() || "(untitled)",
        url: a.url ?? null,
        domain: a.domain ?? "unknown",
        timestamp: parseSeendate(a.seendate),
      }));
      result = { news, newsNote: null };
    }
  } catch (e) {
    result = { news: [], newsNote: `GDELT error: ${(e as Error).name}` };
  }

  void env.PULSE_KV.put(cacheKey, JSON.stringify(result), {
    expirationTtl: result.newsNote ? 60 : 300,
  });
  return result;
}

function parseSeendate(s?: string): string {
  if (!s || s.length < 15) return new Date().toISOString();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, sec] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${sec}Z`;
}
