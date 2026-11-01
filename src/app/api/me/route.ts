import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/supabase-ssr";
import { reminderInbox } from "@/lib/email";

// Returns the signed-in user's email, read server-side so the client never
// triggers its own token refresh (which would conflict with the middleware's
// refresh and sign the user out).
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  // reminderTo: the verified inbox reminder emails are delivered to (shown in the UI).
  return NextResponse.json({ email: user?.email ?? null, reminderTo: user ? reminderInbox() : null });
}
