import { log } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders";

// Cron endpoint (every minute). Protected by CRON_SECRET; the middleware also
// rejects it when CRON_SECRET is unset.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runReminders();
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (e) {
    log.error("cron runReminders failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "cron run failed" }, { status: 500 });
  }
}
