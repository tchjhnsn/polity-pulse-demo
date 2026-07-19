/**
 * Category taxonomy for the pulse-demo rep pages.
 *
 * See docs/operations/pulse-demo-category-taxonomy-2026-07-19.md for the
 * proposal + review history. This is the canonical implementation after
 * Torian's 2026-07-19 review:
 *   - No arbitrary cap on categories per office.
 *   - County Judge → judiciary-courts (not law-enforcement-public-safety).
 *   - judiciary-courts is in the taxonomy; judicial officials are surfaced.
 *   - Each category gets its own color, separate from the layer-badge axis.
 *
 * Categories are *functions of government*, not partisan topics. A category
 * appears on an office only when that office has real authority over the
 * function (not advisory).
 */

export type Category =
  | "legislation"
  | "budget-finances"
  | "law-enforcement-public-safety"
  | "judiciary-courts"
  | "transportation"
  | "education"
  | "health-human-services"
  | "land-use-housing"
  | "utilities-infrastructure"
  | "elections-governance";

export interface CategoryDef {
  id: Category;
  label: string;
  /** Hex color — own color axis, separate from layer badges. */
  color: string;
  /** Tailwind-friendly lighter wash for backgrounds (badge fill). */
  wash: string;
  /** One-sentence scope statement, used in the category-filter UI. */
  scope: string;
}

export const CATEGORIES: Record<Category, CategoryDef> = {
  legislation: {
    id: "legislation",
    label: "Legislation",
    color: "#1A3A5E",
    wash: "rgba(26, 58, 94, 0.14)",
    scope: "Drafting and voting on bills, statutes, and ordinances.",
  },
  "budget-finances": {
    id: "budget-finances",
    label: "Budget & Finances",
    color: "#B8892B",
    wash: "rgba(184, 137, 43, 0.18)",
    scope: "Taxing, spending, appropriations, audits.",
  },
  "law-enforcement-public-safety": {
    id: "law-enforcement-public-safety",
    label: "Law Enforcement & Public Safety",
    color: "#7A3225",
    wash: "rgba(122, 50, 37, 0.14)",
    scope: "Police, sheriff, prosecution, public defense, emergency management.",
  },
  "judiciary-courts": {
    id: "judiciary-courts",
    label: "Judiciary & Courts",
    color: "#4A3F33",
    wash: "rgba(74, 63, 51, 0.16)",
    scope: "Judges, district attorneys, court administration, judicial review.",
  },
  transportation: {
    id: "transportation",
    label: "Transportation",
    color: "#2A6B6B",
    wash: "rgba(42, 107, 107, 0.16)",
    scope: "Roads, transit, highways, airports, sidewalks, bike infrastructure.",
  },
  education: {
    id: "education",
    label: "Education",
    color: "#8B5E3C",
    wash: "rgba(139, 94, 60, 0.16)",
    scope: "Public schools, higher ed, curriculum, school boards, education funding.",
  },
  "health-human-services": {
    id: "health-human-services",
    label: "Health & Human Services",
    color: "#4A7A3F",
    wash: "rgba(74, 122, 63, 0.16)",
    scope: "Public health, hospitals, mental health, social services, SNAP/Medicaid administration.",
  },
  "land-use-housing": {
    id: "land-use-housing",
    label: "Land Use & Housing",
    color: "#B8892B",
    wash: "rgba(184, 137, 43, 0.18)",
    scope: "Zoning, development, permits, housing policy, annexation, code enforcement.",
  },
  "utilities-infrastructure": {
    id: "utilities-infrastructure",
    label: "Utilities & Infrastructure",
    color: "#5A6B7A",
    wash: "rgba(90, 107, 122, 0.16)",
    scope: "Water, sewer, electric, gas, broadband, solid waste.",
  },
  "elections-governance": {
    id: "elections-governance",
    label: "Elections & Governance",
    color: "#5E3A6E",
    wash: "rgba(94, 58, 110, 0.16)",
    scope: "Voter registration, election administration, redistricting, ethics, campaign finance.",
  },
};

export const ALL_CATEGORIES = Object.keys(CATEGORIES) as Category[];

// --- Office → category assignment ------------------------------------------
//
// Each office gets all categories for which it has real authority (not
// advisory). Per Torian's review: no arbitrary cap; assign what's related.
// The County Judge is classified as judiciary-courts (presides over the
// constitutional county court), NOT law-enforcement.

export const OFFICE_CATEGORIES: Record<string, readonly Category[]> = {
  // Federal — legislative
  "us-senator": [
    "legislation",
    "budget-finances",
    "elections-governance",
    "judiciary-courts", // judicial confirmations
  ],
  "us-representative": [
    "legislation",
    "budget-finances",
    "transportation",
    "judiciary-courts", // federal court funding
  ],

  // State — legislative (TX)
  "tx-state-senator": [
    "legislation",
    "budget-finances",
    "transportation",
    "education",
    "judiciary-courts", // state court structure
    "elections-governance", // state election law
  ],
  "tx-state-representative": [
    "legislation",
    "budget-finances",
    "education",
    "health-human-services",
    "judiciary-courts",
    "elections-governance",
  ],

  // County — judicial
  "county-judge": [
    "judiciary-courts",
    "budget-finances", // presides over commissioners court
    "health-human-services", // county public health authority
    "elections-governance", // county election commission
  ],

  // County — legislative
  "county-commissioner": [
    "budget-finances",
    "law-enforcement-public-safety", // sheriff budget
    "land-use-housing", // subdivision platting
    "transportation", // county roads
    "utilities-infrastructure", // rural utility districts
  ],

  // County — prosecution
  "county-district-attorney": [
    "law-enforcement-public-safety",
    "judiciary-courts",
  ],
  "county-attorney": [
    "law-enforcement-public-safety",
    "judiciary-courts",
  ],

  // County — judicial
  "county-court-at-law-judge": [
    "judiciary-courts",
    "law-enforcement-public-safety", // misdemeanor docket
  ],
  "justice-of-the-peace": [
    "judiciary-courts",
    "law-enforcement-public-safety", // Class C misdemeanors
    "health-human-services", // marriages, mental health holds
  ],

  // City — executive
  "mayor": [
    "legislation", // signs ordinances
    "budget-finances",
    "law-enforcement-public-safety", // police oversight
    "land-use-housing", // zoning veto in some cities
  ],

  // City — legislative
  "city-council": [
    "budget-finances",
    "land-use-housing",
    "transportation",
    "utilities-infrastructure",
    "law-enforcement-public-safety", // APD budget
  ],

  // City — judicial
  "municipal-judge": [
    "judiciary-courts",
    "law-enforcement-public-safety", // city ordinance violations
  ],
};

/** Resolve an office's categories from its role string.
 * Returns an empty array if no mapping matches. */
export function categoriesForRole(role: string): Category[] {
  const r = role.toLowerCase();
  const pick = (key: string): Category[] => [...(OFFICE_CATEGORIES[key] ?? [])];
  if (r.includes("u.s. senator")) return pick("us-senator");
  if (r.includes("u.s. representative")) return pick("us-representative");
  if (r.includes("texas state senator")) return pick("tx-state-senator");
  if (r.includes("texas state representative")) return pick("tx-state-representative");
  if (r.includes("county judge")) return pick("county-judge");
  if (r.includes("district attorney")) return pick("county-district-attorney");
  if (r.includes("county attorney")) return pick("county-attorney");
  if (r.includes("county court at law")) return pick("county-court-at-law-judge");
  if (r.includes("justice of the peace")) return pick("justice-of-the-peace");
  if (r.includes("municipal judge")) return pick("municipal-judge");
  if (r.includes("mayor")) return pick("mayor");
  if (r.includes("council member")) return pick("city-council");
  if (r.includes("commissioner")) return pick("county-commissioner");
  return [];
}