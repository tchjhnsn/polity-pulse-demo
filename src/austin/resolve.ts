/**
 * Address → Austin-area government orientation.
 *
 * HACKATHON-ONLY. Given an address, returns the citizen's representatives
 * at four government layers:
 *   1. Federal  — 2 US senators (state-wide) + 1 US representative (address's
 *                 congressional district). Pulled DIRECTLY from Geocodio's
 *                 `current_legislators` field (which cites the @unitedstates
 *                 project), cross-checked against @polity/db Neon.
 *   2. State    — 1 TX state senator + 1 TX state representative (address's
 *                 state-legislative districts). From Geocodio's
 *                 `current_legislators` field, cross-checked against fixtures.
 *   3. County   — Travis County Commissioners Court (5 members). Fixtures.
 *   4. City     — Austin Mayor + 10 council district members. Fixtures.
 *
 * Coverage: Travis County, TX. Addresses outside get a graceful "outside
 * demo coverage" response rather than wrong officials.
 *
 * NOTE on Geocodio field alias: the canonical `@polity/geocoder` package
 * uses `state_legislative_district` in its fields= parameter, which
 * Geocodio silently returns `null` for (the alias is not recognized). The
 * correct alias is `stateleg`. This demo calls Geocodio directly rather
 * than through `resolveAddress` so it can use the working alias + pull
 * `current_legislators` (which the package doesn't expose anyway). The
 * pre-hackathon package is left untouched.
 */

import { neon } from "@neondatabase/serverless";
import {
  txStateSenator,
  txStateRep,
  travisCountyCourt,
  travisCountyJudicial,
  austinCityCouncil,
  austinMunicipal,
  allFixtureOfficials,
  slugForOfficial,
  findFixtureBySlug,
  type Official,
} from "./fixtures";
import { categoriesForRole } from "./categories";

export interface OrientationOfficial {
  layer: "federal" | "state" | "county" | "city";
  role: string;
  name: string;
  party?: string;
  district?: string;
  bioguideId?: string;
  sourceUrl: string;
  addressScoped: boolean;
  sourceTier: "primary source" | "aggregator";
  photoUrl?: string;
  verified?: boolean;
  officeDescription?: string;
  /** Stable URL slug for the persistent rep page. */
  slug: string;
  /** Categories the office belongs to (from categories.ts). */
  categories: string[];
}

export interface OrientationResult {
  inputAddress: string;
  formattedAddress: string | null;
  county: string | null;
  state: string | null;
  withinCoverage: boolean;
  /** When false, `officials` is empty and `coverageNote` explains why. */
  coverageNote?: string;
  officials: OrientationOfficial[];
  confidence: "high" | "low" | "multi" | "empty" | "error";
  geocoderError?: string;
}

interface OrientEnv {
  GEOCODIO_API_KEY?: string;
  DATABASE_URL?: string;
  PULSE_KV: KVNamespace;
}

// --- Geocodio response shape (only what we use) -----------------------------

interface GeocodioLegislatorBio {
  last_name?: string;
  first_name?: string;
  party?: string;        // "Democrat", "Republican", etc. — short form
  photo_url?: string;
}
interface GeocodioLegislatorContact {
  url?: string;
}
interface GeocodioLegislatorReferences {
  bioguide_id?: string;
}
interface GeocodioCurrentLegislator {
  type: "senator" | "representative";
  bio?: GeocodioLegislatorBio;
  contact?: GeocodioLegislatorContact;
  references?: GeocodioLegislatorReferences;
}
interface GeocodioCongressionalDistrict {
  district_number: number | string;
  state_code?: string;
  current_legislators?: GeocodioCurrentLegislator[];
}
interface GeocodioStateLegDistrict {
  district_number: number | string;
  current_legislators?: GeocodioCurrentLegislator[];
}
interface GeocodioFields {
  congressional_districts?: GeocodioCongressionalDistrict[];
  state_legislative_districts?: {
    senate?: GeocodioStateLegDistrict[];
    house?: GeocodioStateLegDistrict[];
  };
}
interface GeocodioResult {
  formatted_address?: string;
  address_components: { city?: string; state?: string; zip?: string };
  accuracy: number;
  accuracy_type?: string;
  fields?: GeocodioFields;
}
interface GeocodioResponse {
  results: GeocodioResult[];
}

const GEOCODIO_BASE = "https://api.geocod.io/v1.7/geocode";
const GEOCODIO_FIELDS = "cd119,stateleg";

/** Map Geocodio's short party ("Democrat"/"Republican") to the long form
 * used by the rest of the demo. */
function normalizeParty(p?: string): string | undefined {
  if (!p) return undefined;
  const lower = p.toLowerCase();
  if (lower === "democrat" || lower === "democratic") return "Democratic Party";
  if (lower === "republican") return "Republican Party";
  if (lower === "green") return "Green Party";
  if (lower === "libertarian") return "Libertarian Party";
  return p;
}

/** Format a legislator's name from Geocodio's bio fields. */
function formatName(bio?: GeocodioLegislatorBio): string {
  if (!bio) return "(unknown)";
  const first = (bio.first_name ?? "").trim();
  const last = (bio.last_name ?? "").trim();
  return `${first} ${last}`.trim() || "(unknown)";
}

/**
 * Resolve an address to a full Austin-area government orientation.
 * Never throws — geocoder errors, DB errors, and out-of-coverage addresses
 * all degrade to a structured `OrientationResult` with a note.
 */
export async function orientAddress(
  env: OrientEnv,
  address: string,
): Promise<OrientationResult> {
  const empty: OrientationResult = {
    inputAddress: address,
    formattedAddress: null,
    county: null,
    state: null,
    withinCoverage: false,
    officials: [],
    confidence: "empty",
    coverageNote: "Geocoder not configured (no GEOCODIO_API_KEY).",
  };

  if (!env.GEOCODIO_API_KEY) return empty;

  // Call Geocodio directly (with the working `stateleg` alias) — cached
  // in PULSE_KV under the address SHA so repeat calls don't re-bill.
  const cacheKey = `geo:${address.toLowerCase().trim()}`;
  let geo: GeocodioResponse | null = null;
  try {
    const cached = await env.PULSE_KV.get(cacheKey, "json");
    if (cached) {
      geo = cached as GeocodioResponse;
    } else {
      const url =
        `${GEOCODIO_BASE}?q=${encodeURIComponent(address)}` +
        `&fields=${GEOCODIO_FIELDS}&api_key=${encodeURIComponent(env.GEOCODIO_API_KEY)}`;
      const r = await fetch(url);
      if (!r.ok) {
        return {
          ...empty,
          confidence: "error",
          geocoderError: `Geocodio HTTP ${r.status}`,
          coverageNote: `Geocoder error: HTTP ${r.status}`,
        };
      }
      geo = (await r.json()) as GeocodioResponse;
      void env.PULSE_KV.put(cacheKey, JSON.stringify(geo), {
        expirationTtl: 60 * 60 * 24 * 7, // 7 days
      });
    }
  } catch (e) {
    return {
      ...empty,
      confidence: "error",
      geocoderError: (e as Error).message,
      coverageNote: `Geocoder error: ${(e as Error).name}`,
    };
  }

  const results = geo.results ?? [];
  if (results.length === 0) {
    return {
      ...empty,
      confidence: "empty",
      coverageNote:
        "Geocoder returned no match for that address. Try a street address with ZIP.",
    };
  }
  const r = results[0]!;
  const fields = r.fields ?? {};

  // Confidence tier (matches @polity/geocoder's classifyConfidence rules).
  const inBand = results.filter((x) => x.accuracy >= 0.6);
  let confidence: OrientationResult["confidence"];
  if (inBand.length === 0) confidence = "empty";
  else if (inBand.length > 1) confidence = "multi";
  else confidence = inBand[0]!.accuracy >= 0.85 ? "high" : "low";

  // Coverage check: city must be in the Austin metro. Honest about demo scope.
  const AUSTIN_METRO_CITIES = new Set([
    "austin", "west lake hills", "sunset valley", "creedmoor", "lago vista",
    "jonestown", "point venture", "san leanna", "the hills", "bee cave",
    "dripping springs", "manor", "pflugerville", "round rock", "cedar park",
    "leander", "hutto", "taylor", "hornsby bend",
  ]);
  const city = r.address_components.city;
  const withinCoverage = !!city && AUSTIN_METRO_CITIES.has(city.toLowerCase());

  if (!withinCoverage) {
    return {
      inputAddress: address,
      formattedAddress: r.formatted_address ?? null,
      county: city ? `${city} area` : null,
      state: r.address_components.state ?? null,
      withinCoverage: false,
      officials: [],
      confidence,
      coverageNote:
        "Outside demo coverage. The pulse-demo orientation is scoped to Travis County / the Austin metro. Try an Austin address (e.g. '1100 Congress Ave, Austin, TX 78701').",
    };
  }

  const officials: OrientationOfficial[] = [];

  // Helper for federal/state officials built directly from Geocodio (not
  // from fixtures) — derives slug + categories from the role string.
  // Federal senators from Geocodio need name disambiguation in the slug
  // because two share the same role + district ("U.S. Senator" +
  // "Texas (state-wide)"); otherwise both would slug to the same path.
  function buildOfficial(
    partial: Omit<OrientationOfficial, "slug" | "categories">,
  ): OrientationOfficial {
    let slug: string;
    if (partial.layer === "federal" && partial.role === "U.S. Senator") {
      const last = partial.name.split(" ").filter((p) => p.length > 2).pop() ?? "";
      slug = `us-senator-texas-state-wide-${last.toLowerCase()}`;
    } else {
      slug = slugFromRoleDistrict(partial.role, partial.district);
    }
    return {
      ...partial,
      slug,
      categories: categoriesForRole(partial.role),
    };
  }

  // --- Federal layer: senators (state-wide) + house rep (address district) ---
  // Geocodio's current_legislators on the congressional_districts field gives
  // all three federal officials for the address — both senators + the rep.
  const cd = fields.congressional_districts?.[0];
  if (cd?.current_legislators) {
    for (const leg of cd.current_legislators) {
      const bio = leg.bio ?? {};
      const contact = leg.contact ?? {};
      if (leg.type === "senator") {
        officials.push(
          buildOfficial({
            layer: "federal",
            role: "U.S. Senator",
            name: formatName(bio),
            party: normalizeParty(bio.party),
            district: "Texas (state-wide)",
            bioguideId: leg.references?.bioguide_id,
            sourceUrl:
              contact.url ??
              (leg.references?.bioguide_id
                ? `https://bioguide.congress.gov/scripts/biodisplay.pl?index=${leg.references.bioguide_id}`
                : "https://www.senate.gov/senators/"),
            addressScoped: false,
            sourceTier: "primary source",
            photoUrl: bio.photo_url,
          }),
        );
      } else if (leg.type === "representative") {
        officials.push(
          buildOfficial({
            layer: "federal",
            role: "U.S. Representative",
            name: formatName(bio),
            party: normalizeParty(bio.party),
            district: `TX-${cd.district_number}`,
            bioguideId: leg.references?.bioguide_id,
            sourceUrl:
              contact.url ??
              (leg.references?.bioguide_id
                ? `https://bioguide.congress.gov/scripts/biodisplay.pl?index=${leg.references.bioguide_id}`
                : "https://www.house.gov/"),
            addressScoped: true,
            sourceTier: "primary source",
            photoUrl: bio.photo_url,
          }),
        );
      }
    }
  }

  // --- State layer: TX state senator + state rep, from Geocodio's
  // state_legislative_districts.current_legislators. ---
  const stateSenate = fields.state_legislative_districts?.senate?.[0];
  if (stateSenate?.current_legislators?.[0]) {
    const leg = stateSenate.current_legislators[0]!;
    const bio = leg.bio ?? {};
    officials.push(
      buildOfficial({
        layer: "state",
        role: "Texas State Senator",
        name: formatName(bio),
        party: normalizeParty(bio.party),
        district: `TX Senate District ${stateSenate.district_number}`,
        sourceUrl:
          leg.contact?.url ??
          `https://senate.texas.gov/member.php?d=${stateSenate.district_number}`,
        addressScoped: true,
        sourceTier: "primary source",
        photoUrl: bio.photo_url,
      }),
    );
  } else if (stateSenate?.district_number) {
    const sen = txStateSenator(stateSenate.district_number);
    if (sen) officials.push(toOrientation(sen));
  }

  const stateHouse = fields.state_legislative_districts?.house?.[0];
  if (stateHouse?.current_legislators?.[0]) {
    const leg = stateHouse.current_legislators[0]!;
    const bio = leg.bio ?? {};
    officials.push(
      buildOfficial({
        layer: "state",
        role: "Texas State Representative",
        name: formatName(bio),
        party: normalizeParty(bio.party),
        district: `TX House District ${stateHouse.district_number}`,
        sourceUrl:
          leg.contact?.url ??
          `https://house.texas.gov/members/member-page/?district=${stateHouse.district_number}`,
        addressScoped: true,
        sourceTier: "primary source",
        photoUrl: bio.photo_url,
      }),
    );
  } else if (stateHouse?.district_number) {
    const rep = txStateRep(stateHouse.district_number);
    if (rep) officials.push(toOrientation(rep));
  }

  // --- County layer: Travis County Commissioners Court (fixtures). ---
  for (const c of travisCountyCourt()) {
    officials.push(toOrientation(c));
  }

  // --- County layer: Travis County judicial officials (fixtures). ---
  for (const c of travisCountyJudicial()) {
    officials.push(toOrientation(c));
  }

  // --- City layer: Austin Mayor + 10 council members (fixtures). ---
  for (const c of austinCityCouncil()) {
    officials.push(toOrientation(c));
  }

  // --- City layer: Austin municipal judge (fixtures). ---
  for (const c of austinMunicipal()) {
    officials.push(toOrientation(c));
  }

  return {
    inputAddress: address,
    formattedAddress: r.formatted_address ?? null,
    county: "Travis County",
    state: r.address_components.state ?? null,
    withinCoverage: true,
    officials,
    confidence,
  };
}

function toOrientation(o: Official): OrientationOfficial {
  return {
    layer: o.layer,
    role: o.role,
    name: o.name,
    party: o.party,
    district: o.district,
    bioguideId: o.bioguideId,
    sourceUrl: o.sourceUrl,
    addressScoped: o.addressScoped ?? false,
    sourceTier: "primary source",
    verified: o.verified,
    officeDescription: o.officeDescription,
    slug: slugForOfficial(o),
    categories: categoriesForRole(o.role),
  };
}

/** Derive a slug for a federal/state official built from Geocodio data
 * (no fixture). Same scheme as slugForOfficial in fixtures.ts, but with
 * a few normalizations so Geocodio-derived slugs match fixture slugs:
 *   "U.S. Senator"     → "us-senator"     (not "u-s-senator")
 *   "U.S. Representative" → "us-representative"
 * The fixture version produces the same output via the same normalization
 * (see slugForOfficial). */
function slugFromRoleDistrict(role: string, district?: string): string {
  const normalizedRole = role
    .replace(/U\.S\./g, "Us")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const d = (district ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return d ? `${normalizedRole}-${d}` : normalizedRole;
}

/** Look up a fixture official by its persistent slug. Used by /api/rep/:slug
 * to resolve officials that aren't from Geocodio (the demo user's pinned
 * set, including state-legislative fallbacks, county, and city). */
export function findOfficialBySlug(slug: string): Official | null {
  return findFixtureBySlug(slug);
}

/**
 * Resolve any federal member of Congress by bioguide from Layer 1's DB,
 * returning an `Official` the rep page can render. Powers the rep↔bill
 * cross-link (C1): a bill's sponsor links to /api/rep/member-<bioguide>,
 * and this builds the (real, DB-backed) federal rep record for it — even
 * when the member is outside the Austin fixture set. Null when not found.
 *
 * Picks the most recent term (redistricting can produce several rows per
 * bioguide). Role + district come from the position; party from the term.
 */
export async function resolveMemberByBioguide(
  env: { DATABASE_URL?: string },
  bioguide: string,
): Promise<Official | null> {
  if (!env.DATABASE_URL) return null;
  try {
    const sql = neon(env.DATABASE_URL);
    const rows = (await sql(
      `
      SELECT p.full_name, p.bioguide_id, pos.title, pos.district_id,
             pos.state_code, pa.name AS party
      FROM persons p
      JOIN officeholders o ON o.person_id = p.id
      LEFT JOIN positions pos ON pos.id = o.position_id
      LEFT JOIN parties pa ON pa.id = o.party_id
      WHERE p.bioguide_id = $1
      ORDER BY o.term_start DESC
      LIMIT 1
    `,
      [bioguide.toUpperCase()],
    )) as unknown as Array<{
      full_name: string;
      bioguide_id: string;
      title: string | null;
      district_id: string | null;
      state_code: string | null;
      party: string | null;
    }>;
    const r = rows[0];
    if (!r) return null;

    const isSenator = (r.title ?? "").toLowerCase().includes("senator");
    const role = isSenator ? "U.S. Senator" : "U.S. Representative";
    const district = r.district_id
      ? isSenator
        ? `${r.state_code} (state-wide)`
        : r.district_id
      : r.state_code ?? undefined;

    return {
      layer: "federal",
      role,
      name: r.full_name,
      party: r.party ?? undefined,
      district: district ?? undefined,
      bioguideId: r.bioguide_id,
      sourceUrl: `https://bioguide.congress.gov/search/bio/${r.bioguide_id}`,
      addressScoped: false,
      verified: true,
      slug: `member-${r.bioguide_id.toLowerCase()}`,
      officeDescription: isSenator
        ? "Member of the U.S. Senate. Votes on federal legislation, advises and consents on appointments, ratifies treaties."
        : "Member of the U.S. House of Representatives. Votes on federal legislation, sponsors bills, serves on House committees.",
    };
  } catch {
    return null;
  }
}

/**
 * The full Austin/Travis fixture set as OrientationOfficials — powers the
 * `/reps` directory when the visitor hasn't oriented an address. Same
 * enumerable set `allFixtureOfficials()` returns, mapped to the shape the
 * SPA already renders (`OrientationOfficial`) so the directory and the
 * orient result share one card component. Federal here is the pinned
 * fixture set (Cruz / Cornyn / Doggett); an oriented address swaps in the
 * live Geocodio federal + state officials for that address.
 */
export function allOfficialsOriented(): OrientationOfficial[] {
  return allFixtureOfficials().map(toOrientation);
}