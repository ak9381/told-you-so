import { describe, it, expect } from "vitest";
import { remainingCalls } from "@/lib/usage";

describe("remainingCalls", () => {
  it("counts down as calls are used", () => {
    expect(remainingCalls(0, 60)).toBe(60);
    expect(remainingCalls(3, 60)).toBe(57);
  });
  it("never goes negative", () => {
    expect(remainingCalls(75, 60)).toBe(0);
  });
});
