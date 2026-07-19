import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ChevronRight } from "lucide-react";
import type { OrientationOfficial, GovernmentLayer } from "@/lib/orientTypes";

interface RepCardProps {
  official: OrientationOfficial;
  onOpen?: (slug: string) => void;
  /**
   * Whether this official actually represents the visitor's oriented
   * address. When omitted, falls back to `addressScoped` — correct for the
   * orient flow (every resolved official IS yours), but in the browse
   * directory the caller passes an explicit value so we don't label all 7
   * district officials "your district" before an address is entered.
   */
  isYours?: boolean;
}

const LAYER_LABEL: Record<GovernmentLayer, string> = {
  federal: "Federal",
  state: "State",
  county: "County",
  city: "City",
};

// A3 fix (audit 2026-07-19): layers get their OWN neutral, institutional
// color axis — NOT the status variants (ok/bad/warning), which read as
// "a county official is bad." Each layer a distinct muted tone; none
// carries a good/bad connotation. Separate axis from the category colors too.
const LAYER_STYLE: Record<
  GovernmentLayer,
  { color: string; wash: string }
> = {
  federal: { color: "#1A3A5E", wash: "rgba(26, 58, 94, 0.12)" }, // ink-blue
  state: { color: "#5A6B7A", wash: "rgba(90, 107, 122, 0.14)" }, // slate
  county: { color: "#8B5E3C", wash: "rgba(139, 94, 60, 0.14)" }, // warm-brown
  city: { color: "#4A6A6A", wash: "rgba(74, 106, 106, 0.14)" }, // teal-grey
};

function LayerBadge({ layer }: { layer: GovernmentLayer }) {
  const s = LAYER_STYLE[layer];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: s.wash,
        color: s.color,
        border: `1px solid ${s.color}33`,
      }}
    >
      {LAYER_LABEL[layer]}
    </span>
  );
}

const PARTY_ABBR: Record<string, string> = {
  "Democratic Party": "D",
  "Republican Party": "R",
  "Green Party": "G",
  "Libertarian Party": "L",
};

export function RepCard({ official, onOpen, isYours }: RepCardProps) {
  const partyAbbr = official.party ? PARTY_ABBR[official.party] : undefined;
  // "yours" tag: explicit when provided (directory), else addressScoped
  // (orient flow, where every official is already the visitor's).
  const showYours = isYours ?? official.addressScoped;
  // In the directory, a district-based office the visitor hasn't claimed
  // yet reads as "district-based" rather than "your district."
  const showDistrictHint =
    isYours === false && official.addressScoped;

  return (
    <Card
      className={
        "cursor-pointer transition-colors hover:border-accent-blue/40 hover:bg-paper-2" +
        (onOpen ? "" : " cursor-default")
      }
      onClick={onOpen ? () => onOpen(official.slug) : undefined}
    >
      <CardContent className="p-4">
        <div className="mb-1.5 flex items-center gap-2 text-mono text-ink-3">
          <LayerBadge layer={official.layer} />
          {showYours && (
            <span className="text-mono-sm uppercase tracking-[0.04em] text-accent-green">
              your district
            </span>
          )}
          {showDistrictHint && (
            <span className="text-mono-sm uppercase tracking-[0.04em] text-ink-3">
              district-based
            </span>
          )}
          {partyAbbr && (
            <Badge variant="outline" className="font-mono">
              {partyAbbr}
            </Badge>
          )}
          {official.verified === false && (
            <span className="text-mono-sm uppercase tracking-[0.04em] text-ink-3">
              not verified
            </span>
          )}
          {onOpen && (
            <ChevronRight className="ml-auto h-4 w-4 text-ink-3" />
          )}
        </div>
        <div className="flex items-start gap-3">
          {official.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={official.photoUrl}
              alt={`Portrait of ${official.name}`}
              className="h-12 w-12 rounded-md object-cover ring-1 ring-rule-soft"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="flex-1">
            <span className="text-[15px] font-medium text-ink">
              {official.name}
            </span>
            <div className="mt-0.5 text-small text-ink-2">{official.role}</div>
            {official.district && (
              <div className="mt-0.5 text-mono text-ink-3">
                {official.district}
              </div>
            )}
          </div>
          <a
            href={official.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-accent-blue hover:underline"
            aria-label={`Open source for ${official.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}