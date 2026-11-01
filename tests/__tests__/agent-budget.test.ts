import { describe, it, expect } from "vitest";
import { takeCall, liteConfig } from "@/lib/agent";
describe("ingest AI budget", () => {
  it("counts down locally and stops at zero", () => {
    const b = { left: 2, lite: false };
    expect([takeCall(b), takeCall(b), takeCall(b)]).toEqual([true, true, false]);
    expect(takeCall(undefined)).toBe(true);
  });
  it("long meetings use one sample and no embeddings", () => {
    const cfg = { samples: 3, useEmbeddings: true, blend: true };
    expect(liteConfig(cfg, true)).toMatchObject({ samples: 1, useEmbeddings: false });
    expect(liteConfig(cfg, false)).toBe(cfg);
  });
});
