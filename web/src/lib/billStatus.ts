/** Bill status → plain label + color, and the lifecycle stepper stages. */

export interface StatusMeta {
  label: string;
  color: string;
  wash: string;
}

export const STATUS_META: Record<string, StatusMeta> = {
  introduced: { label: "Introduced", color: "#6b7a86", wash: "rgba(107,122,134,0.14)" },
  referred_to_committee: { label: "Referred to committee", color: "#1A3A5E", wash: "rgba(26,58,94,0.12)" },
  reported_by_committee: { label: "Reported by committee", color: "#B8892B", wash: "rgba(184,137,43,0.16)" },
  passed_chamber_of_origin: { label: "Passed chamber of origin", color: "#4A7A3F", wash: "rgba(74,122,63,0.16)" },
  received_in_other_chamber: { label: "Received in other chamber", color: "#4A7A3F", wash: "rgba(74,122,63,0.16)" },
  passed_both_chambers: { label: "Passed both chambers", color: "#2f6b4f", wash: "rgba(47,107,79,0.18)" },
  to_president: { label: "To the president", color: "#2f6b4f", wash: "rgba(47,107,79,0.18)" },
  became_law: { label: "Became law", color: "#2f6b4f", wash: "rgba(47,107,79,0.22)" },
  failed_passage: { label: "Failed passage", color: "#7A3225", wash: "rgba(122,50,37,0.14)" },
  vetoed: { label: "Vetoed", color: "#7A3225", wash: "rgba(122,50,37,0.14)" },
  veto_overridden: { label: "Veto overridden", color: "#2f6b4f", wash: "rgba(47,107,79,0.18)" },
  withdrawn: { label: "Withdrawn", color: "#6b7a86", wash: "rgba(107,122,134,0.14)" },
  expired: { label: "Expired", color: "#6b7a86", wash: "rgba(107,122,134,0.14)" },
};

export function statusMeta(status: string): StatusMeta {
  return (
    STATUS_META[status] ?? {
      label: status.replace(/_/g, " "),
      color: "#6b7a86",
      wash: "rgba(107,122,134,0.14)",
    }
  );
}

/** The canonical linear path a bill travels. */
export const LIFECYCLE_STAGES: { key: string; label: string }[] = [
  { key: "introduced", label: "Introduced" },
  { key: "referred_to_committee", label: "Referred" },
  { key: "reported_by_committee", label: "Reported" },
  { key: "passed_chamber_of_origin", label: "Passed origin" },
  { key: "passed_both_chambers", label: "Passed both" },
  { key: "became_law", label: "Enacted" },
];

// Map any status to the index it reaches on the main path.
const STAGE_INDEX: Record<string, number> = {
  introduced: 0,
  referred_to_committee: 1,
  reported_by_committee: 2,
  passed_chamber_of_origin: 3,
  received_in_other_chamber: 3,
  passed_both_chambers: 4,
  to_president: 4,
  became_law: 5,
  veto_overridden: 5,
};

const TERMINAL_NEGATIVE = new Set([
  "failed_passage",
  "vetoed",
  "withdrawn",
  "expired",
]);

export interface LifecycleView {
  /** Index reached on the main path (‑1 for pure terminal-negative). */
  reachedIndex: number;
  /** True when the bill died off-path (failed/vetoed/withdrawn/expired). */
  terminated: boolean;
  terminalLabel: string | null;
}

export function lifecycleFor(status: string): LifecycleView {
  if (TERMINAL_NEGATIVE.has(status)) {
    return {
      reachedIndex: STAGE_INDEX[status] ?? 1,
      terminated: true,
      terminalLabel: statusMeta(status).label,
    };
  }
  return {
    reachedIndex: STAGE_INDEX[status] ?? 0,
    terminated: false,
    terminalLabel: null,
  };
}
