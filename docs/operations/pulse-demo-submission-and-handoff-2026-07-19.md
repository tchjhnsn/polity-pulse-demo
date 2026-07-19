# Pulse Demo — Submission Package + Next-Agent Handoff

**2026-07-19. Updated by glm-5.2 (Loom skip per Torian's instruction).** For the AITX × NVIDIA Claw Agent Hackathon, Red Hat Live Data Track. Due **July 19, 11 AM CST**.

---

## PART 1 — SUBMISSION (what to file in the Airtable form)

**Where:** https://airtable.com/appWQWPtBqDUhCPPj/shrA485ElUlYeorM4
**Track:** Red Hat Live Data Track

### Required fields — status

| Field | Status | Notes |
|---|---|---|
| Project title & Team Name | **YOU** | Suggested title: **Polity Pulse**. Team name = yours. |
| Track selected | ✅ | Red Hat Live Data Track |
| ~~2–5 min Loom video~~ | **SKIPPED per Torian's instruction** | Loom step skipped. If a video is still required by the form, substitute a screen capture (PART 3) or narrate live at the table. |
| Public repo link + README | ⚠️ **BLOCKER — repo is private** | README ✅ at `apps/pulse-demo/README.md` (124 lines, covers architecture + repro). Repo `tchjhnsn/polity-app` is currently **private** (verified via `gh repo view`). Submission requires a public link. **Torian must flip visibility** (one-way, consequential — Claude won't do this without explicit permission). Alternative: fork `apps/pulse-demo/` into a fresh public repo; the demo is self-contained. |
| Deployed URL or screen capture | ✅ **DEPLOYED 2026-07-19 ~03:45 CDT** | Live at **https://polity-pulse-demo.torianjohnson98.workers.dev**. KV namespace `PULSE_KV` (id `9c29f7ded7e24e39817a2d01002d9d91`) created; all 6 secrets uploaded via `wrangler secret put`. SPA + Worker deploy in one step via `pnpm --filter @polity/pulse-demo deploy`. **Caveat:** the Geocodio key in `.dev.vars` is revoked (HTTP 403 "Invalid API key" from every IP); `/api/orient` falls back to the pinned Austin fixtures (46 officials, confidence `low`, honest note in `coverageNote`). All other endpoints work: `/api/pulse` (tick 2, 12 civic bills from Layer 1, narration live), `/api/rep/:slug`, `/api/bills`, `/api/bill/:slug`. |
| Team roster (names, roles, contacts) | **YOU** | Yours to provide. |
| Short write-up (150–300 words) | ✅ below | Paste §Write-up. |

### Pre-submission verification (run before filing)

| Check | Command | Last result (2026-07-19 ~03:45 CDT, post-deploy) |
|---|---|---|
| Worker typechecks | `pnpm --filter @polity/pulse-demo typecheck` | ✅ clean (Worker + SPA) |
| SPA builds | `pnpm --filter @polity/pulse-demo-web build` | ✅ 311 KB JS / 19 KB CSS |
| **Deployed URL live** | https://polity-pulse-demo.torianjohnson98.workers.dev | ✅ HTTP 200 on `/`, `/api/pulse`, `/api/orient`, `/api/rep/:slug`, `/api/bills`, `/api/bill/:slug` |
| `/api/pulse` heartbeat | `curl $URL/api/pulse` | ✅ tick 2, 12 civic bills from Layer 1 (real Neon data), narration `narrated 3/4 new this tick` |
| `/api/orient` Austin address | `POST $URL/api/orient` with `1100 Congress Ave, Austin, TX 78701` | ✅ 46 officials, `withinCoverage: true`, `confidence: low` (Geocodio fallback) |
| `/api/orient` non-Austin | `POST` with a Dallas address | ✅ `withinCoverage: false` with clear note |
| `/api/rep/:slug` | `GET $URL/api/rep/us-senator-texas-state-wide-cruz` | ✅ Ted Cruz, 4 categories, office description, live data sections |
| All 6 hash routes render | `/`, `/reps`, `/rep/:slug`, `/bills`, `/bill/:slug`, `/pulse` | ✅ per App.tsx routes |
| Cron trigger | `*/5 * * * *` (every 5 min) | ✅ deployed; advances tick server-side without a browser open |

### Write-up (paste into the form — 190 words)

> **Problem.** Most Americans can name fewer than five of the ~40 officials who govern them, and can't tell whether a bill in Congress touches their life. Legislative data is public but illegible; news about it is a firehose with no structure.
>
> **Who it helps.** Any citizen trying to stay oriented to their government — and, at enterprise scale, any team that needs live legislation mapped to the topics and people it affects.
>
> **Solution.** Polity Pulse is a civic Claw Agent. On a heartbeat it ingests live bills (congress.gov) and news (GDELT). For each bill it calls NVIDIA Nemotron to **extract the bill's topics**, then searches live news on *those topics* — so the news reflects what the bill is about, not just its number. It files each live item against the bill or representative it concerns, and links everything into a navigable, fully-cited civic graph: your address → your officials → a bill → its sponsor → their other bills.
>
> **Impact.** The AI is only useful because the data is live; the live data is only legible because of the AI. Freshness changes what the agent can do — the exact thing this track rewards.

### Live demo path (if narrating at the table instead of Loom)

1. **Orient** (`/`) — enter an Austin address (e.g. "110 Inner Campus Dr, Austin, TX 78705") → 36 officials across 4 layers; show the category filter ("who touches transportation?").
2. **Reps** (`/reps`) — browse the full Austin/Travis directory without an address; the breadth is the demo's biggest data asset.
3. **Open a rep page** (e.g. Cruz or Doggett) — categories, "about this office," live GDELT name-mentions, congress.gov sponsored bills (federal only).
4. **Bills** (`/bills`) → open a bill (e.g. Fair Lending for All Act) → show the **AI-extracted topics** chips → **"Live coverage on these topics"** section (GDELT searched on the AI topics, not the bill number) → hit **refresh** to show it querying live.
5. **Pulse** (`/pulse`) — "filed this beat" vs "unattributed wire" — the agent filing live news against the civic structure, tick counter persisting in KV.

> If GDELT is 429-throttled during the demo, hit **refresh** once or twice, or narrate the topics (the AI artifact) and note the empty state is honest. Warm the app first (open it ~40s before demoing — cold load runs Nemotron).

---

## PART 2 — NEXT-AGENT HANDOFF (the remaining UX/AI priorities)

Context: the user wants AI + live-data to be *higher priority in the UX* and named two features. The **bill analyzer is DONE** (parallel session, 2026-07-19 — see `src/austin/bills.ts` `extractTopics` + `fetchBillNews`). Remaining, in priority order:

### A. Grounded chat agent ("Ask") — highest remaining value
- **Goal**: a single input where a citizen asks about what the agent has surfaced; the model answers using ONLY the seen-set + the open bill/rep as grounding context. Never general knowledge.
- **Build**: `POST /api/ask` on the Worker (sibling to `/api/pulse`). System prompt: "Answer using ONLY the provided context items; if not present, say 'I don't have that — the pulse feed hasn't surfaced it.' No outside knowledge." Feed it: the open bill (title, summary, topics, status, sponsor) or the seen-set. Reuse the Nemotron endpoint already wired (`NEMOTRON_*` env; it's a reasoning model — `max_tokens: 600`, 20s timeout, read `message.content`). Rate-limit 1/10s per IP in KV.
- **UI**: an "Ask about this bill" input on the bill page (pre-grounded to that bill) + answer block with an `AI` badge and a source link. shadcn `Input` + `Button`. Keep it one-shot (no multi-turn) for the demo.
- **Design doc already exists**: `pulse-demo-ui-ux-plan-2026-07-19.md` §9 has the full contract, guardrails, and the brand-risk analysis — read it first.

### B. Persist pulse finds durably
- **Goal**: the pulse feed should *accrete* across sessions, not reset. Today the KV cursor tracks seen-ids but the feed only shows the current tick's fetch.
- **Build**: on each tick, write filed items to a KV list (`pulse:filed:log`, capped ~200, newest-first) with their attribution + timestamp. `/api/pulse` returns the accreted log, not just this fetch. The bill/rep pages can then show "N items filed here over time."

### C. Live data more visible throughout
- Surface a small "live" indicator (last-fetched relative time + a pulse dot) in the header on every page, reading from `/api/pulse` heartbeat.
- Rep pages: run the same analyzer-style topic search for the official's committee areas.

### D. Officeholder-term backfill (Bug 2) — unblocks data
- Re-run the Bar B officeholder ingest for the 119th Congress (2025–2027 terms). Fixes ~29/40 bill-sponsor resolutions and 100% of roll-call votes (currently gated by `INGEST_VOTES=1`).

### E. HiddenLayer track (separate bounty, if pursuing two tracks)
- Route every Nemotron call (analyzer + narration + chat) through HiddenLayer's Runtime Security API. Event code `AITX-2026`, key at the HiddenLayer link in the Notion. Instrument prompts + responses; log/annotate findings.

### Key files (all in `apps/pulse-demo/`)
- `src/index.ts` — Worker: all routes (`/api/pulse`, `/api/orient`, `/api/rep/:slug`, `/api/bills`, `/api/bill/:slug`) + `buildPulse()` heartbeat.
- `src/austin/bills.ts` — bill queries + **the analyzer** (`extractTopics`) + topic-driven `fetchBillNews`.
- `src/austin/attribution.ts` — news→entity filing (pure, testable).
- `src/austin/resolve.ts` — address orientation + `resolveMemberByBioguide` (C1).
- `src/austin/liveData.ts` — rep live data (GDELT + office stubs).
- `src/austin/fixtures.ts` — TX state / Travis County / Austin officials (3 federal + state-leg + county commissioners + judicial + city council + municipal).
- `src/austin/categories.ts` — 10-category taxonomy + office→category assignments (own colors).
- `web/src/App.tsx` — routes; `web/src/components/pulse/*` — all UI (AppHeader, AddressInput, OrientationView, RepsDirectory, RepPage, RepCard, BillsIndex, BillPage, PulseDot, StatusStrip, FeedList, FeedCard, CategoryBadge, RepActivityList, ExperimentalBanner).
- Full history: `pulse-demo-ia-restructure-2026-07-19.md` (phases I–III + analyzer, all verified), `pulse-demo-page-designs-2026-07-19.md`, `pulse-demo-ui-ux-plan-2026-07-19.md`, `pulse-demo-category-taxonomy-2026-07-19.md`.

---

## PART 3 — Deploy (DONE)

Deployed 2026-07-19 ~03:45 CDT. Live URL: **https://polity-pulse-demo.torianjohnson98.workers.dev**

### What was deployed
- **KV namespace** `PULSE_KV` created via `wrangler kv namespace create PULSE_KV` (id `9c29f7ded7e24e39817a2d01002d9d91`, preview id `14eda0f1cc224daa8c4da66f013aaff1`). Both ids written into `apps/pulse-demo/wrangler.toml`.
- **6 secrets** uploaded via `wrangler secret put` (piped from `.dev.vars`, never displayed): `DATABASE_URL`, `CONGRESS_GOV_API_KEY`, `NEMOTRON_BASE_URL`, `NEMOTRON_API_KEY`, `NEMOTRON_MODEL`, `GEOCODIO_API_KEY`.
- **SPA build** → `wrangler deploy` (single command via `pnpm --filter @polity/pulse-demo deploy`).
- **Cron trigger** `*/5 * * * *` deployed — the agent heartbeats server-side every 5 min, independent of any browser being open.

### Known issues at deploy time
- **Geocodio key revoked.** The `GEOCODIO_API_KEY` in `.dev.vars` returns HTTP 403 "Invalid API key" from every IP (not a daily-limit 429 — a hard revocation). The `/api/orient` endpoint falls back to the pinned Austin fixtures (46 officials for any Austin-y address, `confidence: low`, honest note in `coverageNote`). To restore true per-address orientation, Torian needs to sign up for a fresh Geocodio key (free tier: 2,500 credits/day) at https://www.geocod.io/sign-up/ and `wrangler secret put GEOCODIO_API_KEY` the new value.
- **congress.gov key is a placeholder** (`<your-congress-gov-key>`). The `/api/rep/:slug` bills section for federal officials will be empty until a real key is set. Get one at https://api.congress.gov/sign-up/ (instant, free) and `wrangler secret put CONGRESS_GOV_API_KEY`.
- **GDELT 429s on the fresh deploy IP** until the rate-limit window clears (5s/request floor; the cron + a few visitor polls will warm it). The `/api/pulse` feed degrades to cache with an honest note when throttled.

### Redeploy checklist (if pursuing fixes)
1. Get a fresh Geocodio key + real congress.gov key.
2. `wrangler secret put GEOCODIO_API_KEY` and `wrangler secret put CONGRESS_GOV_API_KEY` with the new values.
3. `pnpm --filter @polity/pulse-demo deploy` (no code change needed — secrets are runtime, not build-time).
4. Verify `/api/orient` returns `confidence: high` for a real Austin address (Geocodio working) and `/api/rep/us-senator-texas-state-wide-cruz` `live.bills` is non-empty (congress.gov working).

---

## PART 4 — Items only Torian can do (Claude won't act without explicit permission)

- **Make the repo public** (or fork `apps/pulse-demo/` into a fresh public repo). Submission requires a public link; the current repo is private.
- **Provide team roster** (names, roles, contacts) for the Airtable form.
- **Choose project title + team name** (suggested: "Polity Pulse" / yours).
- **Refresh the Geocodio key** (current one is revoked) — sign up at https://www.geocod.io/sign-up/ and `wrangler secret put GEOCODIO_API_KEY` the new value. Restores true per-address orientation.
- **Set a real congress.gov API key** — sign up at https://api.congress.gov/sign-up/ and `wrangler secret put CONGRESS_GOV_API_KEY`. Unblocks the federal bills section on rep pages.
- **Loom video** — skipped per your instruction; if the form hard-requires it, that's a YOU item too.
