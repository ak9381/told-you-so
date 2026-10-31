import { log } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { runDigests } from "@/lib/digest";

// Cron endpoint (Mondays 09:00 IST). Protected by CRON_SECRET.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDigests();
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (e) {
    log.error("cron runDigests failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "cron run failed" }, { status: 500 });
  }
}
