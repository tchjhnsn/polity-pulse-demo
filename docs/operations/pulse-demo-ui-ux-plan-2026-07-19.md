# Pulse Demo — UI/UX Plan (Red Hat Live Data hackathon)

**Scope:** Hackathon-only. Companion to `handoff-red-hat-live-data-hackathon-2026-07-18.md`. Not part of the shipped Polity product; not spec-anchored; not linked from `apps/web`. Code freeze Sun 2026-07-19 11:00 AM; public voting 2–4 PM.

**Written:** 2026-07-19. **Authorship:** hybrid (Torian-directed, Claude-assisted). **ai-model:** glm-5.2.

---

## 1. Architecture decision — how shadcn gets into a Worker

`apps/pulse-demo` is currently a single Cloudflare Worker serving inline HTML. shadcn requires React + Tailwind + a bundler. The chosen path:

**Vite + React + TS + Tailwind + shadcn/ui SPA, served as Static Assets by the existing Worker.**

```
apps/pulse-demo/
├── wrangler.toml              # add [assets] binding → ./web/dist
├── src/index.ts               # Worker: /api/pulse JSON only; /* → SPA fallback
├── web/                       # NEW — the dashboard SPA
│   ├── package.json           # vite, react, tailwind, shadcn deps
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── components.json        # shadcn config
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── lib/utils.ts       # cn() helper from shadcn
│       ├── styles/tokens.css  # re-export Polity tokens (import from ../../../../apps/web/src/styles/tokens.css via alias, or copy)
│       └── components/
│           ├── ui/            # shadcn primitives (generated)
│           └── pulse/         # demo-specific composites
└── package.json               # root: adds dev/deploy scripts that build web/ then wrangler deploy
```

**Why Vite, not Next.js:** Next.js adds Turborepo wiring + OpenNext config the handoff doc explicitly chose to avoid ("a plain Worker… is probably faster than wiring a second Next.js app under time pressure"). Vite builds a static SPA in ~5s; the Worker serves it as Static Assets and keeps `/api/pulse` as the JSON endpoint the SPA polls. No SSR, no Node runtime, no OpenNext.

**Why a `web/` subfolder rather than flattening:** keeps the Worker's `src/index.ts` (the agent + API) physically separate from the SPA. The Worker is the agent; the SPA is just a viewer. If the demo outlives the hackathon, the SPA can be swapped without touching agent code.

**Rejected:** mounting inside `apps/web` — violates the handoff's "never linked from apps/web" rule that keeps the no-AI-synthesis / no-notifications spec commitments intact.

**Build flow:**
1. `pnpm --filter @polity/pulse-demo web:build` → `vite build` → `apps/pulse-demo/web/dist/`
2. `wrangler deploy` serves `web/dist/` at `/*` via `[assets]` binding; `/api/pulse` still hits the Worker's `fetch` handler.
3. Local dev: `web:dev` runs Vite on :5174 with a proxy to the Worker's `/api/pulse` (or `wrangler dev` on :8799 serving the built SPA).

---

## 2. Layout

Single page, one column, max-width 860px (matches the current inline HTML; consistent with `--max-prose` for a feed view). No nav, no sidebar, no routing — this is one screen.

```
┌──────────────────────────────────────────────────────────────┐
│ Alert (experimental preview banner)                           │  ← shadcn Alert, variant "warning" (sienna)
├──────────────────────────────────────────────────────────────┤
│ HEADER                                                       │
│  Polity Pulse                                                │  ← h1, ink-blue, Inter
│  A civic heartbeat. Watching live feeds; surfacing          │  ← Subtitle, ink-2, --fs-small
│  what's new since the last beat.                             │
├──────────────────────────────────────────────────────────────┤
│ STATUS STRIP                                                 │  ← flex row, wraps on mobile
│  ● tick 12    [gdelt: ok] [civic: offline] [ai: on]          │  ← heartbeat dot + Badge chips
│  [new this beat: 3]                                          │
├──────────────────────────────────────────────────────────────┤
│ FILTER TABS (optional, Tier 0.5)                             │  ← shadcn Tabs
│  [ All ] [ Civic ] [ GDELT ]                                 │
├──────────────────────────────────────────────────────────────┤
│ FEED                                                         │  ← ScrollArea
│  ┌────────────────────────────────────────────────────┐      │
│  │ CIVIC · congress · Reported  ·  9:42 AM    [NEW]  │      │  ← Card per item
│  │ H.R. 1234 — Coastal Restoration Act                │      │
│  │ [AI] Why it matters: one-sentence neutral note.    │      │
│  └────────────────────────────────────────────────────┘      │
│  ┌────────────────────────────────────────────────────┐      │
│  │ GDELT · nytimes.com · 9:38 AM                      │      │
│  │ "Senate committee advances …"                      │      │
│  └────────────────────────────────────────────────────┘      │
│  …                                                           │
├──────────────────────────────────────────────────────────────┤
│ FOOTER                                                       │  ← muted, --fs-mono
│  Heartbeat polls every 20s. Data: GDELT DOC 2.0 + Polity     │
│  Layer 1 civic feed. Tick #12 at 9:42:03 AM.                │
└──────────────────────────────────────────────────────────────┘
```

Mobile: status strip wraps to two rows; feed cards go full-bleed minus 32px page padding. No other responsive changes — there's nothing else to adapt.

---

## 3. shadcn component inventory

Mapped 1:1 to UI needs. Components marked **(install)** are pulled via `npx shadcn@latest add <name>`; the rest are composites we write in `components/pulse/` on top of the primitives.

| UI need | shadcn primitive | Notes |
|---|---|---|
| Experimental-preview banner | `Alert` (install) + `AlertTitle`/`AlertDescription` | variant: warning; sienna background; sits above everything |
| Heartbeat dot | custom `<PulseDot />` in `components/pulse/` | pure CSS animation; no shadcn primitive fits. Uses `--accent-green` |
| Feed status chips | `Badge` (install) | variants map to feed state: `ok` → olive, `bad` → sienna, `idle` → ink-3 |
| "NEW" tag on first-seen items | `Badge` | variant: warning; mustard; auto-dismisses after 1 tick (client-side) |
| "AI" tag on narration | `Badge` | variant: secondary; ink-3 background; uppercase mono |
| Tick counter | `Badge` (outline variant) | mono font, ink-2 |
| Feed list scroller | `ScrollArea` (install) | bounded height (~70vh); native scroll on mobile |
| Item container | `Card` (install) + `CardHeader`/`CardContent` | `new` state toggles a mustard left-border + `--hl-yellow` wash |
| Source / timestamp row | `Text` (no primitive — just styled span) | uses `--fs-mono-sm`, `--ink-3` |
| Item title (as link) | `Button` variant `link` OR plain `<a>` | current behavior is plain `<a target="_blank">`; keep that |
| Narration block | `Card` nested inside `CardContent`, or a `Separator` + italic paragraph | italic, ink-blue, with `[AI]` Badge prefix |
| Filter tabs (Tier 0.5) | `Tabs` (install) + `TabsList`/`TabsTrigger`/`TabsContent` | All / Civic / GDELT; client-side filter on the items array |
| Empty state (no items yet) | `Empty` pattern — we hand-roll a centered muted block | matches the "Waiting for the first live items…" copy |
| Error state (fetch failed) | `Alert` variant "destructive" | replaces the status strip's gdelt chip when the whole tick fails |
| Skeleton on first load | `Skeleton` (install) | 3× pulsing card-shaped skeletons before first `/api/pulse` resolves |
| Tooltip on timestamps | `Tooltip` (install) + `TooltipTrigger`/`TooltipContent` | shows full ISO timestamp on hover; mobile gets the truncated string only |
| Optional: pause/resume | `Button` (install) | stops the 20s poll; useful during Q&A so the demo freezes on a chosen state |
| Optional: manual refresh | `Button` (icon) | triggers an immediate beat; uses `LucideRefreshCw` |
| Optional: "mark all seen" | `Button` (ghost) | clears the `NEW` tags without waiting for next tick |

**Components NOT used** (and why, to head off over-engineering):
- `Sonner` / toast — the brand has a permanent no-notifications commitment; even on a demo surface we don't want a toast popping up per new item, it muddies the "this is what the agent saw this tick" reading.
- `Dialog` / `Sheet` — nothing to modal over; the dashboard is the whole surface.
- `Accordion` — narration is one line; no need to collapse.
- `Form` / `Input` — no address/rep filter yet (that's a stretch goal per the handoff; if it lands, add `Input` + `Button` + a `Form` around them).
- `DataTable` — wrong primitive; this is a feed, not a table.
- `Avatar` — sources are domains, not people; a Badge is enough.

**Install command (run once after Vite scaffold):**
```bash
cd apps/pulse-demo/web
npx shadcn@latest init            # choose: React, TypeScript, Tailwind, default style, --src-dir
npx shadcn@latest add alert badge card scroll-area tabs skeleton tooltip button
```

---

## 4. Brand token mapping

Import the canonical tokens from `apps/web/src/styles/tokens.css` (alias via Vite `resolve.alias`, or copy the `:root` block — copy is fine for a hackathon since this surface will be deleted post-event). Wire them into Tailwind via `tailwind.config.ts` `theme.extend.colors`:

```ts
colors: {
  paper:      "var(--paper)",
  "paper-2": "var(--paper-2)",
  ink:       "var(--ink)",
  "ink-2":   "var(--ink-2)",
  "ink-3":   "var(--ink-3)",
  // civic inks
  "accent-blue":  "var(--accent-blue)",   // GDELT — informational / federal
  "accent-red":   "var(--accent-red)",    // Civic — editorial / sienna
  "accent-yellow":"var(--accent-yellow)", // NEW tag, highlight wash
  "accent-green": "var(--accent-green)", // heartbeat OK, civic-ok chip
  // party-bright reserved — NOT used on this surface (no party-affiliation badges here)
},
fontFamily: {
  sans:    ["var(--font-clean)"],   // Inter
  hand:    ["var(--font-hand)"],    // Caveat — used only on the header h1 if we want editorial register
  mono:    ["var(--font-mono)"],    // JetBrains Mono — timestamps, tick counter
}
```

**Feed-color assignment (semantic, not decorative):**
- **GDELT** → `accent-blue` (informational, federal-jurisdiction ink — matches its role as the "live news" feed)
- **Civic** → `accent-red` / sienna (editorial, primary-source — matches its role as the "real legislation" feed)
- **Heartbeat dot** → `accent-green` (olive — affirmative, alive)
- **NEW tag** → `accent-yellow` (mustard — highlight, restrained)
- **AI tag** → `ink-3` muted (narration is ancillary, not authoritative)

This matches the existing inline HTML's palette exactly — no re-painting, just formalizing into Tailwind tokens.

**Rule carried over from the canonical tokens:** party-bright colors (`--party-blue`, `--party-red`) are NOT used on this surface. The demo has no party-affiliation badges. The accent-blue / accent-red are civic-ink reserved, not party-conventional.

---

## 5. Interaction states

| State | Visual | Behavior |
|---|---|---|
| First load (no tick yet) | 3× `Skeleton` cards in the feed; status strip shows "tick 0" + all chips idle | `/api/pulse` called on mount |
| Healthy tick, no new items | Dot beats once; chips refresh; feed unchanged | 20s poll continues |
| Healthy tick, N new items | Dot beats; `newThisTick` chip updates; new cards prepend with `NEW` Badge + mustard border + `--hl-yellow` wash; wash fades over 1.5s | `NEW` badge persists for that tick, clears on next |
| GDELT throttled | GDELT chip → `variant="bad"` + "serving cache" note; feed unchanged | No error banner; this is expected |
| Civic offline (no DB) | Civic chip → `variant="bad"` + "offline (no DB configured)" | Expected in local dev w/o `DATABASE_URL` |
| `/api/pulse` fetch error | GDELT chip → "dashboard fetch error"; last-good feed stays visible | Retry on next 20s tick |
| Narration enabled, narrating | AI chip → "narrating N/M this tick"; affected cards show `Skeleton` line where narration will land | Replaces with text when complete |
| Narration disabled | AI chip → `variant="idle"` + "disabled (no NEMOTRON_* config)" | Cards render without narration block |
| Manual pause | Poll `setInterval` cleared; pause button shows "Resume" | Heartbeat dot greys to `ink-3` |
| Filter tab change | Client-side filter on existing items array; no refetch | Preserves scroll position |

**Animation discipline:** one beat animation on the dot (already in the inline HTML — `@keyframes beat`), one fade on the `NEW` wash. Nothing else animates. The demo is about *freshness*, not motion.

---

## 6. Build sequence (risk-ordered, freeze 11:00 AM today)

1. **Scaffold Vite + React + TS + Tailwind in `apps/pulse-demo/web/`** — `pnpm create vite@latest web -- --template react-ts`, add Tailwind, add shadcn init. ~15 min.
2. **Wire Static Assets in `wrangler.toml`** — `[assets] directory = "./web/dist"`, `binding = "ASSETS"`. Update Worker `fetch` to: `/api/pulse` → JSON; everything else → `env.ASSETS.fetch(request)` with SPA fallback to `index.html` for client-side routing (not strictly needed — no routes — but standard). ~10 min.
3. **Port the tokens** — copy `:root` block from `apps/web/src/styles/tokens.css` into `web/src/styles/tokens.css`; wire `tailwind.config.ts`. ~10 min.
4. **Install shadcn primitives** — `npx shadcn@latest add alert badge card scroll-area tabs skeleton tooltip button`. ~5 min.
5. **Build `App.tsx` + the pulse composites** — `PulseDot`, `StatusStrip`, `FeedCard`, `FeedList`, `ExperimentalBanner`. Port the existing `beat()` fetch loop into a `useEffect` + `setInterval`. ~60 min.
6. **Verify `wrangler dev` serves the built SPA + the API** — typecheck, click through. ~15 min.
7. **(Stretch) Filter tabs** — `Tabs` with client-side filter. ~15 min.
8. **(Stretch) Pause + manual-refresh buttons**. ~10 min.
9. **(Stretch) Tooltip on timestamps**. ~10 min.

Steps 1–6 are the minimum to ship shadcn-backed UI before freeze. Steps 7–9 only if time remains.

**What does NOT change:** the Worker's `src/index.ts` agent logic (GDELT fetch, civic query, narration, cursor). Only the `DASHBOARD_HTML` constant and the `fetch` handler's HTML branch get removed/replaced.

---

## 7. Non-goals

- No design doc in the vault (`projects/polity-app/product/design/`) — this is hackathon-only, not a canonical product surface; the plan lives here in `docs/operations/` next to the handoff.
- No Figma, no wireframes beyond the ASCII layout in §2.
- No dark mode (the canonical tokens defer dark mode to V2; the demo inherits light-mode-first).
- No party-affiliation coloring (no party data on this surface).
- No address/rep relevance filter UI — that's a stretch goal from the handoff; if it lands, add `Form` + `Input` + `Button` and a `Geocodio` call, but spec it separately.
- No notifications, no toasts, no push — the brand's no-notifications commitment holds even on the demo surface.
- No SSR, no Next.js, no OpenNext — Vite SPA + Static Assets only.

---

## 8. Open questions for Torian

1. **Vite vs Next.js** — I've recommended Vite for speed. Confirm or override.
2. **Editorial register on the header h1** — keep it Inter (clean, matches the rest of the demo's information-density) or switch to Caveat (matches the Polity marketing surfaces)? I'd default to Inter here; this is a feed, not a frontispiece.
3. **Filter tabs (Tier 0.5)** — worth the ~15 min, or skip and keep one unified feed? The current inline HTML has no filter.
4. **Pause button** — useful for freezing the demo during Q&A, or unnecessary friction? I'd include it.
5. **Deploy target** — still TBD per the handoff §6. If we deploy to Workers for a shareable public-voting URL, the Static Assets binding means `wrangler deploy` handles both SPA + Worker in one step.

---

## 9. Sketch — optional conversational query surface (NOT adopted; exploratory)

**Status:** sketch only. Authored 2026-07-19 in response to "is there supposed to be a chat interface?" Decision required before any of this is built. Adopting it would be a **scope expansion** against the handoff's read-only-viewer design and Polity's permanent no-AI-synthesis commitment — see §9.4 for the tradeoffs.

### 9.1 What this would add

A single input at the bottom of the dashboard. The citizen types a question about something the agent has already surfaced; the agent answers using **only the items currently in its seen-set** as grounding context. No web search, no general knowledge, no follow-up turns beyond the current item.

```
┌──────────────────────────────────────────────────────────────┐
│ FEED (unchanged)                                             │
│  …                                                           │
│  ┌────────────────────────────────────────────────────┐      │
│  │ CIVIC · congress · Reported · 9:42 AM    [NEW]     │      │
│  │ H.R. 1234 — Coastal Restoration Act                 │      │
│  │ [AI] Why it matters: one-sentence neutral note.    │      │
│  │ [ask the agent about this →]                       │      │  ← per-item affordance
│  └────────────────────────────────────────────────────┘      │
├──────────────────────────────────────────────────────────────┤
│ ASK THE AGENT                                                │  ← new region
│  [Input: "What's the status of H.R. 1234?"]   [Send]        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  Agent: Reported by the House committee on Natural Resources │  ← response (1-3 sentences)
│  Resources on July 18. No floor vote recorded yet. Source:   │
│  congress.gov status field on the bill row.                 │
│  [Source: H.R. 1234 — Coastal Restoration Act ↗]            │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 How it differs from the existing narration

| Dimension | Existing narration (Tier 1, shipped) | Conversational query (this sketch) |
|---|---|---|
| Trigger | Cron tick — autonomous | User submit — prompt-driven |
| Input | One item title + source | User's free-text question + grounded item context |
| Output | One neutral sentence ("why it matters") | 1–3 sentence grounded answer with source citation |
| State | Per-item, cached, narrated once ever | Per-question, ephemeral, not cached |
| Model role | Auto-tagger | Q&A over a closed context |

The narration stays. The query surface is **additive** — a separate model call path with its own system prompt, its own guardrails, and its own UI region.

### 9.3 Contract (if adopted)

**Endpoint:** `POST /api/ask` on the Worker (sibling to `/api/pulse`).

```ts
// Request
{
  question: string;             // user's question, max 280 chars
  itemId?: string;              // optional: which PulseItem the question is about
  tick: number;                 // the tick the user was viewing (for context scoping)
}

// Response (streaming optional, plain JSON fine for MVP)
{
  answer: string;               // 1-3 sentences, grounded in the items below
  sources: Array<{ id: string; title: string; url: string | null }>;
  modelUsed: string;            // for the AI badge
  blocked?: boolean;            // true if the question was out-of-scope
  blockReason?: string;
}
```

**Grounding rule (hard):** the system prompt is fed **only** the items currently in the agent's `seenIds` set (or a rolling window of the last N, e.g. 50). The model is instructed: "If the answer is not in the provided context, say 'I don't have that — the pulse feed hasn't surfaced it.' Do not speculate, do not use outside knowledge." This is the only way the conversational surface stays consistent with the no-AI-synthesis commitment — the model is a **reformatter of already-surfaced primary-source data**, not a knowledge source.

**System prompt (draft):**
```
You are a civic explainer for an app that helps ordinary Americans stay
oriented to their government. A citizen has asked a question about items
the pulse agent has already surfaced. Answer using ONLY the provided
context items. 1-3 sentences. Neutral, non-partisan, no opinion. If the
answer is not in the context, say exactly: "I don't have that — the pulse
feed hasn't surfaced it." Do not speculate. Do not use outside knowledge.
Cite the source item by title in your answer when you rely on it.
```

**Guardrails:**
- Rate limit per IP: 1 question / 10s (Worker-side counter in KV).
- Max question length: 280 chars.
- Max context items: 50 (oldest dropped).
- Timeout: 10s (longer than narration's 7s — Q&A is more latent).
- No streaming for MVP; simpler to ship under the Worker runtime.

### 9.4 Tradeoffs — why this is a scope decision, not a default

**Arguments for adopting (the case to make to Torian):**
- The hackathon's "Claw Agent" framing rewards agent-visible autonomy, but judges also score **Value & Impact (20 pts)** and **Frontier Factor (20 pts)**. A grounded Q&A on live data is a more visible "agent does something useful" than a one-line auto-narration.
- The grounding rule keeps it inside the no-AI-synthesis commitment — the model never generates civic claims, only reformats already-surfaced ones.
- It reuses the same Nemotron endpoint already wired; no new infra.
- Strong demo moment: judge types "What happened with the coastal bill?" → agent answers in 2s with a source link.

**Arguments against (the case the handoff actually makes):**
- The handoff §3.2 calls the dashboard an "alert-styled dashboard," not a chat surface. The agent's "act" is the heartbeat loop, not answering questions. Adding chat re-frames the agent from *autonomous watcher* to *question-answerer*, which is a different product.
- The no-AI-synthesis commitment in `VISION_SPEC.md` §5 is permanent and citizen-facing. Even with grounding, a chat surface is the kind of thing that reads to judges as "Polity has an AI assistant" — which is the wrong pitch. The narration is defensible *because* it's a one-line margin note; a chat box is harder to defend.
- Scope: this is a **new endpoint, new UI region, new system prompt, new guardrails, new tests**. Realistic build time 2-3 hours. Freeze is 11:00 AM today (2026-07-19). The current Tier 0/1 dashboard is already a complete submission.
- The handoff §5 build sequence step 5 says: *"Tier 0 checkpoint — this alone is a valid, complete Red Hat track submission. Everything past this point is stretch."* Conversational Q&A is past Tier 1, past Tier 2 (vLLM), and arguably a new Tier entirely.
- Risk: a judge asks an out-of-scope question, the grounding rule fires, the agent says "I don't have that," and the demo moment dies. The read-only dashboard has no such failure mode.

### 9.5 Components this would add (if adopted)

| UI need | shadcn primitive | Notes |
|---|---|---|
| Ask input + send | `Input` (install) + `Button` | in a sticky bottom region or a dedicated section |
| Form wrapper | `Form` (install) + `FormControl`/`FormItem` | React Hook Form integration; or hand-roll a controlled input — lighter |
| Answer display | custom `AgentAnswer` composite | 1-3 sentences + source citation Card |
| "ask about this item" affordance | `Button` variant `link` | per-item, pre-fills the input with a question template |
| AI tag on answer | `Badge` variant `secondary` | same as narration |
| "thinking" state | `Skeleton` (one line, animated) | while the model responds |
| Out-of-scope notice | `Alert` variant `warning` | when `blocked: true` |
| Rate-limit notice | `Alert` variant `warning` | "Wait 10s between questions" |

**Install:** `npx shadcn@latest add input form` (or hand-roll — the form is one field).

### 9.6 Build sequence (if adopted — risk-ordered)

1. **Decide first.** This is a 2-3 hour addition with real brand-risk. Don't start before the decision.
2. **Add `POST /api/ask` to the Worker** — grounding rule, system prompt, guardrails, KV rate-limit. ~60 min.
3. **Add `AgentAnswer` composite + ask region to `App.tsx`** — input, send, answer display, thinking state. ~60 min.
4. **Per-item "ask about this" affordance in `FeedCard`** — optional; can ship without. ~20 min.
5. **Test the failure modes live** — out-of-scope question, rate-limit, model timeout. ~30 min.
6. **Pitch rehearsal** — make sure the grounded-answer framing reads as "reformats surfaced data" not "AI assistant." ~15 min.

### 9.7 My recommendation

**Do not adopt this before freeze.** The read-only dashboard is a complete, on-thesis submission. The conversational surface is a real product decision that deserves its own spec pass, not a hackathon-Friday-night addition. If the brand question ("does Polity have an AI assistant?") is worth answering, it's worth answering slowly.

If you want a **smaller middle ground** that captures some of the demo value without the chat surface: add a per-item "explain more" affordance that opens a modal with a longer (3-5 sentence) narration — same grounding rule, same model, same one-way flow, no input field. That's ~45 min and stays inside the read-only framing. Say the word and I'll spec that instead.