import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchProjectsClient, invalidateProjectsCache } from "@/lib/client-cache";

describe("fetchProjectsClient deduplication", () => {
  beforeEach(() => {
    invalidateProjectsCache();
    vi.restoreAllMocks();
  });

  it("shares in-flight promise across multiple calls", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ projects: [{ id: "p1", name: "Project 1" }] }),
      };
    });
    global.fetch = mockFetch;

    const [p1, p2] = await Promise.all([fetchProjectsClient(), fetchProjectsClient()]);

    expect(p1).toEqual({ projects: [{ id: "p1", name: "Project 1" }] });
    expect(p2).toEqual({ projects: [{ id: "p1", name: "Project 1" }] });
    expect(callCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after invalidateProjectsCache", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ projects: [{ id: `p${callCount}`, name: `Project ${callCount}` }] }),
      };
    });
    global.fetch = mockFetch;

    const res1 = await fetchProjectsClient();
    expect(res1.projects[0].id).toBe("p1");

    invalidateProjectsCache();

    const res2 = await fetchProjectsClient();
    expect(res2.projects[0].id).toBe("p2");
    expect(callCount).toBe(2);
  });
});
