# Handoff — Red Hat Live Data Track (AITX x NVIDIA Claw Agent Hackathon)

**Scope:** Project (polity-app code half). **Event:** AITX Community x NVIDIA Claw Agent Hackathon, Antler VC Austin, July 17–19 2026. **Code freeze:** Sunday July 19, 11:00 AM. **Written:** 2026-07-18, Day 2 of the event.

This is a hackathon-campaign spec, not a canonical version amendment. It does not modify `PRODUCT_SPEC.md`, `VERSION_SPEC_v1.md`, `BEHAVIORAL_SPEC.md`, or `VISION_SPEC.md`. Everything here either (a) ships as ordinary V1 infrastructure work that needed doing anyway, or (b) is explicitly out-of-band demo code, per the decision record below.

## 1. The track, verbatim

> **The challenge:** Build an agent powered by real-time streaming data from any open dataset. The heartbeat has to earn its keep: the agent consumes data as it updates — events as they happen, or feeds refreshing on an interval — and does something useful with it.
>
> **What "good" looks like:** An agent watching a live feed ... and acting on it; personal utility ... through to enterprise ...; creative combinations of multiple live feeds.
>
> **How it's judged:** Genuine use of streaming data (not a static download dressed up as live); how meaningfully the freshness changes what the agent can do; and the quality of the build on top.

Overall scoring: Technical Execution 30 · Sponsor Tech 30 · Value & Impact 20 · "Frontier" Factor 20. Judges explicitly reject "slide decks or simple API wrappers."

Cross-cutting bounties in scope if time allows: **Best Use of vLLM** ($500 — self-hosted vLLM endpoint must genuinely be in the inference path), **Best Use of Nemotron**, **Best Use of NemoClaw + Open Shell**, **Most Commercializable Hack**. Full bounty text for the latter two wasn't fully captured off the Notion page — re-check before committing build time to them.

## 2. Decision record — why this doesn't compromise the shipped product

Three tensions surfaced between "build a flashy live-AI-agent" and Polity's own locked commitments:

1. **`VISION_SPEC.md` §5** lists "AI-synthesis" as a permanent non-direction — Polity's citizen-facing content is curated/cited, never model-generated.
2. **`PRODUCT_SPEC.md:1237` / `BEHAVIORAL_SPEC.md`** — "no notification system... permanent — no notifications about new bills or roll-call votes at any V1 sub-version," tied to the anti-engagement-optimization brand value (`brand/profile.md`).
3. **`IMPL_SPEC.md` §0.2, Build-Time Render / Runtime Read** — citizen-request-time calls to third parties we don't control are banned; `civic-data-ingest`'s existing cron-time calls to Congress.gov are the accepted precedent for *ingest-time* runtime calls being fine.

**Resolution (Torian, 2026-07-18):** split the build into two layers.

- **Layer 1 — Pulse Ingest.** Ships as real, permanent `polity-app` infrastructure. No AI generation, no notifications. It's the existing `civic-data-ingest` Worker with cadence tightened from daily to near-real-time on the bills/votes pipeline. This alone doesn't violate any of the three constraints above — it's the same pattern the ingest Worker already runs, just faster. This is genuinely useful independent of the hackathon and is the honest "core part of polity-app going forward" the effort was chosen for.
- **Layer 2 — Pulse Demo.** Hackathon-only. AI-narrated, alert-styled dashboard. Lives in its own app, **never linked from `apps/web` nav or routes**, explicitly banner-labeled "Experimental preview — not part of the live Polity product." This is where the Claw Agent theatrics (LLM narration, live-tick alerts) happen without touching the permanent no-AI-synthesis / no-notifications commitments, because those commitments govern the shipped citizen product, not an unlinked internal demo surface.

If Layer 2 is ever to become real product, that requires its own future decision and likely a VISION_SPEC amendment — out of scope here.

## 3. Architecture

### 3.1 Layer 1 — Pulse Ingest (extends `apps/civic-data-ingest`)

- Reuses existing modules: `@polity/civic-data/congress-gov`, `/bills`, `/votes`, `/freshness`.
- **Change:** add a new cron trigger (e.g. every 10–15 min) that runs a lightweight "check for new bill-status-events / votes since last tick" cycle — a subset of the existing daily batch, not a full re-fetch. Existing `runBillsCycle` / `runVotesCycle` already upsert idempotently, so the tightened cadence is additive, not a rewrite.
- **Gap to close if time allows:** Senate roll-call votes are currently unsourced (`congress-gov/house-votes.ts` header notes api.congress.gov only exposes House votes). House-only is fine for the hackathon demo; note the gap, don't try to fix it this weekend.
- No schema changes required — `bills`, `votes`, `bill_status_events` already carry `last_ingested_at` / `event_at` and the freshness system already tracks staleness per table.
- Output of this layer: the *existing* citizen-facing bill/vote wiki pages get fresher data, and their existing "Last refreshed: {date}" vintage footer starts showing minutes instead of a day. **This is real, permanent product value and needs no further spec.**

### 3.2 Layer 2 — Pulse Demo (new app, hackathon-only)

New workspace package: `apps/pulse-demo` (Next.js minimal app or a single Worker + static HTML page — lean toward the simplest thing that ships by Sunday; a plain Worker serving a server-rendered auto-refreshing page is probably faster than wiring a second Next.js app into the Turborepo pipeline under time pressure).

**Data sources it watches:**
1. **Civic feed (real):** reads Layer 1's Postgres tables (`bill_status_events`, `votes`) via the same Hyperdrive binding, read-only. This is the "enterprise/civic" half of the track's "personal or enterprise" framing.
2. **Guaranteed-live backup feed:** **GDELT** (Global Database of Events, Language, and Tone) — updates every 15 minutes, free, no auth, queryable over HTTP. Filter to US governance/political-event records. Chosen specifically because **Congress is very likely out of session this weekend** — if we anchor solely on House votes, the demo may show zero new ticks during the Sunday judging window (12:00–3:00 PM), which is exactly what the rubric calls out as failing ("static download dressed up as live"). GDELT guarantees a visible tick on stage regardless of the congressional calendar.
   - Combining these two satisfies the track's explicit "creative combinations of multiple live feeds" callout.
   - **Action item before building:** live-check the GDELT DOC 2.0 / Event API endpoint and query format at build time — don't trust this spec's endpoint details from memory, confirm against the current API docs first.
3. **Storage for Layer 2 state:** Cloudflare KV (heartbeat cursor + generated narration cache), **not** `@polity/db` / the curated Postgres schema. Keeps demo-only data physically out of the canonical citizen-facing schema — no migration, no risk of demo rows leaking into curated tables.

**The heartbeat loop:**
- Cron trigger, every 2–5 min (tighter than Layer 1 — this is the visible "Claw Agent" pulse for judges).
- Each tick: query both sources for anything new since the last stored cursor → if anything's new, produce output → update cursor in KV.
- "Persistent with context" (per the hackathon's own Claw Agent definition): the KV cursor + a rolling window of prior narrated items is the agent's memory across ticks — it doesn't re-narrate what it already covered.

**Output / "does something useful" (Tier 0 — no LLM required, ships regardless of GPU access):**
- A live dashboard page, auto-refreshing, showing: new civic events as they land, tagged by relevance if a demo address/rep is set (reuse the existing Geocodio + `@polity/geocoder` address→district resolution already built for F1 — this is the "personal utility" angle, directly analogous to the track's own example, "summarize what landed today," applied to *your* representatives instead of your inbox).
- This alone satisfies the Red Hat track's judging criteria without touching any LLM: genuine streaming data, meaningful freshness (minutes not days), useful build on top.

**Output / "Frontier Factor" stretch (Tier 1 — LLM narration, no self-hosting required):**
- Nemotron call (via whatever inference path is available — hosted is fine here, self-hosting is a separate, harder bar) turns each new tick into a one-line plain-language note ("House passed H.R. 1234 on a voice vote"). Clearly bannered as AI-generated in the demo UI. This is Layer 2 only — never touches curated citizen content.

**Output / vLLM + Nemotron bounty stretch (Tier 2 — depends on hardware, unconfirmed):**
- The **Best Use of vLLM** bounty specifically requires a self-hosted `vllm serve` endpoint actually in the inference path — a hosted API (including Featherless AI's platform credit, listed in hackathon resources) likely does **not** qualify, since the bounty explicitly frames it as "self-hosted open infrastructure instead of leaning entirely on a hosted frontier API." This needs either a local GPU or a rented GPU box (RunPod/Lambda/Vast.ai/NVIDIA-provided compute if the hackathon offers any — check with organizers/Discord). **Do not block the Tier 0/1 submission on this** — attempt it last, only if time and hardware allow.

## 4. Judging-criteria mapping

| Criterion | Points | Satisfied by |
|---|---|---|
| Completeness | 15 | Tier 0 dashboard alone: ingest → detect new → render, end to end, no crashes. |
| Technical depth | 15 | Two-source ingest + diff-against-cursor + address/rep relevance matching (reused F1 pipeline) — real pipeline, not a wrapper. |
| Sponsor tech (stack) | 15 | GDELT as the "any open streaming source" the track explicitly permits beyond the Texas list; Red Hat is the track sponsor itself. Nemotron/vLLM (Tier 1/2) add NVIDIA sponsor-tech points if reached. |
| Sponsor tech ("why") | 15 | Can articulate: GDELT chosen specifically for weekend-liveness guarantee; civic feed chosen because it's Polity's actual mission-critical data. |
| Insight quality | 10 | "You have 25+ elected officials most citizens don't know about, and here's what changed for *your* district in the last 10 minutes" — non-obvious, ties to Your Polity's core insight. |
| Usability | 10 | A real citizen could use this tomorrow — it's literally Polity's mission surface, just faster. |
| Creativity | 10 | Multi-feed combination (civic primary-source + GDELT) specifically to defeat the "is it really live" skepticism. |
| Performance | 10 | Tight heartbeat cadence (2–5 min) vs. the daily batch it replaces — the delta is the whole pitch. |

## 5. Build sequence (risk-ordered, not clock-exact — code freeze Sun 11:00 AM)

1. **Layer 1 first.** Tighten `civic-data-ingest` cron cadence; verify existing bills/votes cycles still upsert correctly on the faster schedule against a Neon test branch. Lowest risk — mostly config + a new cron entry, reuses tested code.
2. **Layer 2 skeleton.** New `apps/pulse-demo` Worker, KV binding, cursor logic, reads Layer 1's Postgres (read-only) — get *something* rendering before touching GDELT.
3. **GDELT integration.** Confirm live endpoint/query shape first (don't assume), wire the second feed in, combine with the civic feed on one dashboard.
4. **Address/rep relevance.** Reuse `@polity/geocoder` + existing district-resolution to filter the feed to a demo address — this is the single highest-leverage "Value & Impact" item, do it before any LLM work.
5. **Tier 0 checkpoint — this alone is a valid, complete Red Hat track submission.** Everything past this point is stretch, ordered by expected payoff vs. remaining time.
6. **Tier 1 — Nemotron narration** (hosted inference path, whatever's fastest to wire up).
7. **Tier 2 — self-hosted vLLM**, only if hardware is confirmed available. Check Discord / organizers early for GPU access rather than assuming.
8. **HiddenLayer / NemoClaw bounties** — only if 6–7 land with time to spare; not evaluated in this spec, re-read those track pages first.

## 5a. Build log — what has landed

- **2026-07-18 — Branch `hackathon/red-hat-live-data` created** off `main` (carries the in-flight Agora/search uncommitted work in the tree; untouched by this effort).
- **2026-07-18 — Layer 1 (Pulse Ingest) landed.** Two files changed in `apps/civic-data-ingest`:
  - `wrangler.toml` — added a 4th cron trigger, every 15 minutes.
  - `src/index.ts` — added `runPulseBatch()` (lightweight `runBillsCycle` + `runVotesCycle`, capped at `maxBills: 10` / `maxVoteFiles: 10`) and a dispatch branch for the new cron. Reuses the existing idempotent upsert cycles verbatim — no changes to `@polity/civic-data`. Bar B (officeholders/committees) and amendments deliberately excluded from the tick; the daily 06:00 UTC sweep stays the authoritative full pass.
  - Verified: `pnpm --filter @polity/civic-data-ingest typecheck` clean; existing test suite 11/11 pass. Not yet exercised against a live Neon branch or `wrangler dev` — see open items.
- **Decision — vLLM (Tier 2) descoped to stretch-stretch.** This dev machine is an **M1 Pro (arm64, 32GB, no CUDA GPU)**; vLLM's performance path is CUDA-only and does not run meaningfully on Apple Silicon. The $500 vLLM bounty therefore requires renting/accessing a CUDA GPU (RunPod/Lambda/Vast.ai or hackathon-provided compute). Decision: skip for now, chase only in the final hours if Tier 0/1 are done and a GPU materializes. Tier 1 Nemotron narration can still run via a hosted inference path.
- **Decision — Layer 2 (`pulse-demo`) runs local for now.** Deploy to Cloudflare Workers for the Sunday 2–4 PM public-voting URL only if time remains after Tier 0/1 land.
- **2026-07-18 — Layer 2 Tier 0 (`apps/pulse-demo`) landed.** New standalone Worker (`package.json`, `wrangler.toml`, `tsconfig.json`, `src/index.ts`). Self-contained; runs with `pnpm --filter @polity/pulse-demo dev` (wrangler dev on :8799) — no secrets, no DB required. Serves:
  - `GET /` — inline HTML dashboard, polls every 20s, animated heartbeat dot, renders items newest-first with a NEW tag on first-seen items, experimental banner.
  - `GET /api/pulse` — the agent tick: refreshes GDELT (min-interval-guarded, one shared upstream call for all viewers), diffs against a module-scope `seenIds` cursor (the "persistent context" Claw-Agent property), returns `{banner, heartbeat:{tick,newThisTick,...}, feeds[], items[]}`.
  - GDELT query: US-governance terms + `sourcecountry:US`, `timespan=60min`, `sort=datedesc`. Schema verified live against a real response (`url/title/seendate/domain`).
  - **Throttle resilience verified end-to-end:** GDELT rate-limits to 1 req / 5s and returns a *plaintext* body when throttled; the Worker detects non-JSON / non-200, serves last-good cache, and reports `"upstream throttled; serving cache"` rather than crashing. Confirmed by hitting the live Worker while this IP was in GDELT's 429 penalty box — degraded cleanly.
  - **Civic feed = stub.** `readCivicFeed()` returns `[]` + an "offline (no DB configured)" status unless `DATABASE_URL` is set. Real wiring (read Layer 1's `bill_status_events` + `votes` from Neon, newest-first) is the next build step — kept a stub so Tier 0 runs with zero secrets tonight.
  - Typecheck clean. Verified serving both routes locally.

- **2026-07-18 — Civic feed wired (real, not stub).** `refreshCivic()` now queries Layer 1's `bills` table via `@neondatabase/serverless` (HTTP driver — Workers-native, no Hyperdrive/TCP), newest by `last_ingested_at`, mapped to `PulseItem`s. Same degrade-to-cache resilience as GDELT (no DATABASE_URL / query error / schema drift → last-good cache + status note, never throws). Timestamp = `last_ingested_at`, so the civic feed's freshness *is* the Layer 1 pulse heartbeat, interleaved with GDELT by time. GDELT query narrowed to legislative phrase-matches (cut a 30-item war-heavy result to a ~9-item on-topic set). Typecheck clean; verified live with GDELT `ok` and civic gracefully `offline` on the no-DB path. **Activation:** put `DATABASE_URL` in `apps/pulse-demo/.dev.vars` (gitignored) — the real civic query can't be exercised without a Neon connection string.

- **2026-07-18 — Civic query verified against live Neon.** With `DATABASE_URL` set in `.dev.vars`, `/api/pulse` returned a real `bills` row — the query path works end-to-end. **DB state probed:** `officeholders`=2126 (Bar B ran), but `bills`=1 (test only), `votes`/`bill_status_events`/`events`/`committees`=0. So the civic feed is *wired and proven* but *thin*, because the bills/votes pipeline has never ingested real data into this Neon branch.
- **Blocker identified for real civic data:** the legacy theunitedstates.io source (`unitedstates/congress` git repo) holds only scraper code, not bill data — confirmed empty via GitHub API. `api.congress.gov` returns 403 without a key. **Populating real bills/votes requires a free CONGRESS_GOV_API_KEY** (api.congress.gov/sign-up, instant). This gates Layer 1's actual usefulness too, not just the demo. Once the key exists, run Layer 1's V1.2 batch (or a one-off `runBillsCycle`/`runVotesCycle`) and the civic feed populates automatically.
- **Security note:** the Neon connection string was pasted into the assistant chat transcript on 2026-07-18. Recommended: rotate the Neon password after the event.

- **2026-07-18 — Tier 1 AI narration landed (demo-only).** `narrate()` + `narrateOne()` in `apps/pulse-demo/src/index.ts`. For the newest un-narrated items each tick (capped `NARRATION_MAX_PER_TICK=4`, `NARRATION_TIMEOUT_MS=7000`, parallel), calls an OpenAI-compatible `/chat/completions` endpoint for a one-sentence neutral "why it matters," attaches it as `item.narration`, renders it in the dashboard under the title with an "AI" tag. Results cached by item id (`narrationCache`) so each item is narrated once ever — cost control + persistent-context property. Config via three env vars (`NEMOTRON_BASE_URL` / `NEMOTRON_API_KEY` / `NEMOTRON_MODEL`); absent any, narration is skipped and the feed is unaffected (verified: `enabled:false` graceful path, typecheck clean). Works with NVIDIA hosted Nemotron (`https://integrate.api.nvidia.com/v1`), self-hosted vLLM, or Featherless — all OpenAI-compatible. **Happy path not yet exercised** — needs a real endpoint + key in `.dev.vars` (see wrangler.toml example block). System prompt enforces neutral/non-partisan one-liners, consistent with Polity's voice even though this is a demo surface.

- **2026-07-18 — Nemotron narration verified live via local Ollama, not Featherless.** Featherless subscription was Active but stuck at $0.00 balance (`insufficient_credits` on every call) despite the hackathon promo code — an account/billing issue on Featherless's side we couldn't self-serve past. Pivoted: pulled `nemotron-mini` (NVIDIA, 2.7GB Q4) into the local Ollama already running on this Mac. Ollama exposes an OpenAI-compatible `/v1/chat/completions` endpoint, so **zero code changes** — just repointed `NEMOTRON_BASE_URL="http://localhost:11434/v1"`, `NEMOTRON_MODEL="nemotron-mini"`. Verified end to end: `/api/pulse` returned `narration: {enabled:true, note:"narrated 1/1 new this tick"}` with a real generated one-liner on the civic test bill. Arguably a *stronger* story for "self-hosted open infrastructure" than a hosted API would've been — worth leading with in the pitch. Featherless key kept in `.dev.vars` in case credits land later and Torian wants to switch back (just re-edit the three NEMOTRON_* lines).

- **2026-07-19 — Bills status-derivation bug fixed (pre-existing, real).** Root-caused: `packages/civic-data/src/congress-gov/bills.ts` hardcoded `status: undefined` on every bill from the congress.gov source, which made `transformBill()` silently drop 100% of bills (`if (!mappedStatus) return null`) — zero errors logged, so it looked like a clean success. This is why the ingest Worker's bills pipeline had never actually populated anything against congress.gov. Added `deriveUpstreamStatusKey()` — a heuristic on `latestAction.text` that maps to the existing `BILL_STATUS_MAP` vocabulary (INTRODUCED/REFERRED/REPORTED/PASS_OVER_*/PASSED_BILL/ENACTED_SIGNED/etc.), always resolving to at least `INTRODUCED`. **Verified: re-ran `scripts/ingest-once.ts` — `billsValidated: 40, billsUpserted: 11` (was 0/0 before the fix). DB now has 12 real bills with correct statuses** (`referred_to_committee`, `passed_chamber_of_origin`), civic feed confirmed showing them live.
- **Bug 2 (votes / sponsor resolution) — root cause confirmed, not fixed.** Both the votes-officeholder join and ~29/40 bill sponsors fail to resolve because officeholder term rows stop at the 118th Congress (2023–2025); there are no 2025–2027 (119th Congress) term rows for sitting members, even though 538 officeholders have *some* term covering mid-2026 (mostly Senators on longer terms). Needs a Bar B officeholder-term backfill for the 119th Congress — out of scope for tonight. `scripts/ingest-once.ts` votes are gated behind `INGEST_VOTES=1` (default off — a full cycle takes ~38 min to fail 100% of rows via `ingest/vote-officeholder-unresolved`).
- **2026-07-19 — Other-model session: major Layer 2 rebuild while this session was mid-diagnosis.** Rebuilt the dashboard as a Vite+React+TS+Tailwind+shadcn SPA served via Cloudflare Static Assets (`apps/pulse-demo/web/`), replacing the inline-HTML dashboard. Added persistent KV-backed agent memory (`PulseStore` class — heartbeat cursor + narration cache survive isolate restarts, a genuine upgrade over the prior module-scope-only state). Added `/api/orient` (address → officials, Geocodio-backed, Travis-County-scoped) and `/api/rep/<slug>` (persistent official pages: name/role/categories/live data) backed by a new `src/austin/` module (curated real-official fixtures + a 10-category taxonomy for organizing local government by function — see `docs/operations/pulse-demo-category-taxonomy-2026-07-19.md`). Rewrote the narration system prompt to be citation-discipline-aware (source-tier tags, "not yet determined," contested-term flagging) — see `docs/operations/pulse-demo-ui-ux-plan-2026-07-19.md` for the full UI/UX plan including a deliberate **"do not adopt"** call on a conversational chat surface (correctly identified as brand risk + scope creep past freeze). Verified working end-to-end after resuming: `/api/pulse`, `/api/orient`, `/api/rep/<slug>` all confirmed live against real data (orient returned 36 real officials for a Travis County address; rep page returned Kirk Watson with correct categories).
- **2026-07-19 — Narration switched from local Ollama to Cloudflare Workers AI (`@cf/nvidia/nemotron-3-120b-a12b`).** Torian's call, weighing bounty fit + a real bug + a real deploy blocker (see decision below). Root-caused a second narration bug in the process: **Nemotron-3 is a reasoning model** — it spends completion tokens on an internal chain-of-thought (returned in `message.reasoning`) before writing the final answer to `message.content`. The original `max_tokens: 90` / `NARRATION_TIMEOUT_MS: 7000` truncated it mid-thought every time (`finish_reason: "length"`, `content: null`), which is *why* the Ollama-era cached narrations were stale (never actually re-verified against a working call). Fixed: `NARRATION_MAX_TOKENS = 600`, `NARRATION_TIMEOUT_MS = 20000` (verified live: ~250-300 completion tokens for a real one-sentence answer once reasoning is included). Also found and fixed a **second, independent bug**: the Ollama-era narration hallucinated a single fixed fake citation ("H.R. 1234 as reported by House Natural Resources") verbatim from the system prompt's example text, identical across different bills — a small (4B) local model pattern-copying the example rather than reasoning about the real item. Cleared stale local KV state (`.wrangler/state`, dev-only) to force fresh calls; **verified: every item now gets a distinct, accurate, item-specific narration** referencing its real title/status.
  - **Decision rationale:** doesn't hurt the vLLM bounty (already out of scope, hosted either way) or the Nemotron bounty (still a real NVIDIA Nemotron model, arguably a stronger claim). Fixes a real deploy blocker — local Ollama only works because `wrangler dev` runs on the same machine as Ollama; deploying to a real Cloudflare URL for Sunday's public voting would leave narration unreachable and silently disabled. Cost is pay-per-token ($0.50/M in, $1.50/M out) — negligible at our capped volume (4 narrations/tick max).
  - Config: `NEMOTRON_BASE_URL="https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1"`, `NEMOTRON_MODEL="@cf/nvidia/nemotron-3-120b-a12b"`, `NEMOTRON_API_KEY=<cloudflare API token with Workers AI perms>`. Same OpenAI-compatible contract our code already targets — zero code changes needed for the endpoint swap itself, only the reasoning-model token/timeout fix.

**Remaining for Layer 2:**
- Optional: address/rep relevance filter deeper integration; further GDELT query tuning; deploy to Workers for a shareable public-voting URL (Cloudflare Workers AI narration now makes this actually viable, unlike the Ollama path).
- Optional: officeholder-term backfill for the 119th Congress (Bar B), which would fix both the votes pipeline and the remaining ~29/40 bill-sponsor resolution failures.

## 6. Open items needing a quick confirm before/while building

- **Branching:** repo has active uncommitted work on `main` (Agora core loop, search flow). Recommend a fresh branch for this effort (e.g. `hackathon/red-hat-live-data`) so it doesn't collide with or get swept into that in-flight work. Needs your go-ahead to create it.
- **vLLM hosting:** no GPU/vLLM setup exists in this repo today. Confirm what hardware is actually available this weekend before Tier 2 is attempted.
- **Deployment target for `pulse-demo`:** Cloudflare Workers (matches the rest of the stack, shareable URL for judges) vs. just running it locally for the live demo. Workers is probably worth the ~15 min setup cost given "Hack Fair & Public Voting" runs 2–4 PM Sunday and a shareable URL helps there.
- **GDELT filter terms:** needs a first pass at query terms/actor codes to keep the feed US-governance-relevant rather than global noise — do this live against the real API, not from memory.

## 7. Non-goals

- Not touching `VISION_SPEC.md`, `PRODUCT_SPEC.md`, `BEHAVIORAL_SPEC.md`, or any canonical spec file.
- Not adding notification infrastructure to `apps/web`.
- Not adding AI-generated content to any curated table or citizen-facing route.
- Not attempting Senate vote sourcing, HiddenLayer, or NemoClaw unless Tier 0/1/2 land early with time to spare.
