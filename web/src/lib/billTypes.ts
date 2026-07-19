/** Shared bill types between the Worker (/api/bills, /api/bill/:slug) and SPA. */

export interface BillSponsor {
  name: string | null;
  bioguideId: string | null;
  party: string | null;
  district: string | null;
  repSlug: string | null;
}

export interface BillSummary {
  slug: string;
  billType: string;
  billNumber: number;
  congress: number;
  designator: string;
  title: string;
  shortTitle: string | null;
  status: string;
  chamber: string;
  introducedDate: string | null;
  fullTextUrl: string | null;
  lastIngestedAt: string;
  sponsor: BillSponsor;
}

export interface BillNewsItem {
  title: string;
  url: string | null;
  domain: string;
  timestamp: string;
}

export interface BillDetail extends BillSummary {
  summary: string | null;
  summarySource: string | null;
  topics: string[];
  narration: string | null;
  news: BillNewsItem[];
  newsNote: string | null;
  sourceUrl: string | null;
  fetchedAt: string;
}
