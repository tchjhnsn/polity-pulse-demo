/**
 * Standalone bill backfill — HACKATHON-ONLY.
 *
 * Fetches bills from congress.gov sorted by introducedDate DESC (newest
 * first), so we get bills across the full date range of the 119th Congress
 * rather than the first 500 bills all introduced on Jan 3, 2025 (which is
 * what the default updateDate-ordered list gives us).
 *
 * Inserts directly into the Neon `bills` table via @neondatabase/serverless
 * (raw SQL), bypassing the canonical @polity/civic-data upsert pipeline.
 * Reason: the canonical pipeline's `upsertBill` requires a resolved
 * sponsor officeholder, and our officeholder terms cap at the 118th
 * Congress (the handoff doc's "Bug 2"), so 88% of 119th-Congress bills get
 * skipped. Direct insert with `sponsor_officeholder_id = NULL` lets the
 * bills surface in the /api/bills index; the rep↔bill cross-link just
 * won't resolve for unresolved sponsors, which the UI handles honestly.
 *
 * Run:
 *   pnpm --filter @polity/pulse-demo exec tsx scripts/backfill-bills.ts
 *
 * Env (read from apps/pulse-demo/.dev.vars or process.env):
 *   DATABASE_URL          — Neon Postgres
 *   CONGRESS_GOV_API_KEY   — api.congress.gov key
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_VARS = path.resolve(__dirname, "../.dev.vars");

function parseDevVars(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

interface CgBillListItem {
  congress: number;
  type: string;
  number: string;
  originChamber: string;
  title?: string;
  introducedDate?: string;
  latestAction?: { actionDate: string; text?: string };
  updateDate?: string;
  url?: string;
}

interface CgBillDetail {
  congress: number;
  type: string;
  number: string;
  originChamber: string;
  title?: string;
  introducedDate?: string;
  updateDate?: string;
  legislationUrl?: string;
  sponsors?: Array<{
    bioguideId?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    party?: string;
    state?: string;
    district?: number;
  }>;
  latestAction?: { actionDate?: string; text?: string };
  textVersions?: { count?: number; url?: string };
}

const CONGRESS_GOV_API_ROOT = "https://api.congress.gov/v3";

function buildUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) search.set(k, String(v));
  }
  search.set("format", "json");
  return `${CONGRESS_GOV_API_ROOT}${path}?${search.toString()}`;
}

async function fetchJson(url: string, apiKey: string): Promise<any> {
  const full = url + (url.includes("?") ? "&" : "?") + `api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(full, {
    headers: { "User-Agent": "polity-pulse-demo-backfill/0.1 (hackathon)" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function normalizeBillType(t: string): string {
  return t.toLowerCase();
}

function billSlug(congress: number, type: string, number: string): string {
  return `${congress}-${normalizeBillType(type)}-${number}`;
}

function billDesignator(type: string, number: string): string {
  // "H.R." / "S." / "H.RES." etc. — congress.gov uses uppercase w/ periods.
  const upper = type.toUpperCase();
  const map: Record<string, string> = {
    "HR": "H.R.",
    "S": "S.",
    "HJRES": "H.J.RES.",
    "SJRES": "S.J.RES.",
    "HCONRES": "H.CON.RES.",
    "SCONRES": "S.CON.RES.",
    "HRES": "H.RES.",
    "SRES": "S.RES.",
  };
  return map[upper] ?? `${upper}.`;
}

function chamberFromOrigin(origin: string): "house" | "senate" {
  return origin.toLowerCase().startsWith("h") ? "house" : "senate";
}

function billStatus(latestAction?: { text?: string }): string {
  // Best-effort status inference from latest action text. The canonical
  // pipeline has a richer mapper; for the backfill we just need a
  // reasonable bucket so the /api/bills status filter has variety.
  const t = (latestAction?.text ?? "").toLowerCase();
  if (t.includes("signed")) return "enacted";
  if (t.includes("passed") && t.includes("senate")) return "passed_second_chamber";
  if (t.includes("passed")) return "passed_chamber_of_origin";
  if (t.includes("reported") && t.includes("committee")) return "reported_by_committee";
  if (t.includes("referred") && t.includes("committee")) return "referred_to_committee";
  return "introduced";
}

async function main() {
  const fileVars = parseDevVars(DEV_VARS);
  const DATABASE_URL = process.env.DATABASE_URL ?? fileVars.DATABASE_URL;
  const CONGRESS_GOV_API_KEY = process.env.CONGRESS_GOV_API_KEY ?? fileVars.CONGRESS_GOV_API_KEY;
  const MAX_BILLS = Number(process.env.MAX_BILLS ?? "500");

  if (!DATABASE_URL || !CONGRESS_GOV_API_KEY) {
    console.error("Missing DATABASE_URL or CONGRESS_GOV_API_KEY");
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);
  const billTypeMap: Record<string, string> = {
    "HR": "hr", "S": "s", "HJRES": "hjres", "SJRES": "sjres",
    "HCONRES": "hconres", "SCONRES": "sconres", "HRES": "hres", "SRES": "sres",
  };

  console.log(`[backfill-bills] fetching up to ${MAX_BILLS} newest bills from 119th Congress…`);

  // List bills, sorted by introducedDate DESC (newest first).
  const listUrl = buildUrl("/bill/119", {
    limit: 250,
    sort: "introducedDate desc",
  });

  let fetched = 0;
  let inserted = 0;
  let skipped = 0;
  let nextUrl: string | undefined = listUrl;
  const items: CgBillListItem[] = [];

  // Paginate the list
  while (nextUrl && items.length < MAX_BILLS) {
    const data = await fetchJson(nextUrl, CONGRESS_GOV_API_KEY);
    const pageBills = (data.bills ?? []) as CgBillListItem[];
    items.push(...pageBills);
    fetched = items.length;
    const pagination = data.pagination;
    if (pagination?.next) {
      nextUrl = pagination.next;
    } else {
      nextUrl = undefined;
    }
    if (fetched >= MAX_BILLS) break;
    console.log(`[backfill-bills] list page: ${pageBills.length} items (total fetched: ${fetched})`);
  }

  const toProcess = items.slice(0, MAX_BILLS);
  console.log(`[backfill-bills] fetched ${toProcess.length} list items; fetching details + inserting…`);

  for (const item of toProcess) {
    try {
      const billType = billTypeMap[item.type] ?? normalizeBillType(item.type);
      const detailUrl = buildUrl(`/bill/119/${item.type}/${item.number}`);
      const detail = (await fetchJson(detailUrl, CONGRESS_GOV_API_KEY)) as { bill?: CgBillDetail };
      const b = detail.bill;
      if (!b) {
        skipped += 1;
        continue;
      }

      const slug = billSlug(119, item.type, item.number);
      const designator = billDesignator(item.type, item.number);
      const title = b.title ?? `${designator}`;
      const status = billStatus(b.latestAction);
      const chamber = chamberFromOrigin(b.originChamber ?? item.originChamber);
      const introducedDate = b.introducedDate ?? item.introducedDate ?? null;
      const fullTextUrl = b.legislationUrl ?? `https://www.congress.gov/bill/119th-congress/${chamber === "house" ? "house" : "senate"}-bill/${item.number}`;
      const sourceUrl = b.legislationUrl ?? fullTextUrl;
      const updatedAt = b.updateDate ?? new Date().toISOString();

      // Direct insert with sponsor_officeholder_id = NULL (unresolved).
      // On conflict (slug), update the mutable fields.
      await sql`
        INSERT INTO bills (
          slug, congress_number, bill_type, bill_number, chamber,
          title, short_title, status, status_at,
          introduced_date, full_text_url, source_url,
          sponsor_officeholder_id, summary, summary_source,
          last_ingested_at, created_at, updated_at
        ) VALUES (
          ${slug}, ${119}, ${billType}, ${Number(item.number)}, ${chamber},
          ${title}, NULL, ${status}, ${introducedDate ?? new Date().toISOString()},
          ${introducedDate ?? null}, ${fullTextUrl}, ${sourceUrl},
          NULL, NULL, NULL,
          NOW(), NOW(), NOW()
        )
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          status_at = EXCLUDED.status_at,
          full_text_url = EXCLUDED.full_text_url,
          source_url = EXCLUDED.source_url,
          last_ingested_at = NOW(),
          updated_at = NOW()
        RETURNING slug
      `;
      inserted += 1;
      if (inserted % 50 === 0) {
        console.log(`[backfill-bills] inserted ${inserted}/${toProcess.length}…`);
      }
    } catch (e) {
      skipped += 1;
      console.error(`[backfill-bills] skip ${item.type}${item.number}: ${(e as Error).message.slice(0, 120)}`);
    }
  }

  console.log(`[backfill-bills] done. inserted=${inserted}, skipped=${skipped}, total fetched=${fetched}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });