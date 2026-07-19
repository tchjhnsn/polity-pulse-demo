/**
 * Austin-area state, county, and city officials — HACKATHON-ONLY fixtures.
 *
 * The federal layer (US senators + House reps) is queried live from the
 * @polity/db Neon Postgres at runtime — that data is verified against the
 * congress.gov ingest. State, county, and city officials are NOT in the
 * canonical DB at any level (per the 2026-07-19 probe), so for the demo
 * we hardcode them here from public record.
 *
 * This is DATA, not code — it's not subject to the hackathon's >1-week
 * code-age rule. The names, parties, and district numbers below are
 * public record from the Texas Secretary of State, Travis County Clerk,
 * and Austin City Clerk as of July 2026.
 *
 * Coverage scope: the Austin metro area (Travis County). For a Travis
 * County address, the orientation surface shows:
 *   - 2 US senators (state-wide, federal)
 *   - 1 US representative (address-specific congressional district)
 *   - 1 TX state senator (address-specific state senate district)
 *   - 1 TX state representative (address-specific state house district)
 *   - 5 Travis County Commissioners Court members (county-wide judge + 4
 *     precinct commissioners; precinct mapping is not address-resolved
 *     in this demo — would need the county precinct shapefile).
 *   - Austin Mayor (at-large) + a note on city council district mapping.
 *
 * Source URLs are kept on each entry so the citation-discipline narration
 * can cite the primary source (the official's government page) rather than
 * a Parity-voice assertion.
 */

export type GovernmentLayer = "federal" | "state" | "county" | "city";

export type Chamber = "senate" | "house" | "executive" | "legislative-body" | "judicial";

export interface Official {
  layer: GovernmentLayer;
  role: string;            // "U.S. Senator", "State Representative", etc.
  name: string;
  party?: string;          // null for non-partisan offices (city council in Austin)
  district?: string;       // "TX-37", "TX Senate 14", "Travis County Pct 2"
  bioguideId?: string;     // federal only — Congress bioguide
  sourceUrl: string;       // official government page (citation primary source)
  /** When true, this official is address-specific (one of the address's
   * districts); when false, represents the whole jurisdiction (senators,
   * county judge, mayor). */
  addressScoped?: boolean;
  /** Stable slug used as the persistent-page URL fragment
   * (e.g. "us-senator-texas-class-1"). If absent, derived from role+district. */
  slug?: string;
  /** When true, the official's name is verified from public record. When
   * false, the row is a structural placeholder ("Current judge: not verified
   * for demo") — honest about what we couldn't verify in the hackathon
   * window. See pulse-demo-category-taxonomy-2026-07-19.md. */
  verified?: boolean;
  /** Optional short blurb describing the office's actual authority. Rendered
   * on the persistent rep page's "About this office" section. */
  officeDescription?: string;
}

// --- Federal officials (pinned demo user — Texas Capitol address) ----------
// The orient endpoint resolves federal officials live from Geocodio's
// current_legislators field, but the persistent rep page (/api/rep/:slug)
// needs to resolve federal slugs too — without making the visitor re-orient.
// These fixtures cover the Texas Capitol address's federal reps (the
// pinned demo user) so the rep page works as a stable URL. The orient
// endpoint's live data still overrides these when the visitor orients a
// different Austin address (the federal rep changes by congressional
// district; senators stay the same).

export const FEDERAL_FIXTURES: Official[] = [
  {
    layer: "federal",
    role: "U.S. Senator",
    name: "Ted Cruz",
    party: "Republican Party",
    district: "Texas (state-wide)",
    bioguideId: "C001098",
    sourceUrl: "https://www.cruz.senate.gov",
    addressScoped: false,
    verified: true,
    slug: "us-senator-texas-state-wide-cruz",
    officeDescription:
      "Elected state-wide to a six-year term. Class 1 (next election 2030). Votes on federal legislation, advises and consents on judicial and executive appointments, ratifies treaties.",
  },
  {
    layer: "federal",
    role: "U.S. Senator",
    name: "John Cornyn",
    party: "Republican Party",
    district: "Texas (state-wide)",
    bioguideId: "C001056",
    sourceUrl: "https://www.cornyn.senate.gov",
    addressScoped: false,
    verified: true,
    slug: "us-senator-texas-state-wide-cornyn",
    officeDescription:
      "Elected state-wide to a six-year term. Class 2 (next election 2026). Votes on federal legislation, advises and consents on judicial and executive appointments, ratifies treaties.",
  },
  {
    layer: "federal",
    role: "U.S. Representative",
    name: "Lloyd Doggett",
    party: "Democratic Party",
    district: "TX-37",
    bioguideId: "D000399",
    sourceUrl: "https://doggett.house.gov",
    addressScoped: true,
    verified: true,
    slug: "us-representative-tx-37",
    officeDescription:
      "Elected by the residents of Texas's 37th congressional district (central Austin) to a two-year term. Votes on federal legislation, sponsors bills, serves on House committees.",
  },
];

// --- Travis County Commissioners Court ---------------------------------------
// Source: https://www.traviscountytx.gov/commissioners-court
// 5 members: county judge (county-wide, presiding) + 4 precinct commissioners.

export const TRAVIS_COUNTY_COMMISSIONERS_COURT: Official[] = [
  {
    layer: "county",
    role: "Travis County Judge",
    name: "Andy Brown",
    district: "Travis County (county-wide)",
    sourceUrl: "https://www.traviscountytx.gov/commissioners-court/county-judge",
  },
  {
    layer: "county",
    role: "Commissioner, Precinct 1",
    name: "Jeffrey Travillion, Sr.",
    district: "Travis County Pct 1",
    sourceUrl: "https://www.traviscountytx.gov/commissioners-court/precinct-1",
    addressScoped: false, // demo: precinct mapping needs county shapefile
  },
  {
    layer: "county",
    role: "Commissioner, Precinct 2",
    name: "Brigid Shea",
    district: "Travis County Pct 2",
    sourceUrl: "https://www.traviscountytx.gov/commissioners-court/precinct-2",
    addressScoped: false,
  },
  {
    layer: "county",
    role: "Commissioner, Precinct 3",
    name: "Ann Howard",
    district: "Travis County Pct 3",
    sourceUrl: "https://www.traviscountytx.gov/commissioners-court/precinct-3",
    addressScoped: false,
  },
  {
    layer: "county",
    role: "Commissioner, Precinct 4",
    name: "Margaret Gómez",
    district: "Travis County Pct 4",
    sourceUrl: "https://www.traviscountytx.gov/commissioners-court/precinct-4",
    addressScoped: false,
  },
];

// --- Austin City Council ----------------------------------------------------
// Source: https://www.austintexas.gov/government/city-council
// Mayor (at-large, 10th member) + 10 district members. Austin council is
// non-partisan per city charter; no party field.

export const AUSTIN_CITY_COUNCIL: Official[] = [
  {
    layer: "city",
    role: "Mayor of Austin",
    name: "Kirk Watson",
    district: "Austin (city-wide)",
    sourceUrl: "https://www.austintexas.gov/department/mayor",
  },
  {
    layer: "city",
    role: "Council Member, District 1",
    name: "Natasha Harper-Madison",
    district: "Austin City Council D1",
    sourceUrl: "https://www.austintexas.gov/government/city-council/district-1",
    addressScoped: false,
  },
  {
    layer: "city",
    role: "Council Member, District 2",
    name: "Vanessa Fuentes",
    district: "Austin City Council D2",
    sourceUrl: "https://www.austintexas.gov/government/city-council/district-2",
    addressScoped: false,
  },
  {
    layer: "city",
    role: "Council Member, District 3",
    name: "José Velásquez",
    district: "Austin City Council D3",
    sourceUrl: "https://www.austintexas.gov/government/city-council/district-3",
    addressScoped: false,
  },
  {
    layer: "city",
    role: "Council Member, District 4",
    name: "Chito Vela",
    district: "Austin City Council D4",
    sourceUrl: "https://www.austintexas.gov/government/city-council/district-4",
    addressScoped: false,
  },
  {
    layer: "city",
    role: "Council Member, District 5",
    name: "Ryan Alter",
    district: "Austin City Council D5",
    sourceUrl: "https://www.austintexas.gov/government/city-council/district-5",
    addressScoped: false,
  },
  {
    layer: "city",
    role: "Council Member, District 6",
    name: "Mackenzie Kelly",
    district: "Austin City Council D6",
    sourceUrl: "https://www.austintexas.gov/government/city-council/district-6",
    addressScoped: false,
  },
  {
    layer: "city",
    role: "Council Member, District 7",
    name: "Leslie Pool",
    district: "Austin City Council D7",
    sourceUrl: "https://www.austintexas.gov/government/city-council/district-7",
    addressScoped: false,
  },
  {
    layer: "city",
    role: "Council Member, District 8",
    name: "Paige Ellis",
    district: "Austin City Council D8",
    sourceUrl: "https://www.austintexas.gov/government/city-council/district-8",
    addressScoped: false,
  },
  {
    layer: "city",
    role: "Council Member, District 9",
    name: "Zo Qadri",
    district: "Austin City Council D9",
    sourceUrl: "https://www.austintexas.gov/government/city-council/district-9",
    addressScoped: false,
  },
  {
    layer: "city",
    role: "Council Member, District 10",
    name: "Alison Alter",
    district: "Austin City Council D10",
    sourceUrl: "https://www.austintexas.gov/government/city-council/district-10",
    addressScoped: false,
  },
];

// --- Texas State Legislature (Travis County / Austin metro delegation) -----
// Source: https://capitol.texas.gov / https://senate.texas.gov /
//         https://house.texas.gov
// The Geocodio response gives us the address's state senate + state house
// district numbers; we look up the official by (chamber, districtNumber)
// in the fixtures below. Coverage: the Austin metro state-legislative
// delegation (districts that overlap Travis County).

export const TX_STATE_SENATE_AUSTIN: Record<string, Official> = {
  // Travis County spans SD 14 (most of Austin) + parts of SD 18, SD 21,
  // SD 24, SD 25 at the edges. SD 14 is the dominant one.
  "14": {
    layer: "state",
    role: "Texas State Senator",
    name: "Sarah Eckhardt",
    party: "Democratic Party",
    district: "TX Senate District 14",
    sourceUrl: "https://senate.texas.gov/member.php?d=14",
    addressScoped: true,
  },
  "18": {
    layer: "state",
    role: "Texas State Senator",
    name: "Lois Kolkhorst",
    party: "Republican Party",
    district: "TX Senate District 18",
    sourceUrl: "https://senate.texas.gov/member.php?d=18",
    addressScoped: true,
  },
  "21": {
    layer: "state",
    role: "Texas State Senator",
    name: "Judith Zaffirini",
    party: "Democratic Party",
    district: "TX Senate District 21",
    sourceUrl: "https://senate.texas.gov/member.php?d=21",
    addressScoped: true,
  },
  "24": {
    layer: "state",
    role: "Texas State Senator",
    name: "Dawn Buckingham",
    party: "Republican Party",
    district: "TX Senate District 24",
    sourceUrl: "https://senate.texas.gov/member.php?d=24",
    addressScoped: true,
  },
  "25": {
    layer: "state",
    role: "Texas State Senator",
    name: "Donna Campbell",
    party: "Republican Party",
    district: "TX Senate District 25",
    sourceUrl: "https://senate.texas.gov/member.php?d=25",
    addressScoped: true,
  },
};

export const TX_STATE_HOUSE_AUSTIN: Record<string, Official> = {
  // Travis County spans HDs 45–51 (roughly). 47 and 51 are the most central.
  "45": {
    layer: "state",
    role: "Texas State Representative",
    name: "Erin Zwiener",
    party: "Democratic Party",
    district: "TX House District 45",
    sourceUrl: "https://house.texas.gov/members/member-page/?district=45",
    addressScoped: true,
  },
  "46": {
    layer: "state",
    role: "Texas State Representative",
    name: "Sheryl Cole",
    party: "Democratic Party",
    district: "TX House District 46",
    sourceUrl: "https://house.texas.gov/members/member-page/?district=46",
    addressScoped: true,
  },
  "47": {
    layer: "state",
    role: "Texas State Representative",
    name: "Vikki Goodwin",
    party: "Democratic Party",
    district: "TX House District 47",
    sourceUrl: "https://house.texas.gov/members/member-page/?district=47",
    addressScoped: true,
  },
  "48": {
    layer: "state",
    role: "Texas State Representative",
    name: "Donna Howard",
    party: "Democratic Party",
    district: "TX House District 48",
    sourceUrl: "https://house.texas.gov/members/member-page/?district=48",
    addressScoped: true,
  },
  "49": {
    layer: "state",
    role: "Texas State Representative",
    name: "Gina Hinojosa",
    party: "Democratic Party",
    district: "TX House District 49",
    sourceUrl: "https://house.texas.gov/members/member-page/?district=49",
    addressScoped: true,
  },
  "50": {
    layer: "state",
    role: "Texas State Representative",
    name: "Celia Israel",
    party: "Democratic Party",
    district: "TX House District 50",
    sourceUrl: "https://house.texas.gov/members/member-page/?district=50",
    addressScoped: true,
  },
  "51": {
    layer: "state",
    role: "Texas State Representative",
    name: "Lulu Flores",
    party: "Democratic Party",
    district: "TX House District 51",
    sourceUrl: "https://house.texas.gov/members/member-page/?district=51",
    addressScoped: true,
  },
};

/** Get a TX state senator by district number string. */
export function txStateSenator(districtNumber: string | number): Official | null {
  return TX_STATE_SENATE_AUSTIN[String(districtNumber)] ?? null;
}

/** Get a TX state representative by district number string. */
export function txStateRep(districtNumber: string | number): Official | null {
  return TX_STATE_HOUSE_AUSTIN[String(districtNumber)] ?? null;
}

/** All Travis County Commissioners Court members (county judge + 4 precinct
 * commissioners). For a Travis County address, the orientation surface
 * shows all 5 because precinct→address mapping needs the county precinct
 * shapefile, which we don't wire for the demo. */
export function travisCountyCourt(): Official[] {
  return TRAVIS_COUNTY_COMMISSIONERS_COURT;
}

/** All Austin City Council members (mayor + 10 district members). Same
 * caveat as the county — the demo shows the mayor and labels the district
 * members as "address → district mapping not wired for the demo." */
export function austinCityCouncil(): Official[] {
  return AUSTIN_CITY_COUNCIL;
}

// --- Travis County judicial officials ---------------------------------------
// Source: https://www.traviscountytx.gov/courts + https://www.traviscountytx.gov/da
// Per Torian's 2026-07-19 review: judiciary-courts is in the taxonomy, and
// the county judge is classified here (not under law-enforcement). Two
// officials verified from public record (DA José Garza, County Attorney
// Delia Garza); the rest are structural placeholders with
// `verified: false` — honest about what we couldn't confirm in the
// hackathon window.

export const TRAVIS_COUNTY_JUDICIAL: Official[] = [
  {
    layer: "county",
    role: "Travis County District Attorney",
    name: "José Garza",
    district: "Travis County (county-wide)",
    sourceUrl: "https://www.traviscountytx.gov/da",
    addressScoped: false,
    verified: true,
    slug: "travis-county-da",
    officeDescription:
      "Elected county-wide. Prosecutes felonies and misdemeanors in the district courts; oversees civil forfeiture and victim services.",
  },
  {
    layer: "county",
    role: "Travis County Attorney",
    name: "Delia Garza",
    district: "Travis County (county-wide)",
    sourceUrl: "https://www.traviscountytx.gov/cao",
    addressScoped: false,
    verified: true,
    slug: "travis-county-attorney",
    officeDescription:
      "Elected county-wide. Prosecutes misdemeanors in the county courts at law; advises Commissioners Court on legal matters.",
  },
  // The 7 Travis County Courts at Law hear misdemeanor criminal cases,
  // civil cases up to $250k, family law, and juvenile matters. Per the
  // taxonomy doc, court-at-law judges sit in both judiciary-courts and
  // law-enforcement-public-safety because of the misdemeanor docket.
  // Names not verified for the demo — each row is a structural placeholder.
  ...range(1, 7).map((n) => ({
    layer: "county" as const,
    role: `Travis County Court at Law Judge, Court ${n}`,
    name: "Current judge: not verified for demo",
    district: `Travis County Court at Law ${n}`,
    sourceUrl: `https://www.traviscountytx.gov/courts`,
    addressScoped: false,
    verified: false,
    slug: `travis-county-court-at-law-${n}`,
    officeDescription:
      "County court at law judges hear misdemeanor criminal cases, civil matters up to $250,000, family law, and juvenile cases.",
  })),
  // The 5 Travis County Justice of the Peace precincts handle Class C
  // misdemeanors, small claims (up to $20k), evictions, and magistrate
  // duties (including mental health holds and marriages).
  ...range(1, 5).map((n) => ({
    layer: "county" as const,
    role: `Travis County Justice of the Peace, Precinct ${n}`,
    name: "Current JP: not verified for demo",
    district: `Travis County JP Pct ${n}`,
    sourceUrl: `https://www.traviscountytx.gov/courts/justices-of-the-peace`,
    addressScoped: false,
    verified: false,
    slug: `travis-county-jp-${n}`,
    officeDescription:
      "Justice of the Peace: Class C misdemeanors, small claims up to $20,000, evictions, magistrate duties including mental health holds and marriages.",
  })),
];

// --- Austin Municipal Court -------------------------------------------------
// Source: https://www.austintexas.gov/department/municipal-court
// The presiding municipal judge is appointed by the city council; specific
// current name not verified for the demo.

export const AUSTIN_MUNICIPAL: Official[] = [
  {
    layer: "city",
    role: "Austin Municipal Judge (Presiding)",
    name: "Current judge: not verified for demo",
    district: "Austin (city-wide)",
    sourceUrl: "https://www.austintexas.gov/department/municipal-court",
    addressScoped: false,
    verified: false,
    slug: "austin-municipal-judge",
    officeDescription:
      "Municipal judges hear city ordinance violations, Class C misdemeanors under city code, and traffic cases. Appointed by the city council.",
  },
];

/** All Travis County judicial officials. Per the taxonomy review, these
 * sit in the judiciary-courts category (and several also in
 * law-enforcement-public-safety due to the misdemeanor docket). */
export function travisCountyJudicial(): Official[] {
  return TRAVIS_COUNTY_JUDICIAL;
}

/** Austin municipal judicial officials. */
export function austinMunicipal(): Official[] {
  return AUSTIN_MUNICIPAL;
}

/** Build an inclusive list of all officials the demo user is oriented to —
 * federal (pinned fixtures; Geocodio populates these at orient time too) +
 * state + county (commissioners court + judicial) + city (council +
 * municipal). Used by /api/rep/:slug to look up an official by slug. */
export function allFixtureOfficials(): Official[] {
  return [
    ...FEDERAL_FIXTURES,
    ...Object.values(TX_STATE_SENATE_AUSTIN),
    ...Object.values(TX_STATE_HOUSE_AUSTIN),
    ...TRAVIS_COUNTY_COMMISSIONERS_COURT,
    ...TRAVIS_COUNTY_JUDICIAL,
    ...AUSTIN_CITY_COUNCIL,
    ...AUSTIN_MUNICIPAL,
  ];
}

/** Derive a stable URL slug for an official. If the fixture specifies a
 * `slug`, use it; otherwise derive from role + district. The slug is the
 * path fragment in the SPA's hash route — #/rep/<slug>. Normalizes "U.S."
 * → "us" so federal officials get `us-senator-…` / `us-representative-…`
 * regardless of how the role string was capitalized. */
export function slugForOfficial(o: Official): string {
  if (o.slug) return o.slug;
  const normalizedRole = o.role
    .replace(/U\.S\./g, "Us")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const d = (o.district ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return d ? `${normalizedRole}-${d}` : normalizedRole;
}

/** Find a fixture official by slug. Returns null if no match. */
export function findFixtureBySlug(slug: string): Official | null {
  return allFixtureOfficials().find((o) => slugForOfficial(o) === slug) ?? null;
}

// --- Helpers ----------------------------------------------------------------

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}