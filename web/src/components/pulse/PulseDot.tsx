import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PulseDotProps {
  /** Advances on each successful tick. */
  tick: number;
  paused: boolean;
}

/**
 * The animated heartbeat dot. Re-triggers the `beat` animation whenever
 * `tick` changes by toggling a key. When paused, the dot greys to ink-3
 * and stops animating.
 */
export function PulseDot({ tick, paused }: PulseDotProps) {
  const [beating, setBeating] = useState(false);

  useEffect(() => {
    if (paused) return;
    setBeating(true);
    const t = setTimeout(() => setBeating(false), 800);
    return () => clearTimeout(t);
  }, [tick, paused]);

  return (
    <span
      className={cn(
        "inline-block h-3 w-3 rounded-full",
        paused ? "bg-ink-3" : "bg-accent-green",
        beating && "animate-beat",
      )}
      aria-label={paused ? "heartbeat paused" : "heartbeat live"}
    />
  );
}