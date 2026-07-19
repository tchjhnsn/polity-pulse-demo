# Pulse Demo — IA Restructure: Bills Pages + Attributed News

**Status:** plan, awaiting Torian confirmation before build. 2026-07-19. ai-model: claude-fable-5.
**Companions:** `handoff-red-hat-live-data-hackathon-2026-07-18.md` (architecture), `pulse-demo-ui-ux-plan-2026-07-19.md` (shadcn/component layer — still authoritative for tokens, primitives, states), `pulse-demo-category-taxonomy-2026-07-19.md` (rep categories).

## 1. The direction (Torian, 2026-07-19)

Two calls:

1. **Bills get pages.** The demo currently shows bills only as feed cards. The real polity-app treats a bill as a first-class wiki entity (`/bills/[congress]/[bill]`, breadcrumbed, cited, vintage-stamped). The demo should mirror that shape.
2. **News is attributed, not free-floating.** GDELT items should land *on the pages of the entities they're about* (a bill page, a rep page) rather than pooling in one undifferentiated feed. Free-floating news is the engagement-feed pattern Polity explicitly rejects; attributed news is the wiki pattern Polity is.

This also sharpens the hackathon story: the agent isn't just *watching* feeds, it's *filing* what it sees against a civic knowledge structure — closer to "does something useful with it" than a raw ticker.

## 2. Reference points in the real app (what we're mirroring)

| Real app | Pattern borrowed |
|---|---|
| `/bills` browse-index (F23) | Filterable index: status + chamber + text query; server does the filtering |
| `/bills/[congress]/[bill]` (F20) | Breadcrumb (Polity → Bills → title) → article layout: title, lede, status, sponsor, sources |
| `WikiArticleRenderer` | Lede-then-sections article shape; citations inline, never bare claims |
| IMPL_SPEC §0.2 data-vintage | Every surface shows *when* its data was sourced ("Last ingested {timestamp}") |
| Voice rules | Status vocabulary verbatim from `BILL_STATUSES` (`referred_to_committee` renders as "Referred to committee"), no invented copy |

We mirror shape, not code — the demo stays a Vite SPA + Worker, unlinked from `apps/web`.

## 3. New information architecture

### 3.0 Audit findings (2026-07-19, claude-opus-4-8) — why the IA changes

Read of the current SPA (`web/src/App.tsx` + `components/pulse/*`) and the real app's `SiteHeader.tsx`:

| # | Finding | Fix |
|---|---|---|
| A1 | **Nested tabs.** Dashboard has an outer Orient/Live-Pulse `Tabs`, and *inside* Live-Pulse a second All/Civic/GDELT `Tabs`. Tabs-in-tabs hides depth and gives judges two competing "where am I" signals. | Promote the outer tabs to real top-nav routes. The inner feed filter stays (it's a legit sub-filter), but only on `/pulse`. |
| A2 | **Reps are undiscoverable.** An official is reachable *only* via Orient → type address → click a `RepCard`. There is no "browse who governs Austin." A judge who doesn't type an address never sees the 36-official breadth — the single most impressive data asset. | Promote **Reps** to top nav: a browsable directory, address-optional. |
| A3 | **`RepCard` layer badges misuse status variants.** Layers map to `federal→"ok"(green)`, `state→"warning"`, `county→"bad"(sienna)`, `city→"idle"`. A county official is not "bad." Semantically wrong and it fights the category-color axis. | Give layers their own neutral badge treatment (ink-toned, layer-labeled), distinct from the status-variant axis and the category-color axis. |
| A4 | **Hero copy/surface mismatch.** Header says "a civic heartbeat" but the default surface is Orient (an address tool). The heartbeat is actually the *demoted* surface. | Let each route own its own one-line purpose; reserve "heartbeat" language for `/pulse`. |
| A5 | **News is free-floating** (the §1 directive). Mixed civic+GDELT feed with no attribution. | Attribution pass (§4); news files onto bill/rep pages; residue → `/pulse` wire. |
| A6 | **No bill surface** (the §1 directive). Bills appear only as feed cards. | `/bills` index + `/bill/:slug` page (§6). |

### 3.1 The demo as a simplified main-app

The demo should read as a stripped sibling of the real app, one nav slot per real section:

| Real app nav | Demo nav | What it is in the demo |
|---|---|---|
| (home = F1 address landing) | **Orient** (`/`) | Address → your officials across 4 layers. The personalized hero. |
| Directory | **Reps** (`/reps`) | Browse *all* Austin/Travis officials, grouped by layer, filterable by category. Address-optional. |
| (bill browse F23 / F20) | **Bills** (`/bills`, `/bill/:slug`) | Real Layer-1 bills: index + article page with attributed news. |
| — (no real-app equivalent) | **Pulse** (`/pulse`) | The hackathon agent layer: heartbeat, feed health, and the attribution "filed this beat" view + unattributed wire. |

Wordmark "Polity Pulse" links home. Nav is 4 text links, active underlined (mirror `SiteHeader`'s `aria-current` pattern), hamburger below the mobile breakpoint. Rep and bill *detail* pages are reached from their index and breadcrumb back (`Reps → Kirk Watson`, `Bills → H.R. 196`).

```
/            Orient (home)   — address → your officials (hero; the F1 flow)
/reps        NEW — directory — all officials, grouped by layer, category filter, address-optional
/rep/:slug   Rep page        — + "In the news — matched by headline" (from shared attribution pass)
/bills       NEW — bills index — real Layer-1 bills, status filter, NEW-since-last-beat markers
/bill/:slug  NEW — bill page  — article-shaped: status, sponsor, source link, AI margin note, ATTRIBUTED news
/pulse       Heartbeat (demoted) — agent internals: tick, feed health, "filed this beat", unattributed wire
```

**The key structural change:** the current "Live Pulse" tab — one big mixed feed — stops being a primary surface. It becomes `/pulse`, the *agent's own diagnostic view* (judges still get the heartbeat theater: tick counter, beat dot, feed chips, "new this beat"). News the attribution pass can't file shows there as "Unattributed wire" — visibly the residue, not the product.

### 3.2 Reps directory (`/reps`) — the newly-promoted surface

- Breadcrumb-less top surface (it's a nav root).
- **Address bar at top, optional.** Empty → show all officials grouped by layer (Federal / State / County / City), each layer a labeled section. With an address → the same list but "Yours" officials float to the top of each layer, rest dimmed but still browsable. Reuses `AddressInput` + the orient result; no new endpoint (the fixture set is already enumerable — add `GET /api/reps` returning the full fixture list so the directory works with no address).
- **Category filter row** (the 10-category `CategoryBadge` set already built) — click "Transportation" → show only officials whose office touches it. This is the "organize my government by what it does" axis from the taxonomy doc, finally surfaced at the directory level, not just per-rep.
- `RepCard` reused as-is (after the A3 layer-badge fix).

## 4. The attribution mechanism (Worker-side)

New module `src/attribution.ts`, pure function, runs inside `buildPulse()` after both feeds refresh:

```
attributeNews(articles: GdeltArticle[], bills: CivicRow[], fixtures: Fixture[])
  → { byBill: Map<billSlug, PulseItem[]>,
      byRep: Map<repSlug, PulseItem[]>,
      wire: PulseItem[] }          // unmatched residue
```

Matching heuristics, checked in order (first match wins; an item can also match both a bill and a rep):

1. **Bill-number match** — regex over the article title for `H.R. 196`, `HR196`, `H. Res. 4`, `S. 42`, `S.J.Res. 7` etc., normalized to our slug scheme (`119-hr-196`). Only attribute when the bill exists in our `bills` cache (no phantom pages).
2. **Rep-name match** — case-insensitive last-name + first-name-or-title match against the Austin fixture set (`"Kirk Watson"`, `"Watson"` + `"mayor"`, `"Doggett"`, `"Cruz"`…). Last-name-only requires a title/role word in the same headline (`"Sen."`, `"Rep."`, `"Mayor"`, `"Judge"`) to avoid false positives on common surnames.
3. **No match** → wire.

Honesty rule (citation discipline applied to attribution): each attributed item carries `attributedBy: "bill-number" | "name-match"` and the UI labels the section "In the news — matched by headline" so we never imply editorial curation. This is a heuristic and we say so on-surface.

Attribution state is derived per tick from cached data — nothing new persisted to KV (the cursor/narration stores are untouched).

## 5. API changes

| Endpoint | Change |
|---|---|
| `GET /api/pulse` | Response gains `wire: PulseItem[]` (unattributed only) and per-item `attribution?: { kind, entitySlug }`. `items` stays for back-compat during the build, removed at the end. |
| `GET /api/bills` | NEW — list of civic bills: slug, title, status, statusLabel, sponsor (when resolved), lastIngestedAt, newsCount, isNew. |
| `GET /api/bill/:slug` | NEW — one bill: everything above + sourceUrl (congress.gov), narration (the AI margin note), attributed news items. 404 pattern copied from `/api/rep/:slug`. |
| `GET /api/reps` | NEW — the full Austin/Travis fixture set for the directory: slug, name, role, layer, party, district, categories. No address needed. Powers `/reps` when the visitor hasn't oriented. |
| `GET /api/rep/:slug` | Unchanged shape; its `live.news` now comes from the shared attribution pass instead of its own per-rep GDELT query (one upstream call serves all pages — respects the GDELT rate limit better than today). |

## 6. Page specs (SPA)

### `/bills` — index
- Breadcrumb `Pulse → Bills`.
- Filter row: status Tabs (All · Introduced · Referred · Reported · Passed origin-chamber · Enacted) — client-side, counts in labels, statuses with zero bills hidden.
- Bill rows as Cards: title (link), status Badge (status→color map reusing the category-badge pattern), sponsor line *only when resolved* ("Sponsor: not yet resolved" otherwise — field-status vocabulary, never blank), `NEW` badge on first-seen-this-beat, news-count chip ("3 in the news") when attribution found matches.
- Footer vintage: "12 bills · last ingested {relative time} · source: api.congress.gov".

### `/bill/:slug` — article
- Breadcrumb `Pulse → Bills → {title}`.
- **Header block:** title (h1), slug rendered as the formal designator ("H.R. 196 — 119th Congress"), status Badge + plain-language status line.
- **Margin note:** the AI narration, italic, `AI` Badge, same treatment as feed cards — one line, clearly machine-labeled.
- **Record section:** sponsor (or "not yet resolved"), chamber, introduced date if present, canonical source link out to congress.gov (the citation — always present, `source_url` is NOT NULL by schema).
- **In the news — matched by headline:** attributed GDELT cards (domain, time, title→link). Empty state: "No coverage matched this bill in the current window." — absence stated plainly, never hidden.
- **Vintage footer:** "Last ingested {timestamp} · Polity Layer 1 pulse".

### `/pulse` — heartbeat (demoted, renamed)
- Keeps: StatusStrip (tick, beat dot, feed chips, ai chip, pause/refresh), the counts.
- Feed becomes two stacked sections: **"Filed this beat"** (attributed items, each row showing *where* it was filed: "→ H.R. 196" / "→ Kirk Watson" as a link) and **"Unattributed wire"** (the residue).
- This is the judge-facing "watch the agent think" surface — the filing action makes the agent's usefulness visible.

### `/` Orient + `/rep/:slug`
- Orient unchanged except header nav.
- Rep page: rename its news section to "In the news — matched by headline" for consistency; source it from the shared attribution pass.

## 7. What this deliberately does not do

- No news on the Orient home. Home stays a tool (find your officials), not a feed.
- No notifications/toasts when attribution files an item (no-notifications commitment holds on demo surfaces).
- No AI summarization of news articles — narration stays scoped to civic items (bills); GDELT items render as headline + source only.
- No phantom bill pages from news mentions of bills we haven't ingested.
- No changes to `apps/web`, no vault docs.

## 8. Build sequence (risk-ordered)

**Phase I — nav shell + Reps promotion (highest UX payoff, lowest risk; ship even if bills/attribution slip):**
1. **Header nav component** — wordmark + `Orient · Reps · Bills · Pulse`, active state, mobile hamburger; convert `App.tsx` from nested tabs to real routes. Delete the outer Orient/Live-Pulse `Tabs`. ~40 min.
2. **`/api/reps`** + **`/reps` directory** — `RepsDirectory` component: layer sections, optional address bar, category filter row. Reuse `RepCard`. ~50 min.
3. **A3 fix** — layer badges get a neutral ink treatment distinct from status/category axes. ~15 min.

**Phase II — bills pages (§1 directive):**
4. `/api/bills` + `/api/bill/:slug`. ~30 min.
5. `BillsIndex` + `BillPage` components. ~60 min.

**Phase III — attribution (§1 directive):**
6. `src/attribution.ts` + unit-testable matcher (bill-number regex is the fiddly part — test against real headlines). ~45 min.
7. Wire attribution into `buildPulse()`; extend `/api/pulse` with `wire` + `attribution`; repoint rep + bill news at the shared pass. ~40 min.
8. Rework the pulse surface into "filed this beat" + "unattributed wire". ~30 min.

**Phase IV — verify:**
9. End-to-end: nav on every route, `/reps` with and without address, category filter, bills index → bill page, an attributed headline (may need GDELT query widening to catch bill-number headlines), wire view. ~30 min.

~5 hours total. **Phase I alone already fixes the two worst UX findings (A1 nested tabs, A2 buried reps)** and is a coherent, shippable improvement — a natural checkpoint if the freeze looms. Phases II–III deliver the §1 directives.

### Phase I — LANDED 2026-07-19 (claude-opus-4-8)
- **Nav shell** (`AppHeader.tsx`): wordmark + `Orient · Reps · Bills · Pulse`, active underline (`aria-current`), mobile hamburger. `App.tsx` rewritten from nested tabs to real hash routes: `/` Orient, `/reps`, `/rep/:slug`, `/bills`, `/pulse`. The A1 nested-tabs anti-pattern is gone.
- **`/api/reps`** + `allOfficialsOriented()` in `resolve.ts` — returns the full 46-official fixture set (federal 3 / state 12 / county 19 / city 12). `useReps` hook.
- **`RepsDirectory.tsx`** (A2 fix): address-optional browse, layer sections with sub-body hints + counts, **glance stat card (C2)**, **cross-layer category filter (C3)** — verified live: filtering "Transportation" returns federal + state officials side by side.
- **A3 fix**: `RepCard` layer badges now use a neutral institutional color axis (ink-blue/slate/brown/teal), not the status variants that rendered county as "bad"/red.
- **`isYours` fix** (found during verification): `addressScoped` (a property of the office) was mislabeling all 7 district officials "your district" before any address was entered. `RepCard` now takes an explicit `isYours` (from the oriented slug set); pre-orient a district office reads "district-based", flips to "your district" only when it matches the visitor's address.
- **Minimal `/bills`** (`BillsIndex.tsx`): real bills from the civic feed, status-filter chips, status color badges, AI margin note. Placeholder until Phase II's `/bill/:slug` detail pages.
- **Verified**: typecheck clean (worker + web), Vite build clean, all routes serve; browser-confirmed the directory (46 officials, glance card, category filter, party/verified badges), the "district-based" pre-orient label, rep detail pages (Zo Qadri, Cruz — identity/categories/news/office/source-notes all render), and the Pulse route (12 civic bills, feed tabs). The post-orient "yours" highlight is logic-verified (the orient API returns slugs that match fixture slugs) though a clean interactive screenshot was flaky under the test harness's re-render races.

**Next: Phase II** — `/api/bills` + `/api/bill/:slug`, `BillPage` with the lifecycle stepper (C6) and rep↔bill cross-links (C1).

### Phase II — LANDED 2026-07-19 (claude-opus-4-8)
- **`src/austin/bills.ts`**: `listBills()` + `getBill()` — real Layer-1 `bills` with a sponsor join (officeholder→person→party→position). `getBill()` also pulls the AI margin note from the KV narration cache (`narration:civic:<slug>`) and per-bill GDELT news (designator phrase-match, 5-min KV cache, degrades to empty on 429). Worker routes `/api/bills`, `/api/bill/:slug`.
- **`resolveMemberByBioguide()`** in `resolve.ts` + a `member-<bioguide>` fallback in `/api/rep/:slug` — **the C1 unlock**: every bill sponsor (name + bioguide from the DB) cross-links to a real, DB-backed federal rep page, even for members outside the Austin fixtures. Verified: H.Res. 4 → Harold Rogers (`member-r000395`) → a full KY-5 rep page.
- **`BillPage.tsx`** — five zones per the page-design doc: identity (designator + status), **lifecycle stepper (C6)** mapping `BILL_STATUSES` onto a linear path with a terminal-red node for failed/vetoed, AI margin note, the record (sponsor→rep cross-link, chamber, introduced, always-present congress.gov citation), and "In the news — matched by headline" with an honest empty state. `billStatus.ts` (status meta + lifecycle) shared with the index.
- **`BillsIndex.tsx`** rewired to `/api/bills`: designator, status filter chips, sponsor line ("not yet resolved" when unresolved — though all 12 current bills resolve), relative ingest time, rows link to `/bill/:slug`. `useBills`/`useBill` hooks, `billTypes.ts`.
- **Verified**: typecheck + build clean; `/api/bills` returns 12 bills with `repSlug`s; `/api/bill/:slug` returns narration + source + graceful news; `/api/rep/member-<bioguide>` resolves any federal sponsor; browser-confirmed the bill detail page (all 5 zones + stepper) and the sponsor→rep navigation landing on a real out-of-area member page.

**Bidirectional C1 — LANDED 2026-07-19.** `billsBySponsorBioguide()` + a `sponsoredBills` field on `/api/rep/:slug`; the rep page's old congress.gov-live "Bills sponsored" section (which 403'd on the sponsor param) is replaced by a "Sponsored legislation · primary source" section reading Layer 1, each bill linking back to `/bill/:slug`. Verified: Harold Rogers' page lists H.Res. 4 → `/bill/119-hres-4`. The rep ↔ bill graph is now a full round-trip (bill → sponsor → rep → their bills → bill).

### Phase III — LANDED 2026-07-19 (claude-opus-4-8)
- **`src/austin/attribution.ts`** (pure, unit-testable): `buildBillRefs` / `buildRepRefs` / `attributeTitle`. Bill-number match (H.R./H.Res./S. etc. → slug, only against bills in the feed) wins over full-name rep match (first+last, to avoid common-surname false positives); no match → wire. Every match carries `by: "bill-number" | "name-match"`.
- **`buildPulse()`** runs the pass over the assembled items: civic items (bills) self-file to their own `/bill/:slug`; GDELT items match against the 12 feed bills + the 46-official directory. Each `PulseItem` gains `attribution?`.
- **`/pulse` reworked** from a feed-kind tab filter into two sections: **"Filed this beat"** (attributed items, each `FeedCard` showing a clickable "filed to H.R. 122 · bill-number" chip → the entity page) and **"Unattributed wire"** (the residue). The filing is the visible agent behavior.
- **Verified live**: `/api/pulse` returned 18 items → 12 filed / 6 wire; browser-confirmed the "FILED THIS BEAT · 12" section with per-item narration + "filed to <designator>" chips, and the war/DOJ headlines correctly left on the wire.
- **Deviation from the plan (§4)**: the bill/rep *detail* pages keep their own targeted per-entity GDELT queries rather than reading from this shared pass — the shared 30-article governance feed almost never names a specific 119th-opening bill, so the targeted queries are strictly better there. The shared attribution pass is the *pulse-feed* feature (the visible "agent files the wire"), which is where its value lives.

**★ Demo-day note — cold-load latency.** The *first* `/api/pulse` after a restart/deploy takes ~35s because the narration pass calls Nemotron on 4 uncached items (≤20s each, parallel) plus GDELT; subsequent ticks are KV-cached and fast, and the client polls every 20s showing skeletons meanwhile. **Warm it before judging** (open the page once). If cold-load must be faster, lower `NARRATION_MAX_PER_TICK` / `NARRATION_TIMEOUT_MS` in `src/index.ts`.

### Bill summaries + news refresh — LANDED 2026-07-19
- **Bill summaries**: 10/12 ingested bills already carry a CRS summary in `bills.summary` (`summary_source='crs'`). `getBill` now selects it; `BillPage` renders a "Summary · Congressional Research Service" zone between the AI margin note and the record. No re-ingest needed.
- **News refresh button**: the "In the news" section (bill page) and "News mentions" section (rep page) get a refresh control. `getBill(env, slug, refresh)` / `getRepLiveData(env, o, refresh)` bypass the KV news cache when `?refresh=1`; `useBill`/`useRep` expose `refreshNews()` + `refreshingNews`. Lets a demoer retry a GDELT 429 live instead of waiting out the 5-min cache. Verified: click fires `GET /api/bill/:slug?refresh=1`, spinner animates, section updates.

**Remaining (polish):**
- Officeholder-term backfill (Bug 2) to widen sponsor/vote resolution.
- Minor: `getRepLiveData` still makes the now-unused congress.gov `live.bills` call, whose only visible effect is a "congress.gov HTTP 403" source note — harmless dead work; drop when convenient.
- Optional: unit tests for `attribution.ts` (the bill-number regex is the fiddly part).
