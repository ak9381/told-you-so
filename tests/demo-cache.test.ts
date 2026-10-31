import { describe, it, expect } from "vitest";
import { demoCacheKey, getCachedDemoExtraction } from "@/lib/demo-cache";

describe("demo cache", () => {
  it("keys ignore whitespace noise but not content or user", async () => {
    const a = await demoCacheKey("Akash: hi\r\n\r\nNeha:  submit by 11", "Akash");
    expect(await demoCacheKey("Akash: hi\nNeha: submit by 11", "akash")).toBe(a);
    expect(await demoCacheKey("Akash: hi\nNeha: submit by 12", "Akash")).not.toBe(a);
    expect(await demoCacheKey("Akash: hi\nNeha: submit by 11", "Priya")).not.toBe(a);
  });
  it("returns a marked copy on hit and null on miss", async () => {
    const res = { cleaned_text: "x", self_corrections: [], decisions: [], actions: [] };
    const store = { [await demoCacheKey("demo", "Akash")]: res };
    const hit = await getCachedDemoExtraction("demo", "Akash", store);
    expect(hit?.is_cached).toBe(true);
    expect(res).not.toHaveProperty("is_cached");
    expect(await getCachedDemoExtraction("other", "Akash", store)).toBeNull();
  });
});
