import { describe, it, expect } from "vitest";
import { normalizeExtraction } from "../../src/lib/extractor";

// What the model returns for a kickoff briefing with 8 rules: several share a
// topic, some have no speaker, one has an off-list topic.
const EIGHT_RULES = {
  cleaned_text: "kickoff briefing",
  self_corrections: [],
  decisions: [
    { topic: "team-size", exact_quote: "Teams can have at most 3 members", speaker: "Host", said_at: "", summary: "Max 3" },
    { topic: "deadline", exact_quote: "Submissions close at 11:59 PM IST", speaker: null, said_at: "", summary: "Deadline" },
    { topic: "deadline", exact_quote: "LinkedIn posts are due by 1 Nov", speaker: "", said_at: "", summary: "Posts due" },
    { topic: "scope", exact_quote: "Old projects are not allowed", speaker: "Host", said_at: "", summary: "No old projects" },
    { topic: "scope", exact_quote: "You must use an agentic workflow", speaker: "Host", said_at: "", summary: "Agentic" },
    { topic: "submission", exact_quote: "Submit a demo video under 3 minutes", speaker: "Host", said_at: "", summary: "Video" },
    { topic: "tooling", exact_quote: "Use Wispr Flow somewhere in your build", speaker: "Host", said_at: "", summary: "Wispr" },
    { topic: "judging-criteria", exact_quote: "Judging is 15 marks for LinkedIn", speaker: "Host", said_at: "", summary: "Marks" },
  ],
  actions: [],
};

describe("normalizeExtraction", () => {
  it("keeps all 8 distinct rules (no merging by topic, no dropping)", () => {
    const r = normalizeExtraction(EIGHT_RULES);
    expect(r.decisions).toHaveLength(8);
    expect(r.decisions.every((d) => d.speaker.length > 0)).toBe(true);
    expect(r.decisions.find((d) => d.exact_quote.startsWith("Judging"))?.topic).toBe("other");
  });
  it("collapses only exact duplicates", () => {
    const dup = { ...EIGHT_RULES, decisions: [...EIGHT_RULES.decisions, EIGHT_RULES.decisions[0]] };
    expect(normalizeExtraction(dup).decisions).toHaveLength(8);
  });
  it("survives garbage", () => {
    expect(normalizeExtraction(null).decisions).toEqual([]);
    expect(normalizeExtraction({ decisions: [null, 3, {}] }).decisions).toEqual([]);
  });
});
