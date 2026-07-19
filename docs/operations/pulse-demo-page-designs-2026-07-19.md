# Pulse Demo — Page Designs: Reps & Bills

**Status:** design, awaiting Torian confirmation. 2026-07-19. ai-model: claude-fable-5.
**Companions:** `pulse-demo-ia-restructure-2026-07-19.md` (nav/routing/attribution — authoritative for the top-level IA), `pulse-demo-category-taxonomy-2026-07-19.md` (categories), `pulse-demo-ui-ux-plan-2026-07-19.md` (tokens/primitives).

Grounded in the *actual* data shapes: `Official` (`src/austin/fixtures.ts`), `RepPageData` + `RepLiveData` (`web/src/lib/repTypes.ts`), `CivicRow` (`src/index.ts`), and the category defs. No invented fields.

---

## PART A — REPS

### A1. Reps IA — three surfaces, one graph

```
/reps          Directory   — browse all officials; the "who governs here" surface
/reps?layer=…  (filter)     — deep-link to one layer (federal/state/county/city)
/reps?category=…            — cross-cutting: officials at ANY layer who touch a function
/rep/:slug     Detail       — one official: identity, what the office does, live activity
```

The reps surfaces form a small graph, not a list:
- **Directory → Detail** (click a card).
- **Detail → Directory** (a category badge on a rep links to `/reps?category=that` — "who else touches this?").
- **Detail ↔ Bills** (a federal rep's sponsored bills link to `/bill/:slug`; a bill's sponsor links back to `/rep/:slug`). *This cross-link is the single most important design move — see §C1.*

### A2. `/reps` — the Directory

The demo's answer to "who actually governs this address?" — the awakening stat made browsable.

```
┌─────────────────────────────────────────────────────────────┐
│  Reps                                                        │  ← h1
│  Everyone who governs a Travis County address, across four   │  ← one-line purpose
│  layers of government.                                       │
├─────────────────────────────────────────────────────────────┤
│  [ 📍 Enter your address to see which are yours ]  (optional)│  ← AddressInput, collapsible
│      or try:  [Texas Capitol] [UT Austin] [South Congress]   │  ← seed chips
├─────────────────────────────────────────────────────────────┤
│  GLANCE CARD                                                 │  ← NEW suggestion §C2
│  36 officials · 4 layers · 10 government functions           │
├─────────────────────────────────────────────────────────────┤
│  Filter by function:                                        │  ← category filter row
│  [All] [Legislation] [Budget] [Public Safety] [Courts] …    │     (10 CategoryBadges, toggle)
├─────────────────────────────────────────────────────────────┤
│  FEDERAL  ·  3                                              │  ← layer section header
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ RepCard      │ │ RepCard      │ │ RepCard      │          │  ← grid, 1-3 cols responsive
│  │ Ted Cruz (R) │ │ Cornyn (R)   │ │ Doggett (D)  │          │
│  │ U.S. Senator │ │ U.S. Senator │ │ U.S. Rep TX-37│         │
│  │ [Legisl][Bud]│ │ …            │ │ [addr-scoped]│          │  ← category chips + scope tag
│  └──────────────┘ └──────────────┘ └──────────────┘          │
│                                                             │
│  STATE  ·  2 (of your districts)                            │
│  …                                                          │
│  COUNTY  ·  14      [Commissioners Court · Courts · DA]     │  ← sub-grouped when large
│  CITY  ·  12        [Mayor · Council · Municipal Court]     │
└─────────────────────────────────────────────────────────────┘
```

**Behaviors:**
- **Address-optional (the A2 audit fix).** No address → the full fixture set, grouped by layer. This is the default and it already impresses (breadth without friction).
- **Address entered → "yours" float up.** Within each layer, `addressScoped` officials that match the oriented districts render first and full-strength; the rest of the jurisdiction's officials render below at reduced emphasis (still clickable). Honest label per layer where mapping isn't wired: "County & city officials aren't address-mapped in this demo — all are shown."
- **Category filter is cross-layer.** Selecting "Transportation" collapses every layer section to just the officials whose office carries that category — a federal rep, a state rep, a county commissioner, and a council member sitting side by side. *This is the novel view — see §C3.*
- **Layer headers show the sub-bodies** (Commissioners Court · Courts · DA) so 14 county officials don't read as an undifferentiated wall.

**Reuses:** `RepCard` (after the A3 layer-badge fix), `CategoryBadge`, `AddressInput`, `useOrient`. New: `GET /api/reps` (full fixture list), `RepsDirectory` component.

### A3. `/rep/:slug` — the Detail page

The persistent official page. Four stacked zones, top to bottom: **Identity → What the office does → Live activity → Provenance.**

```
┌─────────────────────────────────────────────────────────────┐
│  ‹ Reps                                                     │  ← breadcrumb back
├─────────────────────────────────────────────────────────────┤
│  ZONE 1 — IDENTITY                                          │
│  Lloyd Doggett                                    (D)       │  ← name h1 + party badge*
│  U.S. Representative · TX-37 · Federal                      │  ← role · district · layer(neutral badge)
│  📍 One of your districts        ↗ doggett.house.gov        │  ← addr-scoped tag + source citation
│  ⚠ Structural placeholder — name not verified for this demo │  ← ONLY when verified:false
├─────────────────────────────────────────────────────────────┤
│  ZONE 2 — WHAT THIS OFFICE DOES                             │
│  Elected by the residents of Texas's 37th congressional    │  ← officeDescription
│  district (central Austin) to a two-year term. Votes on    │
│  federal legislation, sponsors bills, serves on committees.│
│                                                            │
│  Functions of this office:                                 │
│  [Legislation] [Budget & Finances] [Transportation]        │  ← CategoryBadges, each links
│                                                            │     to /reps?category=X
├─────────────────────────────────────────────────────────────┤
│  ZONE 3 — LIVE ACTIVITY   (fetched 2m ago)                 │  ← RepLiveData, tier-labeled
│                                                            │
│  ▸ Sponsored legislation · primary source · 4              │  ← live.bills (federal only)
│    H.R. 82: Social Security Fairness Act →  /bill/119-hr-82│  ← links to OUR bill page §C1
│    H.R. 1234: … →                                          │
│                                                            │
│  ▸ In the news — matched by headline · outer-ring · 3      │  ← live.news (attribution pass)
│    nytimes.com · 2h · "Doggett calls for …"  ↗             │
│    ⚠ Name-match: may include others named Doggett          │  ← honesty note (common-name)
│                                                            │
│  ▸ Office page · primary source                            │  ← live.office stub (fallback)
│    Browse activity on doggett.house.gov ↗                  │
├─────────────────────────────────────────────────────────────┤
│  ZONE 4 — PROVENANCE                                        │
│  Sources: congress.gov (bills), GDELT DOC 2.0 (news),      │  ← notes[] surfaced honestly
│  doggett.house.gov (office). congress.gov key: set.        │
│  Fetched 2026-07-19 3:41 PM.                               │
└─────────────────────────────────────────────────────────────┘
```

**Design rules pulled from the data:**
- `party` badge renders **only when present** — Austin city council is nonpartisan (no party field), so no badge; that absence is correct, not a bug.
- `verified: false` → the ⚠ placeholder banner in Zone 1 and the name renders muted. Judges reward this honesty; it's the citation thesis applied to our own data. *§C4.*
- Zone 3 is **empty-state-rich**: a county commissioner during recess surfaces no news and no bills → Zone 3 shows only the office-page stub plus a teaching empty state (§C5), never a blank.
- The `live.notes[]` are not swept under the rug — Zone 4 states "congress.gov key not set" / "GDELT throttled" plainly when they occur.

**Reuses:** `RepPage`, `RepActivityList`, `CategoryBadge`. Change: repoint `live.news` at the shared attribution pass (per IA doc §4); add `/bill/:slug` links on `live.bills`.

---

## PART B — BILLS

### B1. Bills IA

```
/bills          Index   — real Layer-1 bills, status-filtered
/bills?status=… (filter)
/bill/:slug     Detail  — one bill: identity, lifecycle, record, attributed news
```

### B2. `/bills` — the Index

Mirrors the real app's F23 browse-index, simplified.

```
┌─────────────────────────────────────────────────────────────┐
│  Bills                                                       │  ← h1
│  Real legislation from the 119th Congress, refreshed by the │
│  pulse agent.                                               │
├─────────────────────────────────────────────────────────────┤
│  Status:  [All 12] [Introduced 3] [Referred 5] [Passed 4]   │  ← Tabs, counts, zero-hidden
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │ H.R. 196  ·  119th          Referred to committee   │    │  ← designator + status badge
│  │ Family and Small Business Taxpayer Protection Act   │    │  ← title (link)
│  │ Sponsor: not yet resolved        [3 in the news]    │    │  ← honest sponsor + news chip
│  │ ingested 2m ago                              [NEW]  │    │  ← vintage + new-this-beat
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ H.Res. 4  ·  119th     Passed chamber of origin     │    │
│  │ Authorizing the Clerk to inform the President …     │    │
│  └─────────────────────────────────────────────────────┘    │
│  …                                                          │
├─────────────────────────────────────────────────────────────┤
│  12 bills · last ingested 2m ago · source: api.congress.gov │  ← vintage footer
└─────────────────────────────────────────────────────────────┘
```

- **Status Tabs** map `BILL_STATUSES` → plain labels ("Referred to committee"), counts in the tab, statuses with zero bills hidden.
- **Status badge color** reuses the category-badge color pattern (a small status→color map: introduced=ink-3, referred=accent-blue, reported=accent-yellow, passed-origin=accent-green, enacted=accent-green-bold, failed/vetoed=accent-red).
- **Sponsor line is honest**: "Sponsor: not yet resolved" for the ~29/40 that hit Bug 2, the real name (linked, §C1) when resolved. Field-status vocabulary, never blank.
- **News chip** ("3 in the news") only when the attribution pass matched headlines to this bill.

### B3. `/bill/:slug` — the Detail page

Article-shaped, mirroring the real F20 wiki page. Five zones.

```
┌─────────────────────────────────────────────────────────────┐
│  ‹ Bills                                                    │  ← breadcrumb
├─────────────────────────────────────────────────────────────┤
│  ZONE 1 — IDENTITY                                          │
│  H.R. 196 — 119th Congress                                 │  ← formal designator (small caps)
│  Family and Small Business Taxpayer Protection Act         │  ← title h1
│  Referred to committee                                     │  ← plain-language status line
├─────────────────────────────────────────────────────────────┤
│  ZONE 2 — LIFECYCLE                                          │  ← NEW suggestion §C6
│  Introduced ─●─ Referred ──○── Reported ──○── Passed ──○──  │  ← horizontal stepper,
│                 (here)                          Enacted     │     current stage filled
├─────────────────────────────────────────────────────────────┤
│  ZONE 3 — AI MARGIN NOTE                                    │
│  [AI] [aggregator] · H.R. 196 shows referred to committee; │  ← narration, labeled
│       no further action recorded.                          │
├─────────────────────────────────────────────────────────────┤
│  ZONE 4 — THE RECORD                                        │
│  Sponsor    Lloyd Doggett (D-TX-37) →  /rep/us-rep-tx-37    │  ← links to rep page §C1
│             — or —  not yet resolved                        │
│  Chamber    House                                          │
│  Introduced 2025-01-03                                     │
│  Source     ↗ congress.gov/bill/119th-congress/house-bill/196│ ← the citation (always present)
├─────────────────────────────────────────────────────────────┤
│  ZONE 5 — IN THE NEWS — matched by headline                │
│  reuters.com · 4h · "House panel takes up small-business…" ↗│  ← attributed GDELT
│    — or —                                                  │
│  No coverage matched this bill in the current window.      │  ← honest empty state
├─────────────────────────────────────────────────────────────┤
│  Last ingested 2026-07-19 3:41 PM · Polity Layer 1 pulse   │  ← vintage footer
└─────────────────────────────────────────────────────────────┘
```

- **Zone 2 lifecycle** is the standout (§C6) — turns a status enum into an at-a-glance "where is this bill in its life."
- **Zone 4 sponsor** links to the rep page when the sponsor resolves to a fixture/slug (§C1); plain text + "not yet resolved" otherwise.
- **Source is always present** (`source_url` is NOT NULL by schema) — the citation is never missing, matching Polity's fail-closed discipline.
- **Zone 5 empty state** states absence plainly. Given our 12 bills are Jan-2025 opening-days bills, most will legitimately show the empty state — that's honest, not broken.

---

## PART C — NEW SUGGESTIONS

### C1. ★ Cross-link reps ↔ bills (the civic knowledge graph)
The highest-value new move. A federal rep's `live.bills` link to our `/bill/:slug`; a bill's resolved sponsor links to `/rep/:slug`. Suddenly the demo isn't four flat lists — it's a navigable graph (rep → their bills → the bill's sponsor → their office → the functions that office touches → other officials touching that function). This *is* Polity's thesis (everything connects to a cited primary source) and it's a strong live-demo arc: "start at your address, end three clicks deep in a bill's lifecycle, every hop cited." Opportunistic: link only when bioguide→slug resolves (Doggett does; most won't) — plain text otherwise.

### C2. "Government at a glance" stat card (`/reps` top)
"**36 officials · 4 layers · 10 functions** govern this address." The awakening stat the whole orientation thesis rests on (most Americans can't name past ~5). One card, computed from the fixture count. Cheap, high-impact opening beat for judges.

### C3. ★ Category as a cross-layer lens (`/reps?category=transportation`)
No mainstream civic app does this: "show me everyone — federal to city — who touches **transportation**," and you get a US Rep (highway bill), a TX Rep (TxDOT), a county commissioner (county roads), a council member (Austin Transportation Dept) side by side. Answers the real citizen question "who do I actually call about *this*?" across the layers that usually fragment it. The taxonomy already encodes the office→category mapping; this just surfaces it as a filter.

### C4. Verified-vs-placeholder as a visible design feature
Lean into `verified: false`. A muted name + "structural placeholder — not verified for this demo" banner. Counterintuitively strong for judging: it demonstrates the citation discipline applied to our *own* gaps. "We show you the office exists and what it does; we don't fabricate the name we couldn't confirm." That honesty is the brand.

### C5. Teaching empty states (turn silence into orientation)
When a county/city official surfaces no live activity, don't blank — explain: "County commissioners meet in Commissioners Court; activity surfaces around session dates. Meanwhile, here's what this office controls." Absence becomes an orientation moment instead of a dead end — and it's honest about why local officials are quieter than federal ones in a live feed.

### C6. Bill lifecycle stepper
A horizontal progress stepper (Introduced → Referred → Reported → Passed origin → Passed both → Enacted) with the current `status` filled. Instantly legible "where is this," far better than a bare status word. Maps the `BILL_STATUSES` enum onto a canonical path (branch statuses like failed/vetoed render as a terminal red node).

### C7. (Optional, small) "Following the money is next" honest forward-pointer
On a rep page, a muted line: "Campaign finance and voting record: not in this demo." Sets the roadmap without faking data — signals the real product's ambition to judges without scope creep. Only if time; pure copy.

---

## Build deltas vs. the IA doc §8
These designs don't change the phase order; they specify what Phases I–II render. Additions to note:
- Phase I gains the **glance stat card** (C2) and **cross-layer category filter** (C3) — both are directory-level, cheap, and high-impact; do them with `/reps`.
- Phase II gains the **lifecycle stepper** (C6) on `/bill/:slug` and the **rep↔bill cross-links** (C1) — C1 spans both parts (rep page needs `/bill` links, bill page needs `/rep` links), wire it once both page types exist.
- C4/C5 are rendering rules on existing components, ~15 min each.
