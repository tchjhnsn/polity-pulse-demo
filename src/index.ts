/**
 * Polity Pulse — demo Worker (HACKATHON-ONLY).
 *
 * Red Hat Live Data track, AITX x NVIDIA Claw Agent Hackathon.
 * NOT part of the shipped Polity product; never linked from apps/web.
 * See docs/operations/handoff-red-hat-live-data-hackathon-2026-07-18.md.
 *
 * What it is: a Claw-Agent heartbeat that watches live feeds and surfaces
 * what's new since its last tick. Two feeds:
 *   1. GDELT DOC 2.0 (live US-governance news, refreshes every 15 min
 *      upstream; guaranteed to tick even when Congress is out of session —
 *      the reason it's the demo's liveness anchor).
 *   2. Civic (Layer 1 bills/votes from Neon Postgres) — activates only when
 *      DATABASE_URL is present; otherwise reports "offline (no DB)".
 *
 * The "agent" property (per the hackathon's own Claw-Agent definition):
 * proactively autonomous (cron heartbeat, not prompt-driven), persistent
 * with context (module-scope cursor of already-seen items across ticks so
 * it only flags what's genuinely new).
 *
 * Design constraint learned the hard way: GDELT rate-limits to one request
 * per 5s and, when throttled, returns a PLAINTEXT body (not JSON). So all
 * viewers share ONE server-side upstream call (cached here), guarded by a
 * min-interval, and a throttle/parse failure degrades to last-good cache
 * rather than crashing.
 */

import { neon } from "@neondatabase/serverless";
import {
  orientAddress,
  allOfficialsOriented,
  resolveMemberByBioguide,
} from "./austin/resolve";
import { findFixtureBySlug, slugForOfficial } from "./austin/fixtures";
import { categoriesForRole, CATEGORIES } from "./austin/categories";
import { getRepLiveData } from "./austin/liveData";
import { listBills, getBill, billsBySponsorBioguide } from "./austin/bills";
import { answerBillQuestion } from "./austin/ask";
import {
  buildBillRefs,
  buildRepRefs,
  attributeTitle,
  designatorForSlug,
  type Attribution,
} from "./austin/attribution";

interface Env {
  /** Optional. When set, activates the civic feed (Layer 1 bills/votes). */
  DATABASE_URL?: string;
  /**
   * Optional Tier-1 AI narration (demo-only, banner-labeled). All three
   * must be set to activate; absent any of them, narration is skipped and
   * the feed is unaffected. OpenAI-compatible /chat/completions endpoint —
   * works with NVIDIA hosted Nemotron (https://integrate.api.nvidia.com/v1),
   * self-hosted vLLM, or Featherless.
   */
  NEMOTRON_BASE_URL?: string;
  NEMOTRON_API_KEY?: string;
  NEMOTRON_MODEL?: string;
  /** Optional. Geocodio API key — activates the /api/orient endpoint
   * (address → federal/state/county/city officials). When unset, /api/orient
   * returns a "geocoder not configured" response. */
  GEOCODIO_API_KEY?: string;
  /** Optional. Congress.gov API key — activates bill lookups on the
   * persistent rep page for federal officials. When unset, the rep page
   * shows the GDELT + office-feed layers but not congress.gov bills. */
  CONGRESS_GOV_API_KEY?: string;
  /** Static Assets binding — serves the Vite-built SPA in web/dist/. */
  ASSETS: Fetcher;
  /**
   * Persistent agent memory (per handoff §3.2). Stores the heartbeat cursor
   * (seen ids) and the narration cache across isolates/restarts. Local
   * `wrangler dev` emulates KV via miniflare; `wrangler deploy` creates the
   * namespace from wrangler.toml.
   */
  PULSE_KV: KVNamespace;
}

/** A normalized item from any feed, as the dashboard renders it. */
interface PulseItem {
  feed: "gdelt" | "civic";
  id: string;
  title: string;
  url: string | null;
  source: string;
  /** ISO-8601. */
  timestamp: string;
  /** True on the tick this item was first seen by the agent. */
  isNew: boolean;
  /** Optional AI-generated one-line "why it matters" (Tier 1; demo-only). */
  narration?: string;
  /** Phase III — where the agent filed this item (bill/rep), or absent = wire. */
  attribution?: Attribution;
}

interface FeedStatus {
  feed: "gdelt" | "civic";
  ok: boolean;
  note: string;
  count: number;
}

interface PulseResponse {
  banner: string;
  heartbeat: {
    tick: number;
    at: string;
    lastUpstreamFetchAt: string | null;
    newThisTick: number;
  };
  narration: { enabled: boolean; note: string };
  feeds: FeedStatus[];
  items: PulseItem[];
}

// --- GDELT config -----------------------------------------------------------

const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
// US-governance query. Anchored on legislative/institutional terms and
// phrase-matched to keep out generic war/foreign-affairs coverage that a
// broad "senate OR white house" query leaks in. Narrow further with actor
// terms if the demo feed still drifts off-topic.
const GDELT_QUERY =
  '("in congress" OR "u.s. house" OR "u.s. senate" OR "house committee" ' +
  'OR "senate committee" OR "roll call vote" OR "signed into law" ' +
  'OR "introduced legislation" OR "the bill would") sourcecountry:US';
const GDELT_MIN_INTERVAL_MS = 12_000; // > GDELT's 5s floor, with headroom.

/** Shape of one article in GDELT artlist + format=json output. */
interface GdeltArticle {
  url?: string;
  url_mobile?: string;
  title?: string;
  seendate?: string; // "20260718T193000Z"
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

// --- Agent memory -----------------------------------------------------------
//
// Two layers, deliberately:
//
//   1. Per-isolate hot cache (module scope) — `cachedArticles`,
//      `cachedCivicRows`, `lastUpstreamFetchAt`, `civicLastFetchAt`, the
//      ok/note flags. These are RATE-LIMIT GUARDS, not agent state. They
//      must be per-isolate because the whole point is "this isolate won't
//      hit upstream more than once per GDELT_MIN_INTERVAL_MS." Moving them
//      to KV would be both slower and wrong (KV is eventually-consistent
//      across isolates, so the throttle wouldn't hold).
//
//   2. Persistent agent state (Cloudflare KV via PULSE_KV) — the heartbeat
//      cursor (`seenIds`), the narration cache (id → one-liner), and the
//      tick counter. These are the "persistent with context" property from
//      the hackathon's Claw-Agent definition: they survive isolate restart,
//      are shared across isolates, and are what lets the agent say "this is
//      new since my last beat" rather than "this is new since this process
//      started." Per handoff §3.2, this state lives in KV, NOT in the
//      curated @polity/db Postgres schema — demo state stays physically
//      separate from citizen data.
//
// KV is eventually-consistent (writes take up to ~60s to propagate globally,
// usually <1s in a single-region dev/preview). For this demo that's fine:
// the heartbeat cadence is 2-5 min when deployed, 20s on local client-poll,
// and "I think I've seen this before, just not in the last beat" is an
// acceptable false-positive on a newly-spawned isolate.

let tick = 0;
let lastUpstreamFetchAt: number | null = null;
let cachedArticles: GdeltArticle[] = [];
let lastUpstreamOk = false;
let lastUpstreamNote = "not fetched yet";

// Civic feed (Layer 1 bills) cache + guard — same degrade-to-cache pattern
// as GDELT. Reads are cheap but there's no reason to re-query Neon on every
// 20s client poll when the pulse ingest only refreshes every 15 min.
let civicLastFetchAt: number | null = null;
let cachedCivicRows: CivicRow[] = [];
let civicOk = false;
let civicNote = "not fetched yet";
const CIVIC_MIN_INTERVAL_MS = 30_000;

/**
 * KV-backed persistent store for the agent's cross-isolate state.
 * Wraps the PULSE_KV namespace with the Map/Set-like accessors the rest
 * of the code already uses, so the migration from module-scope state is
 * minimal. Loads lazily on first access per isolate; writes are fire-and-
 * forget (the response doesn't block on them).
 *
 * Keys:
 *   `cursor`        → string[] of seen item ids (the heartbeat cursor).
 *   `narration:{id}` → string (the cached one-liner for that item).
 *   `tick`          → number (the heartbeat counter, mostly for display).
 *
 * The cursor is capped at MAX_CURSOR_SIZE to keep KV value size bounded
 * (KV values max at 25 MiB; we stay well under by capping at 1000 ids).
 */
const MAX_CURSOR_SIZE = 1000;

class PulseStore {
  private kv: KVNamespace;
  private cursor: Set<string> | null = null;
  private narrationCache: Map<string, string> = new Map();

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /** Load the seen-id cursor from KV. Lazily called on first has()/add(). */
  private async ensureCursor(): Promise<Set<string>> {
    if (this.cursor) return this.cursor;
    try {
      const raw = await this.kv.get("cursor");
      this.cursor = new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      this.cursor = new Set();
    }
    return this.cursor;
  }

  async has(id: string): Promise<boolean> {
    const c = await this.ensureCursor();
    return c.has(id);
  }

  async add(id: string): Promise<void> {
    const c = await this.ensureCursor();
    c.add(id);
    // Bound the cursor — drop oldest entries when over the cap. Set preserves
    // insertion order, so iterating gives oldest-first.
    if (c.size > MAX_CURSOR_SIZE) {
      const overflow = c.size - MAX_CURSOR_SIZE;
      let dropped = 0;
      for (const id of c) {
        if (dropped >= overflow) break;
        c.delete(id);
        dropped += 1;
      }
    }
    void this.persistCursor();
  }

  private persistCursor(): Promise<void> {
    return this.kv
      .put("cursor", JSON.stringify([...this.cursor!]))
      .then(() => undefined)
      .catch(() => undefined);
  }

  /** Get a cached narration, checking local map first then KV. */
  async getNarration(id: string): Promise<string | null> {
    const local = this.narrationCache.get(id);
    if (local) return local;
    try {
      const v = await this.kv.get(`narration:${id}`);
      if (v) {
        this.narrationCache.set(id, v);
        return v;
      }
    } catch {
      // KV read failure → treat as uncached; the item re-narrates harmlessly.
    }
    return null;
  }

  /** Cache a narration both locally and in KV. */
  async setNarration(id: string, text: string): Promise<void> {
    this.narrationCache.set(id, text);
    void this.kv.put(`narration:${id}`, text).catch(() => undefined);
  }

  /** Get the persisted tick counter (used for display continuity). */
  async getTick(): Promise<number> {
    try {
      const raw = await this.kv.get("tick");
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  async setTick(value: number): Promise<void> {
    void this.kv.put("tick", String(value)).catch(() => undefined);
  }
}

/** GDELT's seendate ("YYYYMMDDTHHMMSSZ") → ISO-8601. */
function parseSeendate(seendate: string | undefined): string {
  if (!seendate || seendate.length < 15) return new Date().toISOString();
  const m = seendate.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
  );
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

/**
 * Refresh the GDELT cache if the min-interval has elapsed. Never throws —
 * a throttle (plaintext body), non-200, or parse failure leaves the prior
 * cache in place and records why. Returns whether an upstream call was made.
 */
async function refreshGdelt(now: number): Promise<boolean> {
  if (
    lastUpstreamFetchAt !== null &&
    now - lastUpstreamFetchAt < GDELT_MIN_INTERVAL_MS
  ) {
    return false; // served from cache; too soon to hit upstream again.
  }
  lastUpstreamFetchAt = now;

  const url =
    `${GDELT_URL}?query=${encodeURIComponent(GDELT_QUERY)}` +
    `&mode=artlist&format=json&timespan=60min&sort=datedesc&maxrecords=30`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "polity-pulse-demo/0.1 (hackathon)" },
    });
    const body = await res.text();
    // Throttle / error bodies come back as plaintext, not JSON.
    const trimmed = body.trimStart();
    if (!res.ok || !trimmed.startsWith("{")) {
      lastUpstreamOk = false;
      lastUpstreamNote = !res.ok
        ? `upstream ${res.status}; serving cache`
        : "upstream throttled (non-JSON); serving cache";
      return true;
    }
    const parsed = JSON.parse(trimmed) as { articles?: GdeltArticle[] };
    cachedArticles = Array.isArray(parsed.articles) ? parsed.articles : [];
    lastUpstreamOk = true;
    lastUpstreamNote = `fetched ${cachedArticles.length} articles`;
    return true;
  } catch (e) {
    lastUpstreamOk = false;
    lastUpstreamNote = `fetch error (${(e as Error).name}); serving cache`;
    return true;
  }
}

/** One recent bill row from Layer 1's `bills` table. */
interface CivicRow {
  slug: string;
  title: string;
  short_title: string | null;
  status: string;
  full_text_url: string | null;
  /** When Layer 1's pulse ingest last saw this row — the freshness signal. */
  last_ingested_at: string;
}

/**
 * Refresh the civic-feed cache from Layer 1's Neon Postgres. Reads the
 * `bills` table read-only, newest by `last_ingested_at` — which is exactly
 * when the Layer 1 pulse cron saw the row, so the civic feed's freshness IS
 * the Layer 1 heartbeat. Never throws: no DATABASE_URL, a query error, or a
 * schema mismatch all degrade to last-good cache with a status note, exactly
 * like the GDELT path.
 *
 * Uses @neondatabase/serverless (HTTP driver) so it runs on the Workers
 * runtime without Hyperdrive or raw TCP.
 */
async function refreshCivic(env: Env, now: number): Promise<void> {
  if (!env.DATABASE_URL) {
    civicOk = false;
    civicNote = "offline (no DB configured) — GDELT feed carries the demo";
    return;
  }
  if (
    civicLastFetchAt !== null &&
    now - civicLastFetchAt < CIVIC_MIN_INTERVAL_MS
  ) {
    return; // served from cache; too soon to re-query.
  }
  civicLastFetchAt = now;

  try {
    const sql = neon(env.DATABASE_URL);
    const rows = (await sql`
      SELECT slug, title, short_title, status, full_text_url,
             last_ingested_at
      FROM bills
      ORDER BY last_ingested_at DESC
      LIMIT 15
    `) as unknown as CivicRow[];
    cachedCivicRows = rows;
    civicOk = true;
    civicNote =
      rows.length > 0
        ? `${rows.length} recent bills from Layer 1`
        : "connected; no bills ingested yet (run the pulse cron)";
  } catch (e) {
    civicOk = false;
    civicNote = `query error (${(e as Error).name}); serving cache`;
  }
}

/** Map cached civic rows to normalized PulseItems. */
function civicItems(): PulseItem[] {
  return cachedCivicRows.map((r) => ({
    feed: "civic",
    id: `civic:${r.slug}`,
    title: r.short_title?.trim() || r.title,
    // Link to the bill on the (future) live app; fall back to the upstream
    // full-text URL. Never links into apps/web nav — this is a demo surface.
    url: r.full_text_url ?? `https://app.polity.fyi/bills/${r.slug}`,
    source: `congress · ${r.status}`,
    timestamp: new Date(r.last_ingested_at).toISOString(),
    isNew: false,
  }));
}

// --- Tier 1: AI narration (demo-only, banner-labeled) -----------------------

let narrationConfigured = false;
let narrationNote = "disabled (no NEMOTRON_* config)";
const NARRATION_MAX_PER_TICK = 4; // cap latency + spend per heartbeat.
// Cloudflare Workers AI's Nemotron-3 is a REASONING model — it spends
// completion tokens on an internal chain-of-thought (returned separately
// as message.reasoning) BEFORE writing the final answer to message.content.
// A tight max_tokens truncates it mid-thought with content still null
// (finish_reason: "length"). Verified live: ~250-300 completion tokens for
// a one-sentence answer once reasoning is included; 600 leaves headroom.
// Timeout bumped to match — a 120B reasoning model is slower than a small
// instruct model's single forward pass.
const NARRATION_MAX_TOKENS = 600;
const NARRATION_TIMEOUT_MS = 20000;

// Citation-discipline narration prompt.
//
// This prompt is the "training" — it teaches the model to narrate in a way
// that mirrors Polity's layered citation discipline (see PRODUCT_SPEC §F
// glossary: "every claim has a citation; the system retrieves and quotes;
// the system does not author"). The model is cast as a margin annotator on
// an already-surfaced primary-source record, NOT as an author of civic
// claims. Concretely it must:
//
//   1. Name the source tier of the item it's annotating (primary source /
//      founding-era / outer-ring news / etc.) — the same tier vocabulary
//      Polity's source-ring panel surfaces.
//   2. Cite the item by its own title/sender when relying on it — never
//      paraphrase the primary text into a Polity voice claim.
//   3. Stay neutral, non-partisan, no opinion — the brand voice rule.
//   4. Flag contested terms when present ("contested: …") rather than
//      resolving them — Polity preserves dialectical pairs, it doesn't
//      adjudicate them.
//   5. Say "not yet determined" rather than guessing when the item doesn't
//      establish the claim — the same field-status vocabulary entity
//      profiles use.
//   6. Never invent sources. If the item doesn't cite a primary source,
//      the narration says so plainly.
//
// Output is still ONE sentence (max 30 words now, up from 25, to make room
// for the source-tier tag) — this is a margin note, not a paragraph. The
// sentence shape the prompt asks for:
//
//   "[tier] · [what the item establishes, citing the item by title/sender]
//    · [optional: contested: X] · [optional: not yet determined: Y]"
//
// This keeps the narration scannable in the feed while making the citation
// discipline visible — a judge reading the dashboard sees the agent naming
// its sources, not asserting facts.
const NARRATION_SYSTEM_PROMPT =
  "You are a margin annotator for Polity, an app that helps American " +
  "citizens stay oriented to their government by reading primary sources. " +
  "Polity's core discipline is citation: every claim cites a primary " +
  "source; the system retrieves and quotes; the system does not author. " +
  "You are NOT authoring civic claims — you are annotating an item the " +
  "pulse agent has already surfaced, in the voice of a careful editor " +
  "writing a one-line margin note.\n\n" +
  "Source tiers (use this exact vocabulary):\n" +
  "  - primary source   — the item IS the authoritative record (a bill text, " +
  "a roll-call vote, a founding document, a court ruling).\n" +
  "  - founding-era     — founding-era commentary (Federalist / Anti-Federalist " +
  "letters, Constitutional Convention notes).\n" +
  "  - outer-ring news   — secondary reporting ABOUT a primary source (a news " +
  "article covering a bill or vote).\n" +
  "  - aggregator        — a feed of primary items without the primary text " +
  "(e.g. a bill-status tracker).\n\n" +
  "Rules:\n" +
  "1. Output exactly ONE sentence, max 30 words. No preamble.\n" +
  "2. Begin with the source tier in square brackets: " +
  "\"[primary source]\", \"[founding-era]\", \"[outer-ring news]\", or " +
  "\"[aggregator]\".\n" +
  "3. After the tier tag, state what the item establishes — citing the item " +
  "by its sender/title when you rely on it (e.g. \"…per H.R. 1234 as " +
  "reported…\", \"…the Senate roll call records…\"). Never paraphrase the " +
  "primary text into a Polity-voice claim.\n" +
  "4. Neutral, non-partisan. No opinion, no spin, no \"should\" or \"ought.\"\n" +
  "5. If the item involves a contested term, end with \" · contested: <term>\" " +
  "rather than resolving the contest. Polity preserves dialectical pairs.\n" +
  "6. If the item does not establish the claim, say \"not yet determined\" " +
  "rather than guessing. Never invent a source.\n" +
  "7. No partisanship, no party-color language, no candidate endorsements.\n\n" +
  "Examples of the shape (do not copy these verbatim):\n" +
  "  [primary source] · H.R. 1234 reported by House Natural Resources; no " +
  "floor vote recorded yet · not yet determined: passage.\n" +
  "  [outer-ring news] · per Reuters, Senate committee advanced the bill on " +
  "a voice vote; the roll call is not yet published.\n" +
  "  [aggregator] · congress.gov status field shows Introduced; no action " +
  "recorded since referral.";

/**
 * Narrate one item via an OpenAI-compatible /chat/completions endpoint.
 * Returns null on any failure/timeout — the caller leaves the item
 * un-narrated and the feed is unaffected.
 */
async function narrateOne(
  env: Env,
  item: PulseItem,
): Promise<string | null> {
  const base = env.NEMOTRON_BASE_URL!.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NARRATION_TIMEOUT_MS);
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
          { role: "system", content: NARRATION_SYSTEM_PROMPT },
          {
            role: "user",
            content: `[${item.feed} · ${item.source}] ${item.title}`,
          },
        ],
        max_tokens: NARRATION_MAX_TOKENS,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string | null; reasoning?: string };
        finish_reason?: string;
      }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fill narration for the newest un-narrated items, in parallel, capped and
 * time-boxed. Mutates `items` in place (sets `.narration`). Never throws.
 */
async function narrate(
  env: Env,
  store: PulseStore,
  items: PulseItem[],
): Promise<void> {
  narrationConfigured = Boolean(
    env.NEMOTRON_BASE_URL && env.NEMOTRON_API_KEY && env.NEMOTRON_MODEL,
  );
  if (!narrationConfigured) {
    narrationNote = "disabled (no NEMOTRON_* config)";
    // Still attach any previously-cached narration.
    for (const it of items) {
      const cached = await store.getNarration(it.id);
      if (cached) it.narration = cached;
    }
    return;
  }

  // Attach cached narration first; collect the still-uncached to narrate.
  const toNarrate: PulseItem[] = [];
  for (const it of items) {
    const cached = await store.getNarration(it.id);
    if (cached) {
      it.narration = cached;
    } else if (toNarrate.length < NARRATION_MAX_PER_TICK) {
      toNarrate.push(it);
    }
  }

  if (toNarrate.length === 0) {
    narrationNote = "up to date (all visible items narrated)";
    return;
  }

  const results = await Promise.all(
    toNarrate.map(async (it) => ({ id: it.id, text: await narrateOne(env, it) })),
  );
  let ok = 0;
  for (const r of results) {
    if (r.text) {
      await store.setNarration(r.id, r.text);
      const target = items.find((x) => x.id === r.id);
      if (target) target.narration = r.text;
      ok += 1;
    }
  }
  narrationNote = `narrated ${ok}/${toNarrate.length} new this tick`;
}

/** Build the full pulse response, advancing the agent's heartbeat by one tick. */
async function buildPulse(env: Env): Promise<PulseResponse> {
  const now = Date.now();
  const store = new PulseStore(env.PULSE_KV);
  await Promise.all([refreshGdelt(now), refreshCivic(env, now)]);
  tick = (await store.getTick()) + 1;
  await store.setTick(tick);

  let newThisTick = 0;
  const gdeltItems: PulseItem[] = [];
  for (const a of cachedArticles) {
    const url = a.url ?? a.url_mobile ?? null;
    const id = `gdelt:${url ?? a.title ?? Math.random().toString(36)}`;
    const isNew = !(await store.has(id));
    if (isNew) {
      await store.add(id);
      newThisTick += 1;
    }
    gdeltItems.push({
      feed: "gdelt",
      id,
      title: a.title?.trim() || "(untitled)",
      url,
      source: a.domain ?? "unknown",
      timestamp: parseSeendate(a.seendate),
      isNew,
    });
  }

  const civic = civicItems();
  for (const item of civic) {
    if (!(await store.has(item.id))) {
      await store.add(item.id);
      item.isNew = true;
      newThisTick += 1;
    }
  }

  const items = [...civic, ...gdeltItems].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );

  // Phase III — the agent files each item against the civic structure it's
  // about. Civic items (bills) self-file to their own bill page; GDELT items
  // are matched by headline to a bill (bill-number) or a rep (full name).
  // Unmatched GDELT items stay "wire." Match set: the bills currently in the
  // feed + the full official directory.
  const billRefs = buildBillRefs(cachedCivicRows.map((r) => r.slug));
  const repRefs = buildRepRefs(
    allOfficialsOriented().map((o) => ({ name: o.name, slug: o.slug })),
  );
  for (const it of items) {
    if (it.feed === "civic") {
      const slug = it.id.replace(/^civic:/, "");
      it.attribution = {
        kind: "bill",
        slug,
        label: designatorForSlug(slug),
        by: "bill-number",
      };
    } else {
      const attr = attributeTitle(it.title, billRefs, repRefs);
      if (attr) it.attribution = attr;
    }
  }

  // Tier 1 — narrate newest un-narrated items (no-op when unconfigured).
  await narrate(env, store, items);

  return {
    banner:
      "Experimental preview — not part of the live Polity product. Built for the Red Hat Live Data hackathon track.",
    heartbeat: {
      tick,
      at: new Date(now).toISOString(),
      lastUpstreamFetchAt:
        lastUpstreamFetchAt === null
          ? null
          : new Date(lastUpstreamFetchAt).toISOString(),
      newThisTick,
    },
    narration: { enabled: narrationConfigured, note: narrationNote },
    feeds: [
      {
        feed: "gdelt",
        ok: lastUpstreamOk,
        note: lastUpstreamNote,
        count: gdeltItems.length,
      },
      {
        feed: "civic",
        ok: civicOk,
        note: civicNote,
        count: civic.length,
      },
    ],
    items,
  };
}

// --- HTTP + cron entrypoints ------------------------------------------------

export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    // Real server-side heartbeat when deployed. Local `wrangler dev` drives
    // ticks from client polls instead (the fetch handler also advances tick).
    await buildPulse(env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/pulse") {
      const pulse = await buildPulse(env);
      return new Response(JSON.stringify(pulse), {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    }

    // Persistent rep page API: /api/rep/<slug>
    // Returns the official's full record (name, role, categories, photo,
    // office description) + live data (GDELT mentions, congress.gov bills,
    // office-feed stubs). The SPA's #/rep/<slug> route consumes this.
    const repMatch = pathname.match(/^\/api\/rep\/([a-z0-9-]+)$/i);
    if (repMatch && request.method === "GET") {
      const slug = repMatch[1]!.toLowerCase();
      // Fixture first; then the DB-backed federal-member fallback so bill
      // sponsors outside the Austin set (member-<bioguide> slugs) still
      // resolve to a real rep page (C1 cross-link).
      let fixture = findFixtureBySlug(slug);
      if (!fixture && slug.startsWith("member-")) {
        fixture = await resolveMemberByBioguide(env, slug.slice("member-".length));
      }
      if (!fixture) {
        return new Response(
          JSON.stringify({ error: "no official found for that slug", slug }),
          { status: 404, headers: { "content-type": "application/json" } },
        );
      }
      const refreshRep =
        new URL(request.url).searchParams.get("refresh") === "1";
      const categories = categoriesForRole(fixture.role);
      // Sponsored bills from Layer 1 (the C1 return leg) — federal members
      // only; links back to /bill/:slug. Runs in parallel with live data.
      const [live, sponsoredBills] = await Promise.all([
        getRepLiveData(env, fixture, refreshRep),
        fixture.bioguideId
          ? billsBySponsorBioguide(env, fixture.bioguideId)
          : Promise.resolve([]),
      ]);
      return new Response(
        JSON.stringify({
          slug,
          layer: fixture.layer,
          role: fixture.role,
          name: fixture.name,
          party: fixture.party,
          district: fixture.district,
          bioguideId: fixture.bioguideId,
          sourceUrl: fixture.sourceUrl,
          addressScoped: fixture.addressScoped ?? false,
          verified: fixture.verified ?? true,
          officeDescription: fixture.officeDescription,
          categories: categories.map((c) => ({
            id: c,
            label: CATEGORIES[c].label,
            color: CATEGORIES[c].color,
            wash: CATEGORIES[c].wash,
            scope: CATEGORIES[c].scope,
          })),
          sponsoredBills,
          live,
        }),
        {
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        },
      );
    }

    // Reps directory — the full fixture set, no address required. Powers
    // the /reps browse surface (IA restructure §3.2). Address-scoped
    // "yours" resolution still happens via /api/orient; this is the
    // address-optional browse.
    if (pathname === "/api/reps" && request.method === "GET") {
      return new Response(
        JSON.stringify({ officials: allOfficialsOriented() }),
        {
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        },
      );
    }

    // Bills index — real Layer-1 bills with resolved sponsors.
    if (pathname === "/api/bills" && request.method === "GET") {
      const bills = await listBills(env);
      return new Response(JSON.stringify({ bills }), {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    }

    // Bill detail — one bill + narration + per-bill news.
    const billMatch = pathname.match(/^\/api\/bill\/([a-z0-9-]+)$/i);
    if (billMatch && request.method === "GET") {
      const slug = billMatch[1]!.toLowerCase();
      const refresh = new URL(request.url).searchParams.get("refresh") === "1";
      const bill = await getBill(env, slug, refresh);
      if (!bill) {
        return new Response(
          JSON.stringify({ error: "no bill found for that slug", slug }),
          { status: 404, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(bill), {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    }

    // Grounded chat agent — "Ask about this bill." Per
    // docs/operations/pulse-demo-ui-ux-plan-2026-07-19.md §9, adapted to
    // ground on one bill's full page context. Never touches curated data;
    // demo-only, banner-labeled AI.
    if (pathname === "/api/ask" && request.method === "POST") {
      let body: { question?: string; billSlug?: string };
      try {
        body = (await request.json()) as { question?: string; billSlug?: string };
      } catch {
        return new Response(JSON.stringify({ error: "invalid JSON body" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      if (!body.billSlug) {
        return new Response(JSON.stringify({ error: "billSlug is required" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const clientIp =
        request.headers.get("CF-Connecting-IP") ??
        request.headers.get("x-forwarded-for") ??
        "unknown";
      const result = await answerBillQuestion(
        env,
        { question: body.question ?? "", billSlug: body.billSlug },
        clientIp,
      );
      return new Response(JSON.stringify(result), {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    }

    if (pathname === "/api/orient" && request.method === "POST") {
      let body: { address?: string };
      try {
        body = (await request.json()) as { address?: string };
      } catch {
        return new Response(JSON.stringify({ error: "invalid JSON body" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const address = (body.address ?? "").trim();
      if (!address || address.length < 4) {
        return new Response(
          JSON.stringify({
            inputAddress: address,
            formattedAddress: null,
            county: null,
            state: null,
            withinCoverage: false,
            officials: [],
            confidence: "empty",
            coverageNote:
              "Enter a full street address including city and ZIP code.",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          },
        );
      }
      const result = await orientAddress(env, address);
      return new Response(JSON.stringify(result), {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    }

    // Everything else → the Vite-built SPA in web/dist/ via the ASSETS
    // binding. not_found_handling = "single-page-application" in
    // wrangler.toml means unknown paths fall back to index.html, which is
    // fine for this single-page dashboard (no client-side routes today,
    // but the SPA fallback is the standard Cloudflare pattern).
    return env.ASSETS.fetch(request);
  },
};
