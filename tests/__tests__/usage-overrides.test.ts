import { describe, it, expect } from "vitest";
import { capForEmail, parseCapOverrides } from "@/lib/usage";
describe("per-account AI caps", () => {
  const raw = "akashkraju218@gmail.com:200, bad, x@y.com:abc";
  it("parses valid entries only", () => {
    expect([...parseCapOverrides(raw)]).toEqual([["akashkraju218@gmail.com", 200]]);
  });
  it("overrides only the listed account (case-insensitive)", () => {
    expect(capForEmail("AkashKRaju218@gmail.com", raw, 60)).toBe(200);
    expect(capForEmail("someone@else.com", raw, 60)).toBe(60);
    expect(capForEmail(null, raw, 60)).toBe(60);
  });
});
