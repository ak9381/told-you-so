import { describe, it, expect } from "vitest";
import { decisionBadge } from "@/lib/decision-status";

describe("decisionBadge (Keep old)", () => {
  const oldD = { id: "old", status: "active", meeting_seq: 1, superseded_by: null };
  it("keeps the old decision active", () => {
    expect(decisionBadge(oldD, [oldD])).toBeNull();
  });
  it("labels the new decision rejected, not pivot", () => {
    const newD = { id: "new", status: "rejected", meeting_seq: 2, superseded_by: "old" };
    expect(decisionBadge(newD, [oldD, newD])).toMatch(/rejected/);
  });
  it("reads legacy keep_old rows (superseded by an earlier decision) as rejected", () => {
    const newD = { id: "new", status: "superseded", meeting_seq: 2, superseded_by: "old" };
    expect(decisionBadge(newD, [oldD, newD])).toMatch(/rejected/);
  });
  it("still labels a real pivot (old superseded by a later one)", () => {
    const later = { id: "new", status: "active", meeting_seq: 2, superseded_by: null };
    const piv = { ...oldD, status: "superseded", superseded_by: "new" };
    expect(decisionBadge(piv, [piv, later])).toBe("pivoted");
  });
});
