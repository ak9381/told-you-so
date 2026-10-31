import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock @supabase/ssr
const mockGetSession = vi.fn();
const mockRefreshSession = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(),
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
      getUser: mockGetUser,
    },
  })),
}));

describe("supabase-ssr session handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("updateSession returns user from session when not near expiry without refresh call", async () => {
    const { updateSession } = await import("@/lib/supabase-ssr");
    const futureExpiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "u1", email: "test@example.com" },
          expires_at: futureExpiresAt,
          refresh_token: "rf123",
        },
      },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/ledger");
    const result = await updateSession(req);

    expect(result.user?.email).toBe("test@example.com");
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it("updateSession triggers proactive refreshSession when token expires in less than 5 minutes", async () => {
    const { updateSession } = await import("@/lib/supabase-ssr");
    const nearExpiresAt = Math.floor(Date.now() / 1000) + 120; // 2 minutes in future (< 5 min)
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "u1", email: "old@example.com" },
          expires_at: nearExpiresAt,
          refresh_token: "rf123",
        },
      },
      error: null,
    });
    mockRefreshSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "u1", email: "refreshed@example.com" },
        },
      },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/ledger");
    const result = await updateSession(req);

    expect(mockRefreshSession).toHaveBeenCalledWith({ refresh_token: "rf123" });
    expect(result.user?.email).toBe("refreshed@example.com");
  });

  it("getRequestUser caches lookup per NextRequest instance", async () => {
    const { getRequestUser } = await import("@/lib/supabase-ssr");
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "u2", email: "cached@example.com" },
      },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/api/ledger");
    const user1 = await getRequestUser(req);
    const user2 = await getRequestUser(req);

    expect(user1).toBe(user2);
    expect(user1?.email).toBe("cached@example.com");
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});
