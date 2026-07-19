/** Shared types between the Worker /api/rep/:slug and the SPA rep page. */

export type CategoryId =
  | "legislation"
  | "budget-finances"
  | "law-enforcement-public-safety"
  | "judiciary-courts"
  | "transportation"
  | "education"
  | "health-human-services"
  | "land-use-housing"
  | "utilities-infrastructure"
  | "elections-governance";

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  color: string;
  wash: string;
  scope: string;
}

export interface RepActivity {
  source: "gdelt" | "congress-gov" | "office-feed" | "stub";
  timestamp: string;
  title: string;
  attribution: string;
  url: string | null;
  tier: "primary source" | "outer-ring news" | "aggregator";
}

export interface RepLiveData {
  slug: string;
  news: RepActivity[];
  bills: RepActivity[];
  office: RepActivity[];
  fetchedAt: string;
  notes: string[];
}

/** A bill this official sponsored, from Layer 1 (the C1 return leg). */
export interface SponsoredBill {
  slug: string;
  designator: string;
  title: string;
  shortTitle: string | null;
  status: string;
}

export interface RepPageData {
  slug: string;
  layer: "federal" | "state" | "county" | "city";
  role: string;
  name: string;
  party?: string;
  district?: string;
  bioguideId?: string;
  sourceUrl: string;
  addressScoped: boolean;
  verified: boolean;
  officeDescription?: string;
  categories: CategoryInfo[];
  /** Bills this member sponsored (federal only). Links back to /bill/:slug. */
  sponsoredBills?: SponsoredBill[];
  live: RepLiveData;
}