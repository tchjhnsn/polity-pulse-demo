import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ExternalLink, AlertCircle, Info, ChevronRight } from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import { RepActivityList } from "./RepActivityList";
import { statusMeta } from "@/lib/billStatus";
import { useRep } from "@/lib/useRep";

interface RepPageProps {
  slug: string;
  onBack: () => void;
  /** Navigate to a bill detail — the C1 return leg (rep → their bills). */
  onOpenBill?: (slug: string) => void;
}

const LAYER_LABEL = {
  federal: "Federal",
  state: "State",
  county: "County",
  city: "City",
} as const;

const PARTY_ABBR: Record<string, string> = {
  "Democratic Party": "D",
  "Republican Party": "R",
  "Green Party": "G",
  "Libertarian Party": "L",
};

export function RepPage({ slug, onBack, onOpenBill }: RepPageProps) {
  const { data, loading, error, refreshingNews, refreshNews } = useRep(slug);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Couldn't load rep page: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const partyAbbr = data.party ? PARTY_ABBR[data.party] : undefined;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> All your reps
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-2 flex items-center gap-2 text-mono text-ink-3">
            <Badge variant="outline">{LAYER_LABEL[data.layer]}</Badge>
            {data.addressScoped && (
              <span className="text-mono-sm uppercase tracking-[0.04em]">
                your district
              </span>
            )}
            {partyAbbr && (
              <Badge variant="outline" className="font-mono">
                {partyAbbr}
              </Badge>
            )}
          </div>
          <h2 className="text-[22px] font-semibold text-ink">{data.name}</h2>
          <div className="mt-1 text-small text-ink-2">{data.role}</div>
          {data.district && (
            <div className="mt-0.5 text-mono text-ink-3">{data.district}</div>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.categories.map((c) => (
              <CategoryBadge key={c.id} category={c} />
            ))}
          </div>
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-small text-accent-blue hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open official source
          </a>
        </CardContent>
      </Card>

      {/* Verification notice for placeholder officials */}
      {!data.verified && (
        <Alert variant="warning">
          <Info className="h-4 w-4" />
          <AlertDescription>
            The current officeholder's name for this role was not verified
            for the demo. The office structure and its categories are
            accurate; the specific person holding the office may differ.
          </AlertDescription>
        </Alert>
      )}

      {/* About this office */}
      {data.officeDescription && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-1.5 text-mono uppercase tracking-[0.08em] text-ink-3">
              About this office
            </div>
            <p className="text-body text-ink">{data.officeDescription}</p>
          </CardContent>
        </Card>
      )}

      {/* Live activity */}
      <RepActivityList
        title="News mentions (GDELT, last 7 days)"
        items={data.live.news}
        emptyHint="No news mentions surfaced in the last 7 days. Common names get false positives; uncommon names get silence — the filter is honest about both."
        onRefresh={refreshNews}
        refreshing={refreshingNews}
      />

      {/* Sponsored legislation — Layer 1 (the C1 return leg). Links back
          to /bill/:slug, closing the rep ↔ bill graph. */}
      {data.layer === "federal" && (
        <div className="space-y-2">
          <div className="px-1 text-mono uppercase tracking-[0.08em] text-ink-3">
            Sponsored legislation · primary source ·{" "}
            {data.sponsoredBills?.length ?? 0}
          </div>
          {!data.sponsoredBills || data.sponsoredBills.length === 0 ? (
            <p className="px-1 text-small text-ink-3">
              No bills sponsored by this member are in Layer 1 yet. The pulse
              agent ingests the 119th Congress incrementally.
            </p>
          ) : (
            <div className="space-y-2">
              {data.sponsoredBills.map((b) => {
                const m = statusMeta(b.status);
                return (
                  <Card
                    key={b.slug}
                    className={
                      "transition-colors" +
                      (onOpenBill
                        ? " cursor-pointer hover:border-accent-blue/40 hover:bg-paper-2"
                        : "")
                    }
                    onClick={onOpenBill ? () => onOpenBill(b.slug) : undefined}
                  >
                    <CardContent className="p-3">
                      <div className="mb-1 flex items-center gap-2 text-mono text-ink-3">
                        <span className="font-semibold text-ink-2">
                          {b.designator}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: m.wash,
                            color: m.color,
                            border: `1px solid ${m.color}33`,
                          }}
                        >
                          {m.label}
                        </span>
                        {onOpenBill && (
                          <ChevronRight className="ml-auto h-4 w-4 text-ink-3" />
                        )}
                      </div>
                      <div className="text-small font-medium text-ink">
                        {b.shortTitle ?? b.title}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <RepActivityList
        title="Office activity"
        items={data.live.office}
        emptyHint="The office hasn't surfaced live activity. Browse the official government page directly via the link above."
      />

      {/* Source notes */}
      {data.live.notes.length > 0 && (
        <div className="px-1 text-mono-sm text-ink-3">
          <span className="text-ink-2">Source notes:</span>{" "}
          {data.live.notes.join(" · ")}
        </div>
      )}

      <div className="px-1 text-mono-sm text-ink-3">
        Live data fetched at {new Date(data.live.fetchedAt).toLocaleString()}.
      </div>
    </div>
  );
}