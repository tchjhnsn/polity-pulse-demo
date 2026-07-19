# Pulse Demo — Category Taxonomy Proposal

**Status:** proposal, awaiting Torian review. 2026-07-19. ai-model: glm-5.2.

## Purpose

The persistent rep pages need a way to organize officials by what their office actually does. A senator does lawmaking + federal oversight; a county commissioner does land-use + county-budget; a city council member does zoning + city-services. Surfacing "your reps, organized by what they touch" is the orientation layer's missing piece.

The taxonomy below is for **hackathon-demo scope**. It is not the canonical `polity-app` category system (that doesn't exist yet — `VERSION_SPEC_v1.md` is federal-read-only and doesn't introduce a category axis). If this demo ever becomes a real product surface, the taxonomy gets spec-anchored elsewhere.

## The proposal — 10 categories

| Category | Color (Polity token) | What it covers | Office examples |
|---|---|---|---|
| `legislation` | accent-blue (federal/info) | Drafting and voting on bills, statutes, ordinances | US Senator, US Rep, TX Senator, TX Rep, Mayor (signs ordinances) |
| `budget-finances` | accent-yellow (highlight) | Taxing, spending, appropriations, fiscal policy, audits | US Senator, US Rep, TX Senator, TX Rep, County Judge, County Commissioner, City Council, Mayor |
| `law-enforcement-public-safety` | accent-red (editorial/sienna) | Police, sheriff, courts, prosecution, public defense, emergency management, criminal justice | County Judge (emergency authority), County Commissioner (sheriff budget), Mayor (police oversight), City Council (APD budget) |
| `judiciary-courts` | ink-2 (neutral) | Judges, district attorneys, court administration, judicial appointments | (Out of demo scope — no judicial officials in our fixture set. Taxonomy slot exists for V1.5+.) |
| `transportation` | ink-2 | Roads, transit, highways, airports, sidewalks, bike infrastructure | US Rep (federal highway bill), TX Senator/Rep (TxDOT), County Commissioner (county roads), City Council (Austin Transportation Dept), Mayor |
| `education` | ink-2 | Public schools, higher ed, curriculum, school boards, education funding | TX Senator/Rep (state ed policy), Mayor (nominates school board in some cities), County Judge (no direct role in TX) |
| `health-human-services` | accent-green (olive/affirmative) | Public health, hospitals, mental health, social services, Medicaid, SNAP administration | US Senator/Rep (federal entitlements), TX Senator/Rep (state health agency), County Judge (public health authority), City Council (public health) |
| `land-use-housing` | accent-yellow | Zoning, development, permits, housing policy, annexation, code enforcement | County Commissioner (subdivision platting), City Council (zoning, the dominant actor), Mayor (zoning veto in some cities) |
| `utilities-infrastructure` | ink-2 | Water, sewer, electric, gas, broadband, solid waste | County Commissioner (rural utility districts), City Council (Austin Energy, Austin Water), Mayor |
| `elections-governance` | accent-blue | Voter registration, election administration, redistricting, ethics, campaign finance disclosure, government structure itself | US Senator (advisory on federal election law), TX Senator/Rep (state election law), County Judge (county election commission), City Council (municipal charter amendments) |

## Why these 10

- Each is a recognizable *function* of American local government, not a topic (so "transportation" not "roads"; "land-use-housing" not "zoning").
- Each maps to a real power or budget that one of the demo's offices actually holds — no aspirational categories.
- The set is small enough to fit in a sidebar filter, large enough to differentiate offices meaningfully (a county commissioner and a city council member don't collapse into the same bucket).

## What's deliberately NOT a category

- **Partisan politics** — Polity's brand explicitly avoids organizing by party (party badges exist but are decorative, not organizational). Categories are functional.
- **"Hot topics"** (abortion, guns, immigration) — these are policy issues, not government functions. They cut *across* the categories above. A future "issues" layer would be separate.
- **Committee assignments** — too volatile for a demo; the existing pulse feed surfaces this implicitly through bill activity.

## Office → category assignment (proposed)

Each office gets 1–3 categories. The rule: a category appears only if the office has *real authority* over it (not advisory).

| Official (demo scope) | Categories |
|---|---|
| US Senator (Cruz, Cornyn) | legislation, budget-finances, elections-governance |
| US Representative (Doggett) | legislation, budget-finances, transportation |
| TX State Senator (Eckhardt) | legislation, budget-finances, transportation, education |
| TX State Representative (Flores/Hinojosa) | legislation, budget-finances, education, health-human-services |
| Travis County Judge (Andy Brown) | budget-finances, law-enforcement-public-safety, health-human-services, elections-governance |
| Travis County Commissioner, Pct 1–4 | budget-finances, law-enforcement-public-safety, land-use-housing, transportation |
| Mayor of Austin (Kirk Watson) | legislation, budget-finances, law-enforcement-public-safety, land-use-housing |
| Austin City Council, D1–D10 | budget-finances, land-use-housing, transportation, utilities-infrastructure |

## How categories surface in the UI

Two ways, both on the rep page:

1. **On each rep page**, the categories the office belongs to render as Badge chips under the role title. Clicking a category filters the "About this office" section to show only the responsibilities matching that category.
2. **On the orientation view**, a category filter row across the top lets the citizen say "show me my reps who touch [transportation]" and the rep cards re-filter. This is the "organize by category" axis the user asked for.

## Open questions for your review

**Resolved 2026-07-19 by Torian:**

1. **Category count per office** — no arbitrary cap. Assign as many categories as are related to the functions of the office.
2. **County Judge → `judiciary-courts`** — the county judge presides over the constitutional county court; the role is judicial, not law-enforcement. Reclassified.
3. **`judiciary-courts` is in the taxonomy.** We need to find and add judicial officials for Travis County / Austin — district judges, county court at law judges, justices of the peace, municipal judge, district attorney, county attorney.
4. **Categories get their own colors** — a `CategoryBadge` variant per category, separate from the layer-badge color axis.

## Revised office → category assignment (post-review)

| Official (demo scope) | Categories |
|---|---|
| US Senator (Cruz, Cornyn) | legislation, budget-finances, elections-governance, judiciary-courts (judicial confirmations) |
| US Representative (Doggett) | legislation, budget-finances, transportation, judiciary-courts (federal court funding) |
| TX State Senator (Eckhardt) | legislation, budget-finances, transportation, education, judiciary-courts (state court structure) |
| TX State Representative (Flores/Hinojosa) | legislation, budget-finances, education, health-human-services, judiciary-courts (state court funding) |
| Travis County Judge (Andy Brown) | judiciary-courts, budget-finances, health-human-services, elections-governance |
| Travis County Commissioner, Pct 1–4 | budget-finances, law-enforcement-public-safety, land-use-housing, transportation |
| Travis County District Attorney (José Garza) | law-enforcement-public-safety, judiciary-courts |
| Travis County Attorney | law-enforcement-public-safety, judiciary-courts |
| Travis County District Court Judges | judiciary-courts |
| Travis County Court at Law Judges | judiciary-courts, law-enforcement-public-safety (misdemeanor docket) |
| Travis County Justices of the Peace | judiciary-courts, law-enforcement-public-safety (Class C misdemeanors) |
| Austin Municipal Judge | judiciary-courts, law-enforcement-public-safety (city ordinance violations) |
| Mayor of Austin (Kirk Watson) | legislation, budget-finances, law-enforcement-public-safety, land-use-housing |
| Austin City Council, D1–D10 | budget-finances, land-use-housing, transportation, utilities-infrastructure |

## Category color assignments (own colors, separate from layer badges)

| Category | Polity token | Hex | Notes |
|---|---|---|---|
| legislation | accent-blue | #1A3A5E | federal / informational — the default "what you think of as politics" |
| budget-finances | accent-yellow | #E8C547 | highlight — money is always visible |
| law-enforcement-public-safety | accent-red | #7A3225 | editorial / sienna — public safety is contested ground |
| judiciary-courts | ink-2 | #4A3F33 | neutral / sober — courts should read as institutional, not partisan |
| transportation | a new teal | #2A6B6B | transit is its own axis; teal distinguishes from blue |
| education | a new warm-brown | #8B5E3C | education reads as foundational / grounding |
| health-human-services | accent-green | #4A7A3F | affirmative / olive — health is the affirmative state function |
| land-use-housing | a new ochre | #B8892B | the "built environment" color, earthy |
| utilities-infrastructure | a new slate | #5A6B7A | infrastructure reads as structural / gray-toned |
| elections-governance | a new deep-purple | #5E3A6E | governance reads as constitutional / elevated |