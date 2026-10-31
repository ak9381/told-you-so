import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Routes that don't require auth
const PUBLIC_ROUTES = ["/login", "/api/reminders", "/api/digest"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isCronRoute(pathname: string): boolean {
  return pathname === "/api/reminders" || pathname === "/api/digest";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next();
  }

  // Cron routes: authenticate via CRON_SECRET header
  if (isCronRoute(pathname)) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return NextResponse.next();
    }
    // Also allow if no cron secret is set (during dev)
    if (!cronSecret) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Public routes don't need auth
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check for Supabase auth token in cookies
  const accessToken = request.cookies.get("sb-access-token")?.value;
  const refreshToken = request.cookies.get("sb-refresh-token")?.value;

  if (!accessToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify the token with Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user?.email) {
    // Try refresh
    if (refreshToken) {
      const { data: refreshData } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (refreshData.session && refreshData.user?.email) {
        // Check allowlist
        const allowed = isEmailInAllowlist(refreshData.user.email);
        if (!allowed) {
          return NextResponse.redirect(
            new URL("/login?error=not_allowed", request.url)
          );
        }
        // Set refreshed cookies
        const response = NextResponse.next();
        response.cookies.set("sb-access-token", refreshData.session.access_token, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60, // 1 hour
        });
        response.cookies.set("sb-refresh-token", refreshData.session.refresh_token, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
        return response;
      }
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check allowlist
  const allowed = isEmailInAllowlist(user.email);
  if (!allowed) {
    return NextResponse.redirect(
      new URL("/login?error=not_allowed", request.url)
    );
  }

  return NextResponse.next();
}

function isEmailInAllowlist(email: string): boolean {
  const raw = process.env.ALLOWED_EMAILS || "";
  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (list.length > 5) {
    console.error("ALLOWED_EMAILS has more than 5 entries — refusing access");
    return false;
  }

  return list.includes(email.toLowerCase());
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

