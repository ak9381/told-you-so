import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveDue } from "../../src/lib/dates";

const ist = (iso: string | null) =>
  iso && new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour12: false });

describe("resolveDue (IST)", () => {
  afterEach(() => vi.useRealTimers());
  // Fixed clock: Sat 31 Oct 2026, 20:00 IST (14:30 UTC)
  const setNow = () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T14:30:00Z"));
  };

  it("today 11:59 PM is 23:59 IST same day", () => {
    setNow();
    expect(ist(resolveDue("today 11:59 PM"))).toBe("31/10/2026, 23:59:00");
  });
  it("tonight is 22:00 IST", () => {
    setNow();
    expect(ist(resolveDue("tonight"))).toBe("31/10/2026, 22:00:00");
  });
  it("tomorrow 10:30 am", () => {
    setNow();
    expect(ist(resolveDue("tomorrow 10:30 am"))).toBe("01/11/2026, 10:30:00");
  });
  it("weekday uses the IST day (Monday = 2 Nov 09:00 IST)", () => {
    setNow();
    expect(ist(resolveDue("Monday"))).toBe("02/11/2026, 09:00:00");
  });
  it("IST day boundary: 00:30 IST Sunday counts as Sunday, not Saturday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T19:00:00Z")); // Sun 1 Nov 00:30 IST
    expect(ist(resolveDue("today 11 pm"))).toBe("01/11/2026, 23:00:00");
  });
  it("relative minutes are exact", () => {
    setNow();
    expect(resolveDue("in 5 minutes")).toBe("2026-10-31T14:35:00.000Z");
  });
  it("unknown → null", () => {
    expect(resolveDue("someday")).toBeNull();
    expect(resolveDue("")).toBeNull();
  });
});

import { formatIst } from "../../src/lib/dates";

describe("resolveDue explicit dates (IST)", () => {
  afterEach(() => vi.useRealTimers());
  const setNow = () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T14:30:00Z"));
  };
  it("'1 Nov 11:59 PM IST' is 1 Nov 23:59 IST, not 5:29 AM", () => {
    setNow();
    expect(ist(resolveDue("1 Nov 11:59 PM IST"))).toBe("01/11/2026, 23:59:00");
  });
  it("'Nov 7, 2026 10 am'", () => {
    setNow();
    expect(ist(resolveDue("Nov 7, 2026 10 am"))).toBe("07/11/2026, 10:00:00");
  });
  it("bare ISO is IST wall clock", () => {
    expect(ist(resolveDue("2026-11-01T23:59:00"))).toBe("01/11/2026, 23:59:00");
  });
  it("ISO with a model 'Z' is read as IST wall clock", () => {
    expect(ist(resolveDue("2026-11-01T23:59:00Z"))).toBe("01/11/2026, 23:59:00");
  });
  it("ISO with explicit offset is trusted", () => {
    expect(ist(resolveDue("2026-11-01T23:59:00+05:30"))).toBe("01/11/2026, 23:59:00");
    expect(ist(resolveDue("2026-11-01T12:00:00-04:00"))).toBe("01/11/2026, 21:30:00");
  });
  it("date-only ISO defaults to 09:00 IST", () => {
    expect(ist(resolveDue("2026-11-05"))).toBe("05/11/2026, 09:00:00");
  });
});

describe("formatIst", () => {
  it("formats in IST without seconds", () => {
    expect(formatIst("2026-11-01T18:29:00Z")).toBe("1 Nov 2026, 11:59 pm IST");
  });
  it("date-only stays a date", () => expect(formatIst("2026-10-24")).toBe("24 Oct 2026"));
  it("empty is a dash", () => expect(formatIst(null)).toBe("—"));
});

import { describeDue } from "@/lib/dates";
describe("describeDue", () => {
  it("marks relative phrases as inferred and keeps the phrase", () => {
    const r = describeDue("by Wednesday");
    expect(r.inferred).toBe(true);
    expect(r.text).toMatch(/^Wed \d{1,2} [A-Z][a-z]{2} \(from 'by Wednesday'\)$/);
  });
  it("does not mark explicit dates as inferred", () => {
    expect(describeDue("Nov 7, 2026").inferred).toBe(false);
  });
  it("handles a missing date", () => {
    expect(describeDue("").text).toBe("no due date");
  });
});
