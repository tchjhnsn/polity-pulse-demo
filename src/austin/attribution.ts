/**
 * News attribution — the Phase III "the agent files the wire" pass.
 *
 * Pure functions. Given a news headline, match it to a bill (by bill-number
 * reference in the title) or a rep (by full-name match), or leave it as
 * unattributed "wire." This is what turns the pulse feed from a raw ticker
 * into "the agent files each item against the civic structure it's about."
 *
 * Honesty rule (citation discipline applied to attribution): every match
 * carries `by` ("bill-number" | "name-match") and the UI labels the section
 * "matched by headline" — we never imply editorial curation. A heuristic,
 * stated as one.
 */

export interface Attribution {
  kind: "bill" | "rep";
  /** Path fragment: /bill/<slug> or /rep/<slug>. */
  slug: string;
  /** Human label: "H.R. 122" or "Ted Cruz". */
  label: string;
  by: "bill-number" | "name-match";
}

export interface BillRef {
  slug: string;
  designator: string;
  /** Lowercased, normalized patterns to test against a normalized title. */
  patterns: string[];
}

export interface RepRef {
  slug: string;
  name: string;
  /** Lowercased full name for a phrase test. */
  pattern: string;
}

const DESIGNATOR: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
  hconres: "H.Con.Res.",
  sconres: "S.Con.Res.",
  hres: "H.Res.",
  sres: "S.Res.",
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Parse a bill slug like "119-hr-122" → {type, number}. */
function parseSlug(slug: string): { type: string; number: string } | null {
  const m = slug.match(/^\d+-([a-z]+)-(\d+)$/);
  if (!m) return null;
  return { type: m[1]!, number: m[2]! };
}

/** Build match refs for a set of bill slugs. */
export function buildBillRefs(slugs: string[]): BillRef[] {
  const refs: BillRef[] = [];
  for (const slug of slugs) {
    const parsed = parseSlug(slug);
    if (!parsed) continue;
    const desig = DESIGNATOR[parsed.type];
    if (!desig) continue;
    const num = parsed.number;
    const low = desig.toLowerCase(); // "h.r."
    const noDots = low.replace(/\./g, ""); // "hr"
    // Patterns: "h.r. 122", "h.r.122", "hr 122", "hr122".
    const patterns = [
      `${low} ${num}`,
      `${low}${num}`,
      `${noDots} ${num}`,
      `${noDots}${num}`,
    ];
    refs.push({ slug, designator: `${desig} ${num}`, patterns });
  }
  return refs;
}

/** Build match refs for a set of officials (name + rep-page slug). */
export function buildRepRefs(
  officials: { name: string; slug: string }[],
): RepRef[] {
  return officials
    .filter((o) => o.name && !o.name.toLowerCase().includes("not verified"))
    .map((o) => ({ slug: o.slug, name: o.name, pattern: normalize(o.name) }));
}

/**
 * Attribute one headline. Bill-number match wins over name match (more
 * specific). Returns null when nothing matches → the item is wire.
 */
export function attributeTitle(
  title: string,
  bills: BillRef[],
  reps: RepRef[],
): Attribution | null {
  const t = normalize(title);

  for (const b of bills) {
    if (b.patterns.some((p) => t.includes(p))) {
      return { kind: "bill", slug: b.slug, label: b.designator, by: "bill-number" };
    }
  }

  // Full-name match (first + last) to avoid common-surname false positives.
  for (const r of reps) {
    // Require the whole name as a phrase, and that it's more than one token
    // (a bare "green" won't match; "al green" will).
    if (r.pattern.includes(" ") && t.includes(r.pattern)) {
      return { kind: "rep", slug: r.slug, label: r.name, by: "name-match" };
    }
  }

  return null;
}

/** Derive the designator label for a civic bill item's self-attribution. */
export function designatorForSlug(slug: string): string {
  const parsed = parseSlug(slug);
  if (!parsed) return slug;
  const desig = DESIGNATOR[parsed.type] ?? parsed.type.toUpperCase();
  return `${desig} ${parsed.number}`;
}
