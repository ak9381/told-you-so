import { log } from "@/lib/log";
import { createServerClient } from "./supabase";

const DEFAULT_CAP = 60;

function defaultCap(): number {
  const n = parseInt(process.env.GEMINI_DAILY_CAP || "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP;
}

/**
 * Per-account overrides: GEMINI_CAP_OVERRIDES="a@x.com:200,b@y.com:100".
 * Everyone else keeps the default cap.
 */
export function parseCapOverrides(raw?: string | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const part of (raw || "").split(",")) {
    const i = part.lastIndexOf(":");
    if (i <= 0) continue;
    const email = part.slice(0, i).trim().toLowerCase();
    const n = parseInt(part.slice(i + 1).trim(), 10);
    if (email && Number.isFinite(n) && n > 0) m.set(email, n);
  }
  return m;
}

export function capForEmail(email: string | null | undefined, raw = process.env.GEMINI_CAP_OVERRIDES, fallback = defaultCap()): number {
  if (!email) return fallback;
  return parseCapOverrides(raw).get(email.trim().toLowerCase()) ?? fallback;
}

const emailCache = new Map<string, string | null>();

async function capForUser(userId: string): Promise<number> {
  if (!process.env.GEMINI_CAP_OVERRIDES) return defaultCap();
  if (!emailCache.has(userId)) {
    try {
      const { data } = await createServerClient().auth.admin.getUserById(userId);
      emailCache.set(userId, data?.user?.email ?? null);
    } catch {
      return defaultCap();
    }
  }
  return capForEmail(emailCache.get(userId));
}
const LIVE_CHECK_COOLDOWN_SEC = 15;

export type UsageCheckResult =
  | { allowed: true }
  | { allowed: false; reason: "daily_limit" | "live_check_cooldown" | "usage_unavailable" };

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
    log.error("Usage fetch error:", fetchErr);
    // Fail closed — without a working counter we cannot enforce the cap.
    return { allowed: false, reason: "usage_unavailable" };
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
      log.error("Usage insert error:", insertErr);
      return { allowed: false, reason: "usage_unavailable" }; // fail closed
    }

    return { allowed: true };
  }

  // Check daily cap
  if (existing.gemini_calls >= (await capForUser(userId))) {
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
    log.error("Usage update error:", updateErr);
    return { allowed: false, reason: "usage_unavailable" }; // fail closed
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

  const cap = await capForUser(userId);
  return {
    callsToday: data?.gemini_calls ?? 0,
    dailyCap: cap,
    remaining: remainingCalls(data?.gemini_calls ?? 0, cap),
    lastLiveCheck: data?.last_live_check_at ?? null,
  };
}


/** Calls left today, never negative. */
export function remainingCalls(used: number, cap: number): number {
  const u = Number.isFinite(used) ? used : 0;
  return Math.max(0, cap - Math.max(0, u));
}
