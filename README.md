# Polity Pulse — Red Hat Live Data Track

**AITX Community × NVIDIA Claw Agent Hackathon · July 2026**

A civic Claw Agent that watches live legislative + news feeds, **reads each bill with AI to extract its topics, and searches live news on those topics** — so the AI is only useful because the data is live, and the live data is only legible because of the AI.

> Experimental preview — not part of the shipped Polity product. Built for the hackathon on top of Polity's real Layer-1 civic-data pipeline.

---

## The core loop (what the agent does)

1. **Heartbeat** (cron, every 5 min when deployed): the agent wakes, pulls new 119th-Congress bills from congress.gov and live US-governance news from GDELT.
2. **Analyze**: for each bill it calls NVIDIA **Nemotron** (via Cloudflare Workers AI) to extract 3–5 topic keywords from the bill's title + CRS summary.
3. **Search live**: it feeds those AI-extracted topics into the **GDELT** live news search — coverage on what the bill is *about*, not just its number.
4. **File**: it attributes each live news item to the bill or representative it concerns; unmatched items stay on the "wire."
5. **Persist**: heartbeat cursor + narration + extracted topics live in Cloudflare KV across restarts (the "persistent with context" Claw-Agent property).

The result is a navigable civic graph: **address → your officials → a bill → its sponsor → their other bills**, every hop citing a primary source, live news layered on throughout.

---

## Quick start

```bash
# from repo root
pnpm install
cd apps/pulse-demo

# local secrets (gitignored) — see "Env vars" below
#   apps/pulse-demo/.dev.vars

# build the SPA + run the Worker locally (workerd via wrangler)
pnpm --filter @polity/pulse-demo-web build
pnpm --filter @polity/pulse-demo dev        # http://localhost:8799
```

Populate real bills (one-off, uses the congress.gov key):

```bash
CONGRESS_GOV_API_KEY="<key>" pnpm --filter @polity/civic-data-ingest exec tsx scripts/ingest-once.ts
```

---

## Tech stack & architecture

```
┌── apps/pulse-demo (Cloudflare Worker) ───────────────────────────┐
│                                                                  │
│  fetch handler ──► /api/pulse   (heartbeat: bills + GDELT +      │
│                    /api/bills     narration + attribution)       │
│                    /api/bill/:slug (analyzer: AI topics → news)  │
│                    /api/reps       /api/rep/:slug  /api/orient   │
│                                                                  │
│  scheduled handler ──► every 5 min: same buildPulse() loop       │
│                                                                  │
│  bindings:  PULSE_KV (persistent agent memory)                   │
│             ASSETS   (Vite SPA in web/dist)                      │
│  secrets:   DATABASE_URL, CONGRESS_GOV_API_KEY, NEMOTRON_*,      │
│             GEOCODIO_API_KEY                                     │
└──────────────┬──────────────────┬───────────────┬───────────────┘
               │                  │               │
          Neon Postgres      GDELT DOC 2.0    Cloudflare Workers AI
          (Layer-1 bills,    (live news,      (NVIDIA Nemotron-3
           officeholders)     15-min feed)     120B — analyzer +
                                               narration)
               │
          Geocodio (address → districts → officials)

  web/  ── Vite + React + TypeScript + Tailwind + shadcn/ui SPA
           routes: Orient · Reps · Bills · Pulse
```

- **Runtime**: Cloudflare Workers (single Worker) + Static Assets, `wrangler`.
- **AI**: NVIDIA Nemotron-3-120B via Cloudflare Workers AI (OpenAI-compatible `/chat/completions`). Used for (a) the bill analyzer (topic extraction) and (b) one-line "why it matters" narration.
- **Live data**: GDELT DOC 2.0 (news, refreshes ~15 min); congress.gov API (bills, via the Layer-1 ingest Worker); Geocodio (address resolution).
- **Data store**: Neon Postgres (Polity Layer-1 curated bills/officeholders); Cloudflare KV (agent memory — cursor, narration cache, extracted topics).
- **Frontend**: Vite + React + TS + Tailwind + shadcn/ui, served as Static Assets by the Worker.

---

## How to reproduce the demo

1. **Provision**: a Neon Postgres DB, a congress.gov API key (api.congress.gov/sign-up), a Cloudflare account with Workers AI enabled (API token), and a Geocodio key.
2. **`apps/pulse-demo/.dev.vars`** (gitignored) — one `KEY="value"` per line:
   ```
   DATABASE_URL="postgresql://…neon…"
   CONGRESS_GOV_API_KEY="…"
   NEMOTRON_BASE_URL="https://api.cloudflare.com/client/v4/accounts/<account_id>/ai/v1"
   NEMOTRON_API_KEY="<cloudflare API token, Workers AI perms>"
   NEMOTRON_MODEL="@cf/nvidia/nemotron-3-120b-a12b"
   GEOCODIO_API_KEY="…"
   ```
3. **Seed officeholders + bills**: run the Layer-1 ingest (`scripts/ingest-once.ts`, above). ~12 real 119th-Congress bills with CRS summaries + resolved sponsors land in Neon.
4. **Run**: `pnpm --filter @polity/pulse-demo dev`, open http://localhost:8799.
5. **Demo path**: Orient (enter an Austin address → your officials) → Reps (browse, filter by government function) → Bills → open a bill → see the **AI-extracted topics** driving live news, the lifecycle stepper, sponsor → rep cross-link → their sponsored bills. Pulse tab shows the heartbeat "filed this beat" vs "unattributed wire."

> **Note**: GDELT rate-limits to 1 req/5s and 429s a hammered IP; the news sections degrade to an honest empty state and each has a **refresh** button to retry live. A fresh deploy IP clears this.

---

## Datasets & provenance

| Source | Use | Provenance |
|---|---|---|
| congress.gov API v3 | 119th-Congress bills (title, status, sponsor, CRS summary) | Official Library of Congress API. Ingested via `@polity/civic-data`. |
| Neon Postgres (Polity Layer 1) | Curated bills + 2,126 federal officeholders | Sourced from congress.gov + theunitedstates.io legislator data. |
| GDELT DOC 2.0 API | Live news (topic-driven per bill; name-driven per rep) | Public, no-auth, ~15-min refresh. |
| Geocodio | Address → congressional/state-leg districts + current legislators | Commercial geocoder; cites @unitedstates project. |
| `src/austin/fixtures.ts` | TX state / Travis County / Austin officials | Hand-curated from TX Sec. of State, Travis County Clerk, Austin City Clerk public record (July 2026). Structural placeholders flagged `verified: false`. |
| Cloudflare Workers AI | Nemotron topic extraction + narration | NVIDIA Nemotron-3-120B, hosted. |

No synthetic data in the civic layer. AI-generated text (topics, narration) is always labeled "AI" in the UI and never written back to the curated tables.

---

## Known limitations & next steps

- **GDELT throttling**: aggressive rate limits mean news sections often show the honest empty state during heavy testing; the refresh button and a fresh deploy IP mitigate. Topics still render (they're the AI artifact) regardless.
- **Officeholder terms cap at the 118th Congress** in the seed data, so ~29/40 bill sponsors and 100% of roll-call votes don't resolve. Fix: re-run the Bar B officeholder ingest for the 119th Congress. Votes are gated off by default (`INGEST_VOTES=1`).
- **State/county/city officials are fixtures**, not a live pipeline; address→precinct mapping for county/city isn't wired (needs the county shapefile).
- **First cold load ~35s** (Nemotron runs on uncached items); warm it before demoing. Subsequent loads are KV-cached.
- **Next**: (1) a grounded chat agent over the seen-set; (2) persist pulse finds durably so the feed accretes across sessions; (3) the officeholder-term backfill; (4) HiddenLayer runtime-security instrumentation on the LLM calls. See `docs/operations/pulse-demo-handoff-2026-07-19.md`.
