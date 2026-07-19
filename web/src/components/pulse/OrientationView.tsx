import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertCircle } from "lucide-react";
import { RepCard } from "./RepCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { OrientationResult, GovernmentLayer } from "@/lib/orientTypes";

interface OrientationViewProps {
  result: OrientationResult | null;
  loading: boolean;
  error: string | null;
  onOpenRep?: (slug: string) => void;
}

const LAYER_ORDER: GovernmentLayer[] = ["federal", "state", "county", "city"];

// Canonical category order for the filter row. Matches categories.ts order.
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
  { label: string; color: string; wash: string }
> = {
  legislation: { label: "Legislation", color: "#1A3A5E", wash: "rgba(26, 58, 94, 0.14)" },
  "budget-finances": { label: "Budget & Finances", color: "#B8892B", wash: "rgba(184, 137, 43, 0.18)" },
  "law-enforcement-public-safety": { label: "Law Enforcement & Public Safety", color: "#7A3225", wash: "rgba(122, 50, 37, 0.14)" },
  "judiciary-courts": { label: "Judiciary & Courts", color: "#4A3F33", wash: "rgba(74, 63, 51, 0.16)" },
  transportation: { label: "Transportation", color: "#2A6B6B", wash: "rgba(42, 107, 107, 0.16)" },
  education: { label: "Education", color: "#8B5E3C", wash: "rgba(139, 94, 60, 0.16)" },
  "health-human-services": { label: "Health & Human Services", color: "#4A7A3F", wash: "rgba(74, 122, 63, 0.16)" },
  "land-use-housing": { label: "Land Use & Housing", color: "#B8892B", wash: "rgba(184, 137, 43, 0.18)" },
  "utilities-infrastructure": { label: "Utilities & Infrastructure", color: "#5A6B7A", wash: "rgba(90, 107, 122, 0.16)" },
  "elections-governance": { label: "Elections & Governance", color: "#5E3A6E", wash: "rgba(94, 58, 110, 0.16)" },
};

export function OrientationView({ result, loading, error, onOpenRep }: OrientationViewProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredOfficials = useMemo(() => {
    if (!result || !activeCategory) return result?.officials ?? [];
    return result.officials.filter((o) => o.categories.includes(activeCategory));
  }, [result, activeCategory]);

  if (loading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Couldn't orient: {error}. The dashboard feed still works.
        </AlertDescription>
      </Alert>
    );
  }

  if (!result) return null;

  if (!result.withinCoverage) {
    return (
      <Alert variant="warning">
        <Info className="h-4 w-4" />
        <AlertDescription>
          {result.coverageNote ??
            "That address is outside the demo's Travis County / Austin coverage."}
        </AlertDescription>
      </Alert>
    );
  }

  // Group filtered officials by layer in canonical order.
  const byLayer = new Map<GovernmentLayer, typeof result.officials>();
  for (const o of filteredOfficials) {
    const arr = byLayer.get(o.layer) ?? [];
    arr.push(o);
    byLayer.set(o.layer, arr);
  }

  // Collect the set of categories present in this orientation (for the filter row).
  const presentCategories = new Set<string>();
  for (const o of result.officials) {
    for (const c of o.categories) presentCategories.add(c);
  }
  const filterCategories = CATEGORY_ORDER.filter((c) => presentCategories.has(c));

  return (
    <div className="space-y-4">
      {result.formattedAddress && (
        <div className="text-small text-ink-2">
          <span className="text-ink-3">Orienting for: </span>
          <span className="font-medium">{result.formattedAddress}</span>
          {result.county && (
            <span className="text-ink-3"> · {result.county}, {result.state}</span>
          )}
        </div>
      )}

      {/* Category filter row — "show me my reps who touch [category]" */}
      {filterCategories.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-mono uppercase tracking-[0.08em] text-ink-3">
            Filter by function
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={activeCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(null)}
            >
              All ({result.officials.length})
            </Button>
            {filterCategories.map((c) => {
              const meta = CATEGORY_META[c];
              if (!meta) return null;
              const count = result.officials.filter((o) => o.categories.includes(c)).length;
              const isActive = activeCategory === c;
              return (
                <button
                  key={c}
                  onClick={() => setActiveCategory(isActive ? null : c)}
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-opacity"
                  style={{
                    backgroundColor: meta.wash,
                    color: meta.color,
                    border: `1px solid ${meta.color}${isActive ? "" : "33"}`,
                    opacity: isActive ? 1 : 0.7,
                  }}
                  title={meta.label}
                >
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {LAYER_ORDER.map((layer) => {
          const officials = byLayer.get(layer);
          if (!officials || officials.length === 0) return null;
          return (
            <div key={layer} className="space-y-1.5">
              <div className="px-1 text-mono uppercase tracking-[0.08em] text-ink-3">
                {LAYER_LABELS[layer]} · {officials.length}
              </div>
              {officials.map((o, i) => (
                <RepCard
                  key={`${o.layer}-${o.slug}-${i}`}
                  official={o}
                  onOpen={onOpenRep}
                />
              ))}
            </div>
          );
        })}
      </div>

      {filteredOfficials.length === 0 && activeCategory && (
        <p className="px-1 text-small text-ink-3">
          None of your reps hold an office with authority over{" "}
          <strong>{CATEGORY_META[activeCategory]?.label ?? activeCategory}</strong>.
        </p>
      )}

      {result.coverageNote && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>{result.coverageNote}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

const LAYER_LABELS: Record<GovernmentLayer, string> = {
  federal: "Federal",
  state: "State",
  county: "Travis County",
  city: "City of Austin",
};