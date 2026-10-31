import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ createServerClient: () => ({}) }));
vi.mock("../src/lib/supabase", () => ({ createServerClient: () => ({}) }));
import { deterministicVerify, FALLBACK_MAX_CONFIDENCE } from "@/lib/agent";

const prior = [{ id: "1", topic: "deadline", exact_quote: "submit by 11:59 PM tonight", speaker: "A", said_at: null, meeting_seq: 1 }];

describe("deterministicVerify (B4)", () => {
  it("never exceeds the fallback confidence ceiling", () => {
    for (const [q, t] of [["let's submit tomorrow", "deadline"], ["switch to Mongo", "ledger_database"], ["use Postgres", "ledger_database"]]) {
      expect(deterministicVerify(prior, { exact_quote: q, summary: "" }, t).confidence).toBeLessThanOrEqual(FALLBACK_MAX_CONFIDENCE);
    }
  });
  it("does not flag a neutral same-topic statement", () => {
    expect(deterministicVerify(prior, { exact_quote: "Postgres with read replicas", summary: "" }, "ledger_database").verdict).toBe("unrelated");
  });
  it("treats a tighter same-day time as a refinement", () => {
    expect(deterministicVerify(prior, { exact_quote: "submit by 11 PM", summary: "" }, "deadline").verdict).toBe("refines");
  });
});
