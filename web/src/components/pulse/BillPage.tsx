import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ExternalLink, AlertCircle, ChevronRight, RefreshCw } from "lucide-react";
import { AskBillAgent } from "./AskBillAgent";
import { useBill } from "@/lib/useBills";
import {
  statusMeta,
  lifecycleFor,
  LIFECYCLE_STAGES,
} from "@/lib/billStatus";
import { cn } from "@/lib/utils";
import type { BillDetail } from "@/lib/billTypes";

interface BillPageProps {
  slug: string;
  onBack: () => void;
  onOpenRep: (slug: string) => void;
}

const PARTY_ABBR: Record<string, string> = {
  "Democratic Party": "D",
  "Republican Party": "R",
  "Green Party": "G",
  "Libertarian Party": "L",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** C6 — horizontal lifecycle stepper. */
function LifecycleStepper({ status }: { status: string }) {
  const life = lifecycleFor(status);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {LIFECYCLE_STAGES.map((stage, i) => {
        const reached = i <= life.reachedIndex && !life.terminated;
        const isCurrent = i === life.reachedIndex && !life.terminated;
        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  reached ? "bg-accent-green" : "bg-rule",
                  isCurrent && "ring-2 ring-accent-green ring-offset-1",
                )}
              />
              <span
                className={cn(
                  "mt-1 whitespace-nowrap text-[10px]",
                  isCurrent ? "font-semibold text-ink" : "text-ink-3",
                )}
              >
                {stage.label}
              </span>
            </div>
            {i < LIFECYCLE_STAGES.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-px w-6 sm:w-10",
                  i < life.reachedIndex && !life.terminated
                    ? "bg-accent-green"
                    : "bg-rule",
                )}
              />
            )}
          </div>
        );
      })}
      {life.terminated && (
        <div className="ml-2 flex flex-col items-center">
          <div className="h-2.5 w-2.5 rounded-full bg-accent-red ring-2 ring-accent-red ring-offset-1" />
          <span className="mt-1 whitespace-nowrap text-[10px] font-semibold text-accent-red">
            {life.terminalLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function BillBody({
  bill,
  onOpenRep,
  onRefreshNews,
  refreshingNews,
}: {
  bill: BillDetail;
  onOpenRep: (slug: string) => void;
  onRefreshNews: () => void;
  refreshingNews: boolean;
}) {
  const st = statusMeta(bill.status);
  const partyAbbr = bill.sponsor.party
    ? PARTY_ABBR[bill.sponsor.party]
    : undefined;

  return (
    <div className="space-y-5">
      {/* Zone 1 — identity */}
      <div>
        <div className="text-mono uppercase tracking-[0.06em] text-ink-3">
          {bill.designator} · {bill.congress}th Congress
        </div>
        <h1 className="mt-1 text-[22px] font-semibold text-ink">{bill.title}</h1>
        <div className="mt-2">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: st.wash, color: st.color, border: `1px solid ${st.color}33` }}
          >
            {st.label}
          </span>
        </div>
      </div>

      {/* Zone 2 — lifecycle */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 text-mono uppercase tracking-[0.08em] text-ink-3">
            Lifecycle
          </div>
          <LifecycleStepper status={bill.status} />
        </CardContent>
      </Card>

      {/* Zone 3 — AI margin note */}
      {bill.narration && (
        <div className="flex items-baseline gap-2 rounded-lg border border-rule bg-paper-2 px-4 py-3">
          <span className="rounded bg-ink-3 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-white">
            AI
          </span>
          <span className="text-small italic text-accent-blue">
            {bill.narration}
          </span>
        </div>
      )}

      {/* Zone 3b — summary (CRS / editorial), when present */}
      {bill.summary && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-1.5 text-mono uppercase tracking-[0.08em] text-ink-3">
              Summary
              {bill.summarySource === "crs"
                ? " · Congressional Research Service"
                : bill.summarySource === "editorial"
                  ? " · editorial"
                  : ""}
            </div>
            <p className="text-body text-ink">{bill.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Zone 4 — the record */}
      <Card>
        <CardContent className="space-y-2.5 p-4">
          <div className="text-mono uppercase tracking-[0.08em] text-ink-3">
            The record
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-y-2 text-small">
            <span className="text-ink-3">Sponsor</span>
            <span>
              {bill.sponsor.name ? (
                bill.sponsor.repSlug ? (
                  <button
                    type="button"
                    onClick={() => onOpenRep(bill.sponsor.repSlug!)}
                    className="inline-flex items-center gap-1 font-medium text-accent-blue hover:underline"
                  >
                    {bill.sponsor.name}
                    {partyAbbr ? ` (${partyAbbr}${bill.sponsor.district ? `-${bill.sponsor.district}` : ""})` : ""}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="text-ink">
                    {bill.sponsor.name}
                    {partyAbbr ? ` (${partyAbbr})` : ""}
                  </span>
                )
              ) : (
                <span className="text-ink-3">not yet resolved</span>
              )}
            </span>

            <span className="text-ink-3">Chamber</span>
            <span className="text-ink capitalize">{bill.chamber}</span>

            <span className="text-ink-3">Introduced</span>
            <span className="text-ink">{fmtDate(bill.introducedDate)}</span>

            <span className="text-ink-3">Source</span>
            <span>
              {bill.sourceUrl ? (
                <a
                  href={bill.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent-blue hover:underline"
                >
                  congress.gov <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="text-ink-3">—</span>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Zone 4b — the analyzer: AI-extracted topics driving the live search */}
      {bill.topics.length > 0 && (
        <div className="rounded-lg border border-accent-blue/30 bg-[var(--hl-blue,rgba(26,58,94,0.06))] px-4 py-3">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="rounded bg-ink-3 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-white">
              AI
            </span>
            <span className="text-mono uppercase tracking-[0.08em] text-ink-3">
              Analyzer · topics extracted from this bill
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {bill.topics.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: "rgba(26,58,94,0.10)",
                  color: "#1A3A5E",
                  border: "1px solid rgba(26,58,94,0.25)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-2 text-mono-sm text-ink-3">
            The agent read the bill and searched live news for these topics —
            not just the bill number.
          </p>
        </div>
      )}

      {/* Ask — grounded Q&A over this bill's own context only */}
      <AskBillAgent billSlug={bill.slug} />

      {/* Zone 5 — in the news */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <span className="text-mono uppercase tracking-[0.08em] text-ink-3">
            {bill.topics.length > 0
              ? `Live coverage on these topics · ${bill.news.length}`
              : `In the news — matched by headline · ${bill.news.length}`}
          </span>
          <button
            type="button"
            onClick={onRefreshNews}
            disabled={refreshingNews}
            className="ml-auto inline-flex items-center gap-1 text-mono-sm text-ink-3 hover:text-accent-blue disabled:opacity-50"
            aria-label="Refresh news"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshingNews && "animate-spin")}
            />
            {refreshingNews ? "refreshing…" : "refresh"}
          </button>
        </div>
        {bill.news.length === 0 ? (
          <p className="px-1 text-small text-ink-3">
            No coverage matched {bill.designator} in the current window.
            {bill.newsNote ? ` (${bill.newsNote})` : ""}
          </p>
        ) : (
          <div className="space-y-2">
            {bill.news.map((n, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="mb-1 flex items-center gap-2 text-mono text-ink-3">
                    <span className="font-semibold uppercase tracking-[0.04em] text-accent-blue">
                      outer-ring news
                    </span>
                    <span>{n.domain}</span>
                    <span>{fmtDate(n.timestamp)}</span>
                  </div>
                  {n.url ? (
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-small text-ink hover:underline"
                    >
                      {n.title}
                    </a>
                  ) : (
                    <span className="text-small text-ink">{n.title}</span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* vintage footer */}
      <p className="text-mono text-ink-3">
        Last ingested {fmtDate(bill.lastIngestedAt)} · Polity Layer 1 pulse
      </p>
    </div>
  );
}

export function BillPage({ slug, onBack, onOpenRep }: BillPageProps) {
  const { bill, loading, error, refreshingNews, refreshNews } = useBill(slug);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-small text-ink-3 hover:text-ink-2"
      >
        <ArrowLeft className="h-4 w-4" /> Bills
      </button>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      )}

      {error && !loading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}.</AlertDescription>
        </Alert>
      )}

      {bill && !loading && (
        <BillBody
          bill={bill}
          onOpenRep={onOpenRep}
          onRefreshNews={refreshNews}
          refreshingNews={refreshingNews}
        />
      )}
    </div>
  );
}
