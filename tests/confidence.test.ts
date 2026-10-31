import { describe, it, expect } from "vitest";
import { blendConfidence, confidenceConfig, tierFor, ruleSignal, cosine, cosineNorm } from "@/lib/confidence";

const w = { agreement: 0.6, cosine: 0.25, rule: 0.15 };
describe("confidence blend", () => {
  it("uses the default weights when all signals exist", () => {
    expect(blendConfidence({ agreement: 1, cosine: 1, rule: 1 }, w)).toBeCloseTo(1);
    expect(blendConfidence({ agreement: 2 / 3, cosine: 0.5, rule: 0 }, w)).toBeCloseTo(0.4);
  });
  it("renormalises when signals are missing", () => {
    expect(blendConfidence({ agreement: 1, cosine: null, rule: null }, w)).toBeCloseTo(1);
    expect(blendConfidence({ agreement: 0.5, cosine: null, rule: 1 }, w)).toBeCloseTo((0.3 + 0.15) / 0.75);
    expect(blendConfidence({ agreement: null, cosine: null, rule: null }, w)).toBe(0);
  });
  it("config is clamped and configurable", () => {
    const c = confidenceConfig({ CONF_SAMPLES: "9", CONF_THRESHOLD: "0.7", FLAG_CONFIDENCE_BLEND: "true" });
    expect(c.samples).toBe(5);
    expect(c.threshold).toBe(0.7);
    expect(c.blend).toBe(true);
    expect(confidenceConfig({}).samples).toBe(3);
  });
  it("three tiers", () => {
    const c = confidenceConfig({});
    expect(tierFor(0.9, c)).toBe("red");
    expect(tierFor(0.5, c)).toBe("maybe");
    expect(tierFor(0.1, c)).toBe("suppressed");
  });
  it("rule + cosine helpers", () => {
    expect(ruleSignal("deadline", "let's submit tomorrow", "11:59 PM tonight")).toBe(1);
    expect(ruleSignal("deadline", "by 11 PM", "11:59 PM tonight")).toBe(0.2);
    expect(ruleSignal("auth_provider", "switch to Auth0", "Clerk")).toBe(0.8);
    expect(ruleSignal("auth_provider", "Clerk with Google", "Clerk")).toBeNull();
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineNorm(0.5)).toBe(0);
  });
});
