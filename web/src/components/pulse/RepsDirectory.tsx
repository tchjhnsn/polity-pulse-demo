import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertCircle } from "lucide-react";
import { RepCard } from "./RepCard";
import { AddressInput } from "./AddressInput";
import { useReps } from "@/lib/useReps";
import { useOrient } from "@/lib/useOrient";
import type { OrientationOfficial, GovernmentLayer } from "@/lib/orientTypes";

interface RepsDirectoryProps {
  onOpenRep: (slug: string) => void;
}

const LAYER_ORDER: GovernmentLayer[] = ["federal", "state", "county", "city"];

const LAYER_LABEL: Record<GovernmentLayer, string> = {
  federal: "Federal",
  state: "State",
  county: "County",
  city: "City",
};

// Sub-bodies inside each layer, shown in the section header so a long list
// (14 county officials) doesn't read as an undifferentiated wall.
const LAYER_SUBBODIES: Record<GovernmentLayer, string> = {
  federal: "Senators · House",
  state: "Senate · House",
  county: "Commissioners Court · Courts · DA",
  city: "Mayor · Council · Municipal Court",
};

// Category metadata mirrors src/austin/categories.ts. Kept inline (like
// OrientationView) — this surface is deleted post-hackathon; a shared
// module isn't worth the churn.
const CATEGORY_ORDER = [
  "legislation",
  "budget-finances",
  "law-enforcement-public-safety",
  "judiciary-courts",
  "transportation",
  "education",
  "health-human-services",
  "land-use-housing",
  "utilities-infrastructure",
  "elections-governance",
] as const;

const CATEGORY_META: Record<
  string,
  { label: string; color: string; wash: string; scope: string }
> = {
  legislation: { label: "Legislation", color: "#1A3A5E", wash: "rgba(26, 58, 94, 0.14)", scope: "Drafting and voting on bills, statutes, and ordinances." },
  "budget-finances": { label: "Budget & Finances", color: "#B8892B", wash: "rgba(184, 137, 43, 0.18)", scope: "Taxing, spending, appropriations, audits." },
  "law-enforcement-public-safety": { label: "Law Enforcement & Public Safety", color: "#7A3225", wash: "rgba(122, 50, 37, 0.14)", scope: "Police, sheriff, prosecution, public defense, emergency management." },
  "judiciary-courts": { label: "Judiciary & Courts", color: "#4A3F33", wash: "rgba(74, 63, 51, 0.16)", scope: "Judges, district attorneys, court administration." },
  transportation: { label: "Transportation", color: "#2A6B6B", wash: "rgba(42, 107, 107, 0.16)", scope: "Roads, transit, highways, airports, sidewalks." },
  education: { label: "Education", color: "#8B5E3C", wash: "rgba(139, 94, 60, 0.16)", scope: "Public schools, higher ed, education funding." },
  "health-human-services": { label: "Health & Human Services", color: "#4A7A3F", wash: "rgba(74, 122, 63, 0.16)", scope: "Public health, hospitals, social services." },
  "land-use-housing": { label: "Land Use & Housing", color: "#B8892B", wash: "rgba(184, 137, 43, 0.18)", scope: "Zoning, development, permits, housing policy." },
  "utilities-infrastructure": { label: "Utilities & Infrastructure", color: "#5A6B7A", wash: "rgba(90, 107, 122, 0.16)", scope: "Water, sewer, electric, broadband, solid waste." },
  "elections-governance": { label: "Elections & Governance", color: "#5E3A6E", wash: "rgba(94, 58, 110, 0.16)", scope: "Voter registration, election administration, redistricting, ethics." },
};

function CategoryChip({
  id,
  active,
  onClick,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
}) {
  const m = CATEGORY_META[id];
  if (!m) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity"
      style={{
        backgroundColor: active ? m.color : m.wash,
        color: active ? "#fff" : m.color,
        border: `1px solid ${m.color}${active ? "" : "33"}`,
      }}
    >
      {m.label}
    </button>
  );
}

export function RepsDirectory({ onOpenRep }: RepsDirectoryProps) {
  const { officials, loading, error } = useReps();
  const orient = useOrient();
  const [category, setCategory] = useState<string | null>(null);

  // "Yours" = slugs from an oriented address. Matched by slug against the
  // fixture directory; for the seed addresses (Texas Capitol → the pinned
  // fixtures) these intersect exactly. A non-seed address's live federal/
  // state officials may differ from fixtures — a known demo limitation.
  const yourSlugs = useMemo(() => {
    const s = new Set<string>();
    for (const o of orient.data?.officials ?? []) s.add(o.slug);
    return s;
  }, [orient.data]);

  const byLayer = useMemo(() => {
    const filtered = category
      ? officials.filter((o) => o.categories.includes(category))
      : officials;
    const groups: Record<GovernmentLayer, OrientationOfficial[]> = {
      federal: [],
      state: [],
      county: [],
      city: [],
    };
    for (const o of filtered) groups[o.layer].push(o);
    // Sort "yours" first within each layer.
    for (const layer of LAYER_ORDER) {
      groups[layer].sort((a, b) => {
        const ay = yourSlugs.has(a.slug) ? 0 : 1;
        const by = yourSlugs.has(b.slug) ? 0 : 1;
        return ay - by;
      });
    }
    return groups;
  }, [officials, category, yourSlugs]);

  const layerCount = LAYER_ORDER.filter((l) => byLayer[l].length > 0).length;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Couldn't load the directory: {error}.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      {/* C2 — government-at-a-glance stat card */}
      <div className="rounded-lg border border-rule bg-paper-2 px-4 py-3">
        <div className="text-[15px] font-semibold text-ink">
          {officials.length} officials · 4 layers · 10 government functions
        </div>
        <div className="mt-0.5 text-small text-ink-3">
          Everyone who governs a Travis County address. Most Americans can name
          fewer than five.
        </div>
      </div>

      {/* Optional address — highlights which officials are yours */}
      <div className="space-y-2">
        <AddressInput onSubmit={orient.orient} loading={orient.loading} />
        {orient.data?.withinCoverage && orient.data.formattedAddress && (
          <p className="flex items-center gap-1.5 px-1 text-small text-ink-3">
            <Info className="h-3.5 w-3.5" />
            Highlighting your officials for {orient.data.formattedAddress}.
          </p>
        )}
        {orient.data && !orient.data.withinCoverage && orient.data.coverageNote && (
          <p className="px-1 text-small text-ink-3">{orient.data.coverageNote}</p>
        )}
      </div>

      {/* C3 — cross-layer category filter */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity"
            style={{
              backgroundColor: category === null ? "#23303a" : "var(--paper-2)",
              color: category === null ? "#fff" : "var(--ink-3)",
              border: "1px solid var(--rule)",
            }}
          >
            All functions
          </button>
          {CATEGORY_ORDER.map((id) => (
            <CategoryChip
              key={id}
              id={id}
              active={category === id}
              onClick={() => setCategory(category === id ? null : id)}
            />
          ))}
        </div>
        {category && CATEGORY_META[category] && (
          <p className="px-1 text-small text-ink-3">
            {CATEGORY_META[category].scope} Officials across every layer who
            hold this authority:
          </p>
        )}
      </div>

      {/* Layer sections */}
      {LAYER_ORDER.map((layer) => {
        const list = byLayer[layer];
        if (list.length === 0) return null;
        return (
          <section key={layer} className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-mono uppercase tracking-[0.08em] text-ink-2">
                {LAYER_LABEL[layer]} · {list.length}
              </h2>
              <span className="text-mono-sm text-ink-3">
                {LAYER_SUBBODIES[layer]}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {list.map((o) => (
                <RepCard
                  key={o.slug}
                  official={o}
                  onOpen={onOpenRep}
                  isYours={yourSlugs.has(o.slug)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {category && layerCount === 0 && (
        <p className="px-1 py-6 text-center text-small text-ink-3">
          No officials in the demo set hold authority over this function.
        </p>
      )}
    </div>
  );
}
