import { createServerClient } from "./supabase";

const GEMINI_DAILY_CAP = parseInt(process.env.GEMINI_DAILY_CAP || "60", 10);
const LIVE_CHECK_COOLDOWN_SEC = 15;

export type UsageCheckResult =
  | { allowed: true }
  | { allowed: false; reason: "daily_limit" | "live_check_cooldown" };

/**
 * Returns the IST date string (YYYY-MM-DD) for "today" in India.
 */
function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Check and increment a user's Gemini usage.
 * Must be called server-side before every Gemini API call.
 *
 * @param userId  Supabase Auth user UUID
 * @param isLiveCheck  true if this is a /api/live-check call (rate-limited to 1 per 15s)
 */
export async function checkAndIncrementUsage(
  userId: string,
  isLiveCheck = false
): Promise<UsageCheckResult> {
  const supabase = createServerClient();
  const day = todayIST();
  const now = new Date().toISOString();

  // Upsert the row for today (creates if not exists)
  const { data: existing, error: fetchErr } = await supabase
    .from("usage")
    .select("id, gemini_calls, last_live_check_at")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();

  if (fetchErr) {
    console.error("Usage fetch error:", fetchErr);
    // Fail open — allow the call but log the error
    return { allowed: true };
  }

  if (!existing) {
    // First call today — insert
    const { error: insertErr } = await supabase.from("usage").insert({
      user_id: userId,
      day,
      gemini_calls: 1,
      last_live_check_at: isLiveCheck ? now : null,
    });

    if (insertErr) {
      console.error("Usage insert error:", insertErr);
      return { allowed: true }; // fail open
    }

    return { allowed: true };
  }

  // Check daily cap
  if (existing.gemini_calls >= GEMINI_DAILY_CAP) {
    return { allowed: false, reason: "daily_limit" };
  }

  // Check live-check cooldown
  if (isLiveCheck && existing.last_live_check_at) {
    const lastCheck = new Date(existing.last_live_check_at).getTime();
    const elapsed = (Date.now() - lastCheck) / 1000;
    if (elapsed < LIVE_CHECK_COOLDOWN_SEC) {
      return { allowed: false, reason: "live_check_cooldown" };
    }
  }

  // Increment
  const updates: Record<string, unknown> = {
    gemini_calls: existing.gemini_calls + 1,
  };
  if (isLiveCheck) {
    updates.last_live_check_at = now;
  }

  const { error: updateErr } = await supabase
    .from("usage")
    .update(updates)
    .eq("id", existing.id);

  if (updateErr) {
    console.error("Usage update error:", updateErr);
    return { allowed: true }; // fail open
  }

  return { allowed: true };
}

/**
 * Get current usage stats for a user (for display in the UI).
 */
export async function getUsageStats(userId: string) {
  const supabase = createServerClient();
  const day = todayIST();

  const { data } = await supabase
    .from("usage")
    .select("gemini_calls, last_live_check_at")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();

  return {
    callsToday: data?.gemini_calls ?? 0,
    dailyCap: GEMINI_DAILY_CAP,
    remaining: GEMINI_DAILY_CAP - (data?.gemini_calls ?? 0),
    lastLiveCheck: data?.last_live_check_at ?? null,
  };
}

