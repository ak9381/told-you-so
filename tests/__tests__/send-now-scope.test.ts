import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { method: string; args: unknown[] }[] = [];
let rows: unknown[] = [];

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "not", "in", "or", "order", "limit", "insert", "update", "single", "maybeSingle"]) {
    c[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return c;
    };
  }
  // awaiting the query resolves to the mocked rows
  c.then = (res: (v: unknown) => void) => res({ data: rows, error: null });
  return c;
}

vi.mock("../../src/lib/supabase", () => ({ createServerClient: () => ({ from: () => chain() }) }));
vi.mock("../../src/lib/email", () => ({ sendEmail: async () => ({ ok: true, id: "x" }) }));

import { runReminders } from "../../src/lib/reminders";

describe("runReminders scoping (send-now)", () => {
  beforeEach(() => {
    calls.length = 0;
    rows = [{ id: "a1", title: "t", owner: "X", due_date: "2026-11-01T10:00:00Z", reminder_lead_min: 1, source_quote: null, project_id: "other" }];
  });
  it("filters actions to the caller's project ids", async () => {
    await runReminders({ force: true, projectIds: ["p1", "p2"] });
    expect(calls).toContainEqual({ method: "in", args: ["project_id", ["p1", "p2"]] });
  });
  it("sends nothing when the caller owns no projects", async () => {
    const r = await runReminders({ force: true, projectIds: [] });
    expect(r.checked).toBe(0);
    expect(r.sent).toBe(0);
    expect(calls.some((c) => c.method === "insert")).toBe(false);
  });
  it("cron (no scope) does not filter by project", async () => {
    await runReminders();
    expect(calls.some((c) => c.method === "in")).toBe(false);
  });
});
