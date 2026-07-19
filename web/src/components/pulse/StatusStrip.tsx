import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PulseDot } from "./PulseDot";
import { Pause, Play, RefreshCw } from "lucide-react";
import type { PulseResponse, FeedKind } from "@/lib/types";

interface StatusStripProps {
  data: PulseResponse | null;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onRefresh: () => void;
}

function feedChipVariant(ok: boolean) {
  return ok ? "ok" : "bad";
}

function aiChipVariant(enabled: boolean) {
  return enabled ? "ok" : "idle";
}

export function StatusStrip({
  data,
  paused,
  onPause,
  onResume,
  onRefresh,
}: StatusStripProps) {
  const tick = data?.heartbeat.tick ?? 0;
  const newThisTick = data?.heartbeat.newThisTick ?? 0;
  const feeds = data?.feeds ?? [];
  const narration = data?.narration;

  const feedChip = (kind: FeedKind, label: string) => {
    const f = feeds.find((x) => x.feed === kind);
    if (!f) return <Badge variant="idle">{label}: …</Badge>;
    return (
      <Badge variant={feedChipVariant(f.ok)}>
        {label}: {f.note}
      </Badge>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 max-w-[860px] mx-auto">
      <span className="inline-flex items-center gap-2">
        <PulseDot tick={tick} paused={paused} />
        <span className="font-mono text-mono text-ink-2">tick {tick}</span>
      </span>
      {feedChip("gdelt", "gdelt")}
      {feedChip("civic", "civic")}
      <Badge variant={narration ? aiChipVariant(narration.enabled) : "idle"}>
        ai: {narration ? narration.note : "n/a"}
      </Badge>
      <Badge variant="warning">new this beat: {newThisTick}</Badge>
      <span className="ml-auto inline-flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          aria-label="Refresh now"
          title="Refresh now"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={paused ? onResume : onPause}
          aria-label={paused ? "Resume heartbeat" : "Pause heartbeat"}
          title={paused ? "Resume heartbeat" : "Pause heartbeat"}
        >
          {paused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </Button>
      </span>
    </div>
  );
}