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
