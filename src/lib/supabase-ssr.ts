import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client (login page). Manages the auth cookies itself.
export function createBrowserSupabase() {
  return createBrowserClient(URL(), ANON());
}

// Middleware: refresh the session on EVERY request so tokens never silently
// expire (the fix for the 1-hour logout). Returns the response carrying any
// refreshed cookies, plus the current user.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(URL(), ANON(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });
  // Perf: getClaims() verifies the access-token JWT locally (asymmetric signing
  // keys; JWKS cached per isolate) instead of a network call to the Auth server
  // on every request. It only refreshes (network) when the token is expired or
  // near expiry, writing fresh cookies via setAll above. On legacy HS256
  // projects supabase-js falls back to getUser() internally, so it is never
  // less secure than before.
  const user = await claimsUser(supabase);
  return { response, user };
}

export interface AuthUser {
  id: string;
  email: string | null;
}

type SsrClient = ReturnType<typeof createServerClient>;

async function claimsUser(supabase: SsrClient): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const c = data.claims as { sub: string; email?: string };
  return { id: c.sub, email: c.email ?? null };
}

// Per-request cache so several guards in one request verify the JWT once.
const requestUserCache = new WeakMap<NextRequest, Promise<AuthUser | null>>();

// Route handlers: the signed-in user from the (already-refreshed) request
// cookies, verified via JWT signature (getClaims). Authorization in each route
// still checks project/action ownership against the DB.
export function getRequestUser(request: NextRequest): Promise<AuthUser | null> {
  let p = requestUserCache.get(request);
  if (!p) {
    const supabase = createServerClient(URL(), ANON(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /* no-op: middleware already refreshed */
        },
      },
    });
    p = claimsUser(supabase);
    requestUserCache.set(request, p);
  }
  return p;
}

// Server components (pages): read the signed-in user from request cookies.
export async function getPageUser(): Promise<AuthUser | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const supabase = createServerClient(URL(), ANON(), {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll() {
        /* read-only in server components */
      },
    },
  });
  return claimsUser(supabase);
}
