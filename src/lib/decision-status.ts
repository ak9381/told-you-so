export interface DecisionLike {
  id: string;
  status: string;
  meeting_seq: number;
  superseded_by?: string | null;
}

/**
 * The history badge for a decision, or null when it is still in force.
 * "Keep old" marks the NEW decision rejected (the old one stays active);
 * New wins / Pivot strike the OLD one.
 */
export function decisionBadge(d: DecisionLike, all: DecisionLike[]): string | null {
  if (d.status === "active") return null;
  if (d.status === "rejected") return "rejected · kept earlier";
  if (d.status === "overruled") return "overruled";
  if (d.status === "superseded") {
    // Legacy keep_old rows: superseded by an EARLIER decision → it was rejected.
    const by = d.superseded_by ? all.find((x) => x.id === d.superseded_by) : undefined;
    if (by && by.meeting_seq < d.meeting_seq) return "rejected · kept earlier";
    return "pivoted";
  }
  return d.status;
}
