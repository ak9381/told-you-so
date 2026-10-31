import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-ssr";

// /api/auth/* handles sign-in itself; cron routes authenticate with CRON_SECRET.
const PUBLIC_ROUTES = ["/login", "/welcome", "/api/auth", "/api/reminders", "/api/digest", "/api/health"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}
function isCronRoute(pathname: string): boolean {
  return pathname === "/api/reminders" || pathname === "/api/digest";
}

function isEmailInAllowlist(email: string): boolean {
  const list = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length > 5) {
    console.error("ALLOWED_EMAILS has more than 5 entries — refusing access");
    return false;
  }
  return list.includes(email.toLowerCase());
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next();
  }

  // Cron routes: authenticate via CRON_SECRET; reject when it is unset.
  if (isCronRoute(pathname)) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
    }
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isPublicRoute(pathname)) return NextResponse.next();

  // Protected routes: refresh the Supabase session on every request (fixes the
  // 1-hour logout), then enforce the allowlist.
  const { response, user } = await updateSession(request);
  const isApi = pathname.startsWith("/api/");
  if (!user?.email) {
    if (isApi) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!isEmailInAllowlist(user.email)) {
    if (isApi) return NextResponse.json({ error: "This account is not on the access list." }, { status: 403 });
    return NextResponse.redirect(new URL("/login?error=not_allowed", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
