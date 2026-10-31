import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getRequestUser } from "@/lib/supabase-ssr";
import { flags } from "@/lib/flags";

// #4: log a tray verdict click as a labelled example. No-op unless
// FLAG_LOG_VERDICTS is on. Logging only — no training.
export async function POST(request: NextRequest) {
  if (!flags.logVerdicts) return NextResponse.json({ ok: true, logged: false });

  const { oldDecisionId, newQuote, topic, verdict, confidence } = await request.json();
  if (!verdict) return NextResponse.json({ error: "verdict required" }, { status: 400 });

  const user = await getRequestUser(request);
  const supabase = createServerClient();
  await supabase.from("verdict_logs").insert({
    user_id: user?.id ?? null,
    old_decision_id: oldDecisionId ?? null,
    new_quote: newQuote ?? null,
    topic: topic ?? null,
    verdict,
    confidence: confidence ?? null,
  });
  return NextResponse.json({ ok: true, logged: true });
}
