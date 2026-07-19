import { Skeleton } from "@/components/ui/skeleton";
import { FeedCard } from "./FeedCard";
import type { PulseItem, FeedKind } from "@/lib/types";

interface FeedListProps {
  items: PulseItem[];
  loading: boolean;
  filter: FeedKind | "all";
}

function FeedSkeleton() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  );
}

export function FeedList({ items, loading, filter }: FeedListProps) {
  if (loading && items.length === 0) return <FeedSkeleton />;

  const filtered =
    filter === "all" ? items : items.filter((i) => i.feed === filter);

  if (filtered.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-small text-ink-3">
        Waiting for the first live items…
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {filtered.map((item) => (
        <FeedCard key={item.id} item={item} />
      ))}
    </div>
  );
}