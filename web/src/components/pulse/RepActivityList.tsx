import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { RepActivity } from "@/lib/repTypes";
import { cn } from "@/lib/utils";

interface RepActivityListProps {
  title: string;
  items: RepActivity[];
  emptyHint?: string;
  /** When provided, renders a refresh button in the section header. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

const SOURCE_LABEL: Record<RepActivity["source"], string> = {
  gdelt: "GDELT",
  "congress-gov": "congress.gov",
  "office-feed": "office feed",
  stub: "office page",
};

const SOURCE_TIER: Record<RepActivity["source"], string> = {
  gdelt: "outer-ring news",
  "congress-gov": "primary source",
  "office-feed": "primary source",
  stub: "primary source",
};

function fmtDate(iso: string): string {
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

export function RepActivityList({
  title,
  items,
  emptyHint,
  onRefresh,
  refreshing,
}: RepActivityListProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-mono uppercase tracking-[0.08em] text-ink-3">
          {title} · {items.length}
        </span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="ml-auto inline-flex items-center gap-1 text-mono-sm text-ink-3 hover:text-accent-blue disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? "refreshing…" : "refresh"}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-1 text-small text-ink-3">
          {emptyHint ?? "No items surfaced."}
        </p>
      ) : (
        items.map((item, i) => (
          <Card key={i}>
            <CardContent className="p-3.5">
              <div className="mb-1 flex items-center gap-2 text-mono text-ink-3">
                <Badge variant="outline" className="font-mono text-mono-sm">
                  {SOURCE_LABEL[item.source]}
                </Badge>
                <span>·</span>
                <span>{item.attribution}</span>
                <span>·</span>
                <span>{fmtDate(item.timestamp)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-ink no-underline hover:underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  <span className="text-[14px] text-ink">{item.title}</span>
                )}
                <a
                  href={item.url ?? "#"}
                  target={item.url ? "_blank" : undefined}
                  rel={item.url ? "noopener noreferrer" : undefined}
                  className="shrink-0 text-accent-blue hover:underline"
                  aria-hidden={item.url ? undefined : "true"}
                >
                  {item.url && <ExternalLink className="h-3.5 w-3.5" />}
                </a>
              </div>
              <div className="mt-1 text-mono-sm text-ink-3">
                [{SOURCE_TIER[item.source]}]
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}