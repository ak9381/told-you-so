import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createServerClient: () => ({
    from: () => ({
      insert: mockInsert,
    }),
  }),
}));

describe("logActivity helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes formatted event to activity_log table", async () => {
    const { logActivity } = await import("@/lib/activity");
    mockInsert.mockResolvedValueOnce({ error: null });

    await logActivity({
      userId: "u-123",
      projectId: "p-456",
      kind: "project_created",
      summary: 'Created project "Demo"',
      data: { key: "val" },
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "u-123",
      project_id: "p-456",
      kind: "project_created",
      summary: 'Created project "Demo"',
      data: { key: "val" },
    });
  });

  it("fails open and does not throw when database insert fails", async () => {
    const { logActivity } = await import("@/lib/activity");
    mockInsert.mockResolvedValueOnce({ error: { message: "relation activity_log does not exist" } });

    await expect(
      logActivity({
        kind: "ingested",
        summary: "Ingested briefing",
      })
    ).resolves.not.toThrow();
  });
});
