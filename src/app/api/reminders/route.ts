import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: implement runReminders() in a later stage
  return NextResponse.json({
    ok: true,
    message: "Reminders endpoint ready",
    timestamp: new Date().toISOString(),
  });
}

