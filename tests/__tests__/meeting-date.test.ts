import { describe, it, expect } from "vitest";
import { parseMeetingDate } from "@/lib/dates";

describe("parseMeetingDate", () => {
  it("reads compact file-name dates", () => {
    expect(parseMeetingDate("01-launch-planning-28oct", 2026)).toBe("2026-10-28");
    expect(parseMeetingDate("03-later-meeting-4nov", 2026)).toBe("2026-11-04");
  });
  it("reads transcript headers", () => {
    expect(parseMeetingDate("[Launch sync — 4 Nov]", 2026)).toBe("2026-11-04");
    expect(parseMeetingDate("Pricing call, October 28th", 2026)).toBe("2026-10-28");
    expect(parseMeetingDate("notes 2026-10-30")).toBe("2026-10-30");
  });
  it("returns null when there is no date", () => {
    expect(parseMeetingDate("team-notes", 2026)).toBeNull();
    expect(parseMeetingDate("", 2026)).toBeNull();
  });
});
