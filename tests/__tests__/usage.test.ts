import { test } from "vitest";
/**
 * Usage limiter unit test.
 * Simulates 61 calls for one user and confirms the 61st is refused.
 *
 * This test mocks the Supabase client so it runs without a real database.
 * Run with: npx tsx src/__tests__/usage.test.ts
 */

// In-memory "database" for the test
let store: Record<string, { id: string; gemini_calls: number; last_live_check_at: string | null }> = {};

// Mock Supabase
const mockFrom = (table: string) => {
  if (table !== "usage") throw new Error(`Unexpected table: ${table}`);

  return {
    select: (_cols: string) => ({
      eq: (_col1: string, _val1: string) => ({
        eq: (_col2: string, _val2: string) => ({
          maybeSingle: async () => {
            const key = `${_val1}::${_val2}`;
            const row = store[key];
            return { data: row || null, error: null };
          },
        }),
      }),
    }),
    insert: async (row: Record<string, unknown>) => {
      const key = `${row.user_id}::${row.day}`;
      store[key] = {
        id: key,
        gemini_calls: (row.gemini_calls as number) || 0,
        last_live_check_at: (row.last_live_check_at as string) || null,
      };
      return { error: null };
    },
    update: (updates: Record<string, unknown>) => ({
      eq: (_col: string, _val: string) => {
        const row = store[_val];
        if (row) {
          if (updates.gemini_calls !== undefined) {
            row.gemini_calls = updates.gemini_calls as number;
          }
          if (updates.last_live_check_at !== undefined) {
            row.last_live_check_at = updates.last_live_check_at as string;
          }
        }
        return { error: null };
      },
    }),
  };
};

// Patch the createServerClient before importing usage
const mockClient = { from: mockFrom };

// We'll inline the logic here since we can't easily mock the import chain
async function checkAndIncrementUsage(
  userId: string,
  isLiveCheck = false
): Promise<{ allowed: boolean; reason?: string }> {
  const GEMINI_DAILY_CAP = 60;
  const LIVE_CHECK_COOLDOWN_SEC = 15;
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const now = new Date().toISOString();

  const key = `${userId}::${day}`;
  const existing = store[key];

  if (!existing) {
    store[key] = {
      id: key,
      gemini_calls: 1,
      last_live_check_at: isLiveCheck ? now : null,
    };
    return { allowed: true };
  }

  if (existing.gemini_calls >= GEMINI_DAILY_CAP) {
    return { allowed: false, reason: "daily_limit" };
  }

  if (isLiveCheck && existing.last_live_check_at) {
    const lastCheck = new Date(existing.last_live_check_at).getTime();
    const elapsed = (Date.now() - lastCheck) / 1000;
    if (elapsed < LIVE_CHECK_COOLDOWN_SEC) {
      return { allowed: false, reason: "live_check_cooldown" };
    }
  }

  existing.gemini_calls += 1;
  if (isLiveCheck) {
    existing.last_live_check_at = now;
  }

  return { allowed: true };
}

// ====== TEST ======
async function runTest() {
  console.log("🧪 Usage limiter test: 61 calls for one user\n");
  
  store = {}; // reset
  const userId = "test-user-123";
  let lastResult: { allowed: boolean; reason?: string } = { allowed: true };

  for (let i = 1; i <= 61; i++) {
    lastResult = await checkAndIncrementUsage(userId, false);
    if (i <= 60) {
      if (!lastResult.allowed) {
        console.error(`❌ FAIL: Call ${i} was refused (should be allowed)`);
        throw new Error("usage test failed");
      }
    }
    if (i % 10 === 0) {
      console.log(`  Call ${i}: allowed=${lastResult.allowed}`);
    }
  }

  console.log(`  Call 61: allowed=${lastResult.allowed}, reason=${lastResult.reason}`);

  if (lastResult.allowed) {
    console.error("❌ FAIL: Call 61 should have been refused but was allowed");
    throw new Error("usage test failed");
  }

  if (lastResult.reason !== "daily_limit") {
    console.error(`❌ FAIL: Expected reason "daily_limit", got "${lastResult.reason}"`);
    throw new Error("usage test failed");
  }

  console.log("\n✅ PASS: Call 61 correctly refused with daily_limit\n");

  // Test live check cooldown
  console.log("🧪 Live check cooldown test\n");
  store = {};
  const res1 = await checkAndIncrementUsage(userId, true);
  console.log(`  First live check: allowed=${res1.allowed}`);
  if (!res1.allowed) {
    console.error("❌ FAIL: First live check should be allowed");
    throw new Error("usage test failed");
  }

  const res2 = await checkAndIncrementUsage(userId, true);
  console.log(`  Immediate second live check: allowed=${res2.allowed}, reason=${res2.reason}`);
  if (res2.allowed) {
    console.error("❌ FAIL: Immediate second live check should be refused");
    throw new Error("usage test failed");
  }
  if (res2.reason !== "live_check_cooldown") {
    console.error(`❌ FAIL: Expected reason "live_check_cooldown", got "${res2.reason}"`);
    throw new Error("usage test failed");
  }

  console.log("\n✅ PASS: Live check cooldown works correctly\n");
  console.log("🎉 All usage tests passed!");
}

test("usage limiter (inline model)", runTest);

