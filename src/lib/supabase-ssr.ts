import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";

const URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client (login page). Manages the auth cookies itself.
export function createBrowserSupabase() {
  return createBrowserClient(URL(), ANON());
}

// Proactive refresh margin: 5 minutes in milliseconds
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Middleware: avoid an external Supabase network round-trip on every request.
// Reads session locally from cookies using getSession(). Only calls refreshSession()
// when the access token is near expiry (< 5 minutes).
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

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    return { response, user: null };
  }

  let activeUser: User | null = session.user;
  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  const now = Date.now();

  // If the access token is near expiry (< 5 min) and we have a refresh token, refresh it.
  if (expiresAt && expiresAt - now < REFRESH_MARGIN_MS && session.refresh_token) {
    try {
      const { data: refreshData } = await supabase.auth.refreshSession({
        refresh_token: session.refresh_token,
      });
      if (refreshData?.session?.user) {
        activeUser = refreshData.session.user;
      }
    } catch {
      if (expiresAt <= now) {
        activeUser = null;
      }
    }
  }

  return { response, user: activeUser };
}

// Per-request cache for route handlers (WeakMap keyed by NextRequest)
const requestUserCache = new WeakMap<NextRequest, Promise<User | null>>();

// Route handlers: read the signed-in user with per-request caching.
// Deduplicates lookups within the same request lifecycle.
export async function getRequestUser(request: NextRequest): Promise<User | null> {
  const cached = requestUserCache.get(request);
  if (cached) return cached;

  const promise = (async () => {
    const supabase = createServerClient(URL(), ANON(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /* no-op: middleware already refreshed cookies if needed */
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  })();

  requestUserCache.set(request, promise);
  return promise;
}

// Server components (pages): read the signed-in user from request cookies.
// Uses React cache() to deduplicate lookups across a single server render.
export const getPageUser = cache(async (): Promise<User | null> => {
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
