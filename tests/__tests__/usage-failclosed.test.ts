import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "db down" } }) }) }) }),
    }),
  }),
}));
vi.mock("../../src/lib/supabase", () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "db down" } }) }) }) }),
    }),
  }),
}));

import { checkAndIncrementUsage } from "../../src/lib/usage";

describe("usage limiter", () => {
  it("fails closed when the usage table is unavailable", async () => {
    const r = await checkAndIncrementUsage("u1");
    expect(r.allowed).toBe(false);
  });
});
