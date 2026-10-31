import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/usage", () => ({ checkAndIncrementUsage: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/usage", () => ({ checkAndIncrementUsage: vi.fn(async () => ({ allowed: true })) }));

import { verifyExtraction, quoteInText } from "../../src/lib/verifier";
import type { ExtractionResult } from "../../src/lib/extractor";

const SRC = "Priya: Let's keep Postgres for the ledger.\nRohan: I'll ship the webhook by Friday.";
const EXTRACTION: ExtractionResult = {
  cleaned_text: "",
  self_corrections: [],
  decisions: [
    { topic: "ledger_database", exact_quote: "Let's keep Postgres for the ledger", speaker: "Priya", said_at: "", summary: "Postgres" },
    { topic: "auth_provider", exact_quote: "We will use Clerk", speaker: "Priya", said_at: "", summary: "Clerk" },
  ],
  actions: [{ title: "Ship webhook", owner: "Rohan", due_date: "Friday", source_quote: "I'll ship the webhook by Friday", reminder_lead_min: 1440 }],
};

function geminiReply(obj: unknown, status = 200) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status });
}

describe("quoteInText", () => {
  it("ignores punctuation/case", () => {
    expect(quoteInText("Let’s KEEP postgres, for the ledger!", SRC)).toBe(true);
    expect(quoteInText("We will use Clerk", SRC)).toBe(false);
  });
});

describe("verifyExtraction scorer", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test";
    vi.restoreAllMocks();
  });

  it("scores items and caps hallucinated quotes at 0.4", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      geminiReply({
        items: [
          { kind: "decision", index: 0, confidence: 0.95, quote_found: true, reason: "exact" },
          { kind: "decision", index: 1, confidence: 0.9, quote_found: false, reason: "not in text" },
          { kind: "action", index: 0, confidence: 0.88, quote_found: true, reason: "ok" },
          { kind: "action", index: 9, confidence: 1, quote_found: true, reason: "bogus index" },
        ],
        missed: ["Team size of 3"],
        overall: 0.75,
      })
    );
    const v = await verifyExtraction(SRC, EXTRACTION, "u1");
    expect(v.status).toBe("verified");
    expect(v.items).toHaveLength(3);
    expect(v.items.find((i) => i.kind === "decision" && i.index === 1)?.confidence).toBe(0.4);
    expect(v.items.find((i) => i.kind === "decision" && i.index === 0)?.confidence).toBe(0.95);
    expect(v.overall).toBe(0.75);
    expect(v.missed).toEqual(["Team size of 3"]);
  });

  it("falls back to not_verified on HTTP error, never throws", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("x", { status: 400 }));
    const v = await verifyExtraction(SRC, EXTRACTION, "u1");
    expect(v.status).toBe("not_verified");
  });

  it("falls back on malformed JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }))
    );
    expect((await verifyExtraction(SRC, EXTRACTION, "u1")).status).toBe("not_verified");
  });
});
