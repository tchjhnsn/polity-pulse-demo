/** Shared types between the Worker (/api/pulse) and the SPA. */

export type FeedKind = "gdelt" | "civic";

/** Where the agent filed an item (Phase III attribution). */
export interface Attribution {
  kind: "bill" | "rep";
  slug: string;
  label: string;
  by: "bill-number" | "name-match";
}

export interface PulseItem {
  feed: FeedKind;
  id: string;
  title: string;
  url: string | null;
  source: string;
  /** ISO-8601. */
  timestamp: string;
  /** True on the tick this item was first seen by the agent. */
  isNew: boolean;
  /** Optional AI-generated one-line "why it matters" (Tier 1; demo-only). */
  narration?: string;
  /** Where the agent filed this item; absent = unattributed wire. */
  attribution?: Attribution;
}

export interface FeedStatus {
  feed: FeedKind;
  ok: boolean;
  note: string;
  count: number;
}

export interface PulseResponse {
  banner: string;
  heartbeat: {
    tick: number;
    at: string;
    lastUpstreamFetchAt: string | null;
    newThisTick: number;
  };
  narration: { enabled: boolean; note: string };
  feeds: FeedStatus[];
  items: PulseItem[];
}