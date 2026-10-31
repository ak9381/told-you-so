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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { response, user };
}

// Route handlers: read the signed-in user from the (already-refreshed) request
// cookies. Middleware has run first and set fresh cookies on the request.
export async function getRequestUser(request: NextRequest) {
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
