import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, _resetRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => _resetRateLimit());
  it("allows up to the limit then blocks within the window", () => {
    for (let i = 0; i < 3; i++) expect(checkRateLimit("u", 3, 1000, 100 + i).ok).toBe(true);
    const r = checkRateLimit("u", 3, 1000, 200);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThanOrEqual(1);
  });
  it("frees up after the window and keys are independent", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("u", 3, 1000, 0);
    expect(checkRateLimit("other", 3, 1000, 10).ok).toBe(true);
    expect(checkRateLimit("u", 3, 1000, 1500).ok).toBe(true);
  });
});
