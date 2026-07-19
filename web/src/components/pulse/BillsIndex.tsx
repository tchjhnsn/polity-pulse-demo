import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { useBills } from "@/lib/useBills";
import { statusMeta } from "@/lib/billStatus";
import { cn } from "@/lib/utils";

interface BillsIndexProps {
  onOpenBill: (slug: string) => void;
}

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: m.wash, color: m.color, border: `1px solid ${m.color}33` }}
    >
      {m.label}
    </span>
  );
}

function fmtRel(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.round(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  } catch {
    return iso;
  }
}

export function BillsIndex({ onOpenBill }: BillsIndexProps) {
  const { bills, loading, error } = useBills();
  const [status, setStatus] = useState<string | null>(null);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of bills) counts.set(b.status, (counts.get(b.status) ?? 0) + 1);
    return counts;
  }, [bills]);

  const shown = status ? bills.filter((b) => b.status === status) : bills;
  const lastIngested = bills[0]?.lastIngestedAt;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold text-accent-blue">Bills</h1>
        <p className="mt-1 text-small text-ink-3">
          Real legislation from the 119th Congress, refreshed by the pulse agent.
        </p>
      </div>

      {!loading && bills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setStatus(null)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium",
              status === null
                ? "border-transparent bg-ink text-paper"
                : "border-rule bg-paper-2 text-ink-3",
            )}
          >
            All {bills.length}
          </button>
          {[...statusCounts.entries()].map(([s, n]) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(status === s ? null : s)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                status === s
                  ? "border-transparent bg-ink text-paper"
                  : "border-rule bg-paper-2 text-ink-2",
              )}
            >
              {statusMeta(s).label} {n}
            </button>
          ))}
        </div>
      )}

      {loading && bills.length === 0 ? (
        <div className="space-y-2.5">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : error ? (
        <p className="px-1 py-8 text-center text-small text-ink-3">
          Couldn't load bills: {error}.
        </p>
      ) : shown.length === 0 ? (
        <p className="px-1 py-8 text-center text-small text-ink-3">
          No bills ingested yet. The pulse agent populates these from
          congress.gov.
        </p>
      ) : (
        <div className="space-y-2.5">
          {shown.map((b) => (
            <Card
              key={b.slug}
              className="cursor-pointer transition-colors hover:border-accent-blue/40 hover:bg-paper-2"
              onClick={() => onOpenBill(b.slug)}
            >
              <CardContent className="p-4">
                <div className="mb-1.5 flex items-center gap-2 text-mono text-ink-3">
                  <span className="font-semibold text-ink-2">{b.designator}</span>
                  <span>· {b.congress}th</span>
                  <StatusBadge status={b.status} />
                  <ChevronRight className="ml-auto h-4 w-4 text-ink-3" />
                </div>
                <div className="text-[15px] font-medium text-ink">
                  {b.shortTitle ?? b.title}
                </div>
                <div className="mt-1 flex items-center gap-2 text-mono text-ink-3">
                  <span>
                    {b.sponsor.name
                      ? `Sponsor: ${b.sponsor.name}`
                      : "Sponsor: not yet resolved"}
                  </span>
                  <span className="ml-auto">ingested {fmtRel(b.lastIngestedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {bills.length > 0 && (
        <p className="text-mono text-ink-3">
          {bills.length} bills{lastIngested ? ` · last ingested ${fmtRel(lastIngested)}` : ""} ·
          source: api.congress.gov
        </p>
      )}
    </div>
  );
}
