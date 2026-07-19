/** Shared types between the Worker /api/orient and the SPA. */

export type GovernmentLayer = "federal" | "state" | "county" | "city";

export interface OrientationOfficial {
  layer: GovernmentLayer;
  role: string;
  name: string;
  party?: string;
  district?: string;
  bioguideId?: string;
  sourceUrl: string;
  addressScoped: boolean;
  sourceTier: "primary source" | "aggregator";
  photoUrl?: string;
  verified?: boolean;
  officeDescription?: string;
  slug: string;
  categories: string[];
}

export interface OrientationResult {
  inputAddress: string;
  formattedAddress: string | null;
  county: string | null;
  state: string | null;
  withinCoverage: boolean;
  coverageNote?: string;
  officials: OrientationOfficial[];
  confidence: "high" | "low" | "multi" | "empty" | "error";
  geocoderError?: string;
}