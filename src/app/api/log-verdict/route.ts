import { log } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireUser, readJson, jsonError } from "@/lib/api-guard";
import { flags } from "@/lib/flags";

// #4: log a tray verdict click as a labelled example. No-op unless
// FLAG_LOG_VERDICTS is on. Logging only — no training.
export async function POST(request: NextRequest) {
  if (!flags.logVerdicts) return NextResponse.json({ ok: true, logged: false });

  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const parsed = await readJson(request, 50_000);
  if (parsed.error) return parsed.error;
  const { oldDecisionId, newQuote, topic, verdict, confidence } = parsed.body as Record<string, unknown>;
  if (typeof verdict !== "string" || !["overrule", "pivot", "keep_old", "flag"].includes(verdict)) {
    return jsonError("verdict required", 400);
  }
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

  const supabase = createServerClient();
  const { error } = await supabase.from("verdict_logs").insert({
    user_id: auth.user.id,
    old_decision_id: typeof oldDecisionId === "string" && /^[0-9a-f-]{36}$/i.test(oldDecisionId) ? oldDecisionId : null,
    new_quote: str(newQuote, 2000),
    topic: str(topic, 200),
    verdict,
    confidence: typeof confidence === "number" && Number.isFinite(confidence) ? confidence : null,
  });
  if (error) {
    log.error("verdict log insert failed:", error.message);
    return NextResponse.json({ ok: true, logged: false });
  }
  return NextResponse.json({ ok: true, logged: true });
}
