import { describe, it, expect } from "vitest";
import { meetingLabel } from "@/lib/meeting-label";

describe("meetingLabel", () => {
  it("uses the meeting name and date", () => {
    expect(meetingLabel(2, "Pricing sync · 24 Oct 2026", "2026-10-24")).toBe("Pricing sync · 24 Oct 2026");
  });
  it("falls back to the number", () => {
    expect(meetingLabel(3, null, null)).toBe("Meeting #3");
  });
});
