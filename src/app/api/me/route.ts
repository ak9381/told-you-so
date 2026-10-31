import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/supabase-ssr";

// Returns the signed-in user's email, read server-side so the client never
// triggers its own token refresh (which would conflict with the middleware's
// refresh and sign the user out).
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  return NextResponse.json({ email: user?.email ?? null });
}
