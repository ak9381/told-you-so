import { describe, it, expect } from "vitest";
import { formatEmailDue } from "@/lib/dates";
describe("formatEmailDue", () => {
  it("formats timestamps in IST", () => {
    expect(formatEmailDue("2026-11-06T03:30:00+00:00")).toBe("Fri 6 Nov, 9:00 am IST");
  });
  it("formats date-only values without a time", () => {
    expect(formatEmailDue("2026-11-06")).toBe("Fri 6 Nov");
  });
  it("handles empty and garbage", () => {
    expect(formatEmailDue(null)).toBe("no due date");
    expect(formatEmailDue("soon")).toBe("soon");
  });
});
