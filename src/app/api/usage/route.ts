import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { getUsageStats } from "@/lib/usage";

// Today's AI-call budget for the signed-in user (drives the "AI calls left" pill).
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const s = await getUsageStats(auth.user.id);
  return NextResponse.json({ remaining: s.remaining, cap: s.dailyCap, used: s.callsToday });
}
