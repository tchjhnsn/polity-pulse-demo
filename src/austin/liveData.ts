/**
 * Live data layer for the persistent rep page.
 *
 * Given an official (resolved by slug), returns "what's happening that
 * relates to them and their office" from three sources, all honest about
 * their limitations:
 *
 *   1. GDELT name-mentions — GDELT DOC 2.0 articles whose title mentions
 *      the official's name OR whose domain+context matches their office.
 *      Filter is by a quoted-phrase query on the official's name + state/
 *      district context. Common-name false positives are flagged in the UI.
 *      Works for every official at every layer (federal/state/county/city).
 *
 *   2. Congress.gov bills (federal only) — for US Senators and US Reps,
 *      queries the congress.gov API for bills the official sponsored. Our
 *      local Neon `bills` table has 1 test bill, so we go directly to the
 *      upstream primary source. Requires CONGRESS_GOV_API_KEY.
 *
 *   3. Curated activity stubs — for officials where neither GDELT nor
 *      Congress.gov surfaces anything (county commissioners, city council,
 *      most state legislators during recess), we surface a structured
 *      "office activity" stub built from the official's government page
 *      RSS feed when available, or an honest "no live activity surfaced
 *      for this office yet" notice when not. The pulse feed itself remains
 *      the primary activity source for the demo.
 *
 * All three layers degrade gracefully — none of them can crash the rep
 * page; a failure in one leaves the others visible.
 */

import type { Official } from "./fixtures";

export interface RepActivity {
  /** Where this activity item came from — surfaces in the UI as a tier badge. */
  source: "gdelt" | "congress-gov" | "office-feed" | "stub";
  /** ISO-8601 timestamp of the activity. */
  timestamp: string;
  /** Headline / title. */
  title: string;
  /** Source attribution — domain, "congress.gov", the office's website. */
  attribution: string;
  /** URL to the primary source, when available. */
  url: string | null;
  /** Tier tag for the citation-discipline narration (matches the pulse feed). */
  tier: "primary source" | "outer-ring news" | "aggregator";
}

export interface RepLiveData {
  /** The official's persistent slug. */
  slug: string;
  /** GDELT mentions, newest first. May be empty. */
  news: RepActivity[];
  /** Congress.gov bills (federal only). May be empty. */
  bills: RepActivity[];
  /** Curated office-feed or stub activity. May be empty. */
  office: RepActivity[];
  /** When the live data was fetched (ISO-8601). */
  fetchedAt: string;
  /** Notes about source availability (e.g. "congress.gov key not set"). */
  notes: string[];
}

interface LiveDataEnv {
  CONGRESS_GOV_API_KEY?: string;
  PULSE_KV: KVNamespace;
}

const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const CONGRESS_GOV_BASE = "https://api.congress.gov/v3";

/** Build a GDELT query that targets the official's name + jurisdiction. */
function gdeltQuery(o: Official): string {
  // Use the official's last name + a jurisdiction/context phrase. Quote
  // the name to force a phrase match; add the state or district to scope.
  // Common-name officials (e.g. "John Carter") will get false positives —
  // we surface this honestly in the UI as a known limitation.
  const parts: string[] = [];
  const lastName = o.name.split(" ").filter((p) => p.length > 2).pop();
  if (lastName) {
    parts.push(`"${lastName}"`);
  }
  // Contextual scoping — keeps "Cruz" mostly hitting the senator, not the
  // many other people named Cruz. We use the role + a Texas/Austin phrase.
  if (o.layer === "federal") {
    parts.push('(senator OR "u.s. senate" OR "house of representatives" OR congress)');
    parts.push("sourcecountry:US");
  } else if (o.layer === "state") {
    parts.push('("texas legislature" OR "state senate" OR "state house" OR "texas senator" OR "texas representative")');
    parts.push("sourcecountry:US");
  } else if (o.layer === "county") {
    parts.push('("travis county" OR "commissioners court" OR austin)');
    parts.push("sourcecountry:US");
  } else if (o.layer === "city") {
    parts.push('("austin city council" OR "austin mayor" OR "austin council")');
    parts.push("sourcecountry:US");
  }
  return parts.join(" ");
}

/** Fetch GDELT news mentions for an official. Cached 5 min in PULSE_KV.
 *  `refresh` bypasses the cache read (the news-section refresh button). */
async function fetchGdeltMentions(
  env: LiveDataEnv,
  o: Official,
  refresh = false,
): Promise<{ items: RepActivity[]; note?: string }> {
  const query = gdeltQuery(o);
  const cacheKey = `rep:gdelt:${o.slug ?? o.name}`;
  if (!refresh) {
    try {
      const cached = await env.PULSE_KV.get(cacheKey, "json");
      if (cached) return cached as { items: RepActivity[]; note?: string };
    } catch {
      // ignore cache read failures
    }
  }

  const url =
    `${GDELT_URL}?query=${encodeURIComponent(query)}` +
    `&mode=artlist&format=json&timespan=7days&sort=datedesc&maxrecords=10`;

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "polity-pulse-demo/0.1 (hackathon)" },
    });
    const body = await r.text();
    const trimmed = body.trimStart();
    if (!r.ok || !trimmed.startsWith("{")) {
      const note = !r.ok
        ? `GDELT HTTP ${r.status}`
        : "GDELT throttled (non-JSON)";
      const result = { items: [] as RepActivity[], note };
      void env.PULSE_KV.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 60,
      });
      return result;
    }
    const parsed = JSON.parse(trimmed) as { articles?: Array<{ url?: string; title?: string; seendate?: string; domain?: string }> };
    const items: RepActivity[] = (parsed.articles ?? []).map((a) => ({
      source: "gdelt" as const,
      timestamp: parseSeendate(a.seendate),
      title: a.title?.trim() || "(untitled)",
      attribution: a.domain ?? "unknown",
      url: a.url ?? null,
      tier: "outer-ring news" as const,
    }));
    const result = { items };
    void env.PULSE_KV.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 300, // 5 min
    });
    return result;
  } catch (e) {
    return { items: [], note: `GDELT error: ${(e as Error).name}` };
  }
}

/** Fetch Congress.gov bills sponsored by a federal official (by bioguide_id). */
async function fetchCongressGovBills(
  env: LiveDataEnv,
  o: Official,
): Promise<{ items: RepActivity[]; note?: string }> {
  if (!o.bioguideId || !env.CONGRESS_GOV_API_KEY) {
    return { items: [], note: !o.bioguideId ? undefined : "congress.gov key not set" };
  }
  // Congress.gov sponsor bills endpoint.
  // Format: /bills?sponsor={bioguide}&api_key={key}&limit=10&sort=updateDate+desc
  const url =
    `${CONGRESS_GOV_BASE}/bill?api_key=${encodeURIComponent(env.CONGRESS_GOV_API_KEY)}` +
    `&sponsor=${encodeURIComponent(o.bioguideId)}` +
    `&limit=10&sort=updateDate+desc&format=json`;
  try {
    const r = await fetch(url);
    if (!r.ok) return { items: [], note: `congress.gov HTTP ${r.status}` };
    const data = (await r.json()) as {
      bills?: Array<{ number?: string; title?: string; updateDate?: string; latestAction?: { actionDate?: string; text?: string }; url?: string }>;
    };
    const items: RepActivity[] = (data.bills ?? []).map((b) => ({
      source: "congress-gov" as const,
      timestamp: (b.latestAction?.actionDate ?? b.updateDate ?? new Date().toISOString()) + "T00:00:00Z",
      title: `${b.number ?? "?"}: ${b.title ?? ""}`.trim(),
      attribution: "congress.gov",
      url: b.url ?? null,
      tier: "primary source" as const,
    }));
    return { items };
  } catch (e) {
    return { items: [], note: `congress.gov error: ${(e as Error).name}` };
  }
}

/** Curated office activity stubs. Honest: most local officials don't have
 * public RSS feeds, and we're not going to fake activity. We return a
 * single stub item pointing at the office's government page when no live
 * source surfaced anything. */
function officeStubs(o: Official): RepActivity[] {
  if (!o.sourceUrl) return [];
  return [{
    source: "stub",
    timestamp: new Date().toISOString(),
    title: `Browse ${o.role} activity on the official government page.`,
    attribution: o.layer === "city" ? "austintexas.gov" : o.layer === "county" ? "traviscountytx.gov" : o.layer === "state" ? "capitol.texas.gov" : "congress.gov",
    url: o.sourceUrl,
    tier: "primary source",
  }];
}

/** Get the full live-data bundle for an official. `refresh` bypasses the
 *  GDELT news cache (the news-section refresh button). */
export async function getRepLiveData(
  env: LiveDataEnv,
  o: Official,
  refresh = false,
): Promise<RepLiveData> {
  const notes: string[] = [];
  const [gdelt, bills] = await Promise.all([
    fetchGdeltMentions(env, o, refresh),
    o.layer === "federal"
      ? fetchCongressGovBills(env, o)
      : Promise.resolve({ items: [] as RepActivity[], note: undefined as string | undefined }),
  ]);
  if (gdelt.note) notes.push(gdelt.note);
  if (bills.note) notes.push(bills.note);

  // Office stubs fill in when nothing else surfaced.
  const office = gdelt.items.length === 0 && bills.items.length === 0
    ? officeStubs(o)
    : [];

  return {
    slug: o.slug ?? o.name.toLowerCase().replace(/\s+/g, "-"),
    news: gdelt.items,
    bills: bills.items,
    office,
    fetchedAt: new Date().toISOString(),
    notes,
  };
}

/** Parse GDELT's "YYYYMMDDTHHMMSSZ" seendate format → ISO-8601. */
function parseSeendate(s?: string): string {
  if (!s || s.length < 15) return new Date().toISOString();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, sec] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${sec}Z`;
}