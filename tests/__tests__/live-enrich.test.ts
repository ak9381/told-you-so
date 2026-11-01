import { describe, it, expect } from "vitest";
import { citeFromMemory, type LiveCite } from "@/lib/live-enrich";

const memory = [
  { id: "1", topic: "launch-date", exact_quote: "Decision one, we launch on Friday, November 7th.", speaker: "Akash", said_at: null, meeting_seq: 1, meeting_date: "2026-10-28", meeting_title: "01-launch-planning-28oct · 28 Oct 2026" },
];

describe("citeFromMemory", () => {
  it("attaches speaker, meeting title and date from memory", () => {
    const r = citeFromMemory<LiveCite>({ old_quote: "we launch on Friday, November 7th" }, memory);
    expect(r.old_speaker).toBe("Akash");
    expect(r.old_meeting_date).toBe("2026-10-28");
    expect(r.old_meeting_title).toContain("launch-planning");
  });
  it("leaves unmatched results alone", () => {
    expect(citeFromMemory({ old_quote: "something else" }, memory)).toEqual({ old_quote: "something else" });
  });
});
