import { describe, it, expect } from "vitest";
import { duePhraseFrom } from "@/lib/dates";

describe("duePhraseFrom", () => {
  it("quotes the due phrase from the source", () => {
    expect(duePhraseFrom("I'll add my friend Rohan to the team as our second member by Wednesday.")).toBe("by Wednesday");
    expect(duePhraseFrom("I'll record the two-minute demo video by Thursday night.")).toBe("by Thursday night");
    expect(duePhraseFrom("Okay, Rohan owns the landing page copy, due Thursday.")).toBe("due Thursday");
    expect(duePhraseFrom("ship it before 7 Nov")).toBe("before 7 Nov");
  });
  it("returns null without a phrase", () => {
    expect(duePhraseFrom("Let's ship.")).toBeNull();
    expect(duePhraseFrom(null)).toBeNull();
  });
});
