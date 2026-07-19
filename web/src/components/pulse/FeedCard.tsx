import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ArrowRight } from "lucide-react";
import type { PulseItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FeedCardProps {
  item: PulseItem;
  /** Navigate to where the agent filed this item (Phase III). */
  onOpenBill?: (slug: string) => void;
  onOpenRep?: (slug: string) => void;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

function feedColorClass(feed: PulseItem["feed"]) {
  return feed === "civic" ? "text-accent-red" : "text-accent-blue";
}

export function FeedCard({ item, onOpenBill, onOpenRep }: FeedCardProps) {
  const attr = item.attribution;
  const openAttr = () => {
    if (!attr) return;
    if (attr.kind === "bill") onOpenBill?.(attr.slug);
    else onOpenRep?.(attr.slug);
  };
  return (
    <Card
      className={cn(
        "transition-colors",
        item.isNew && "border-l-4 border-l-accent-yellow bg-[var(--hl-yellow)]",
      )}
    >
      <CardContent className="p-4">
        <div className="mb-1.5 flex items-center gap-2 text-mono text-ink-3">
          <span
            className={cn(
              "font-semibold uppercase tracking-[0.04em]",
              feedColorClass(item.feed),
            )}
          >
            {item.feed}
          </span>
          <span>·</span>
          <span>{item.source}</span>
          <span>·</span>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">{fmtTime(item.timestamp)}</span>
              </TooltipTrigger>
              <TooltipContent>{item.timestamp}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {item.isNew && (
            <Badge variant="warning" className="ml-1">
              NEW
            </Badge>
          )}
        </div>
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] text-ink no-underline hover:underline"
          >
            {item.title}
          </a>
        ) : (
          <span className="text-[15px] text-ink">{item.title}</span>
        )}
        {item.narration && (
          <div className="mt-2 flex items-baseline gap-2">
            <Badge variant="secondary" className="font-mono text-mono-sm">
              AI
            </Badge>
            <span className="text-[13px] italic text-accent-blue">
              {item.narration}
            </span>
          </div>
        )}
        {attr && (
          <button
            type="button"
            onClick={openAttr}
            className="mt-2 inline-flex items-center gap-1 text-mono-sm text-ink-3 hover:text-accent-blue"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            filed to{" "}
            <span className="font-medium text-accent-blue">{attr.label}</span>
            <span className="text-ink-3">· {attr.by}</span>
          </button>
        )}
      </CardContent>
    </Card>
  );
}