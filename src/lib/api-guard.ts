import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getRequestUser } from "@/lib/supabase-ssr";
import { isEmailAllowed } from "@/lib/allowlist";

export const MAX_BODY_BYTES = 1_000_000; // 1 MB

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

/** Defense in depth on top of middleware: signed-in + allowlisted, or a 401/403 response. */
export async function requireUser(
  request: NextRequest
): Promise<{ user: User; error?: undefined } | { user?: undefined; error: NextResponse }> {
  let user: User | null = null;
  try {
    user = await getRequestUser(request);
  } catch (e) {
    console.error("auth lookup failed:", e);
  }
  if (!user?.email) return { error: jsonError("Please sign in again.", 401) };
  if (!isEmailAllowed(user.email)) return { error: jsonError("This account is not on the access list.", 403) };
  return { user };
}

/** Parse a JSON body with a size cap. Returns null on invalid/oversized bodies. */
export async function readJson<T = Record<string, unknown>>(
  request: NextRequest,
  maxBytes = MAX_BODY_BYTES
): Promise<{ body: T; error?: undefined } | { body?: undefined; error: NextResponse }> {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > maxBytes) return { error: jsonError("That input is too large (max 1 MB).", 413) };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { error: jsonError("Could not read the request.", 400) };
  }
  if (text.length > maxBytes) return { error: jsonError("That input is too large (max 1 MB).", 413) };
  try {
    const body = JSON.parse(text || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return { body: body as T };
  } catch {
    return { error: jsonError("Invalid JSON body.", 400) };
  }
}

/**
 * True when the project belongs to the user. Legacy seeded rows with a null
 * user_id stay readable (see migration 004 backfill note).
 */
export async function canAccessProject(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<boolean> {
  if (!isUuid(projectId)) return false;
  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) {
    console.error("project access check failed:", error.message);
    return false;
  }
  return !!data && (data.user_id === null || data.user_id === userId);
}

/** True when the action's project belongs to the user. */
export async function canAccessAction(
  supabase: SupabaseClient,
  actionId: string,
  userId: string
): Promise<boolean> {
  if (!isUuid(actionId)) return false;
  const { data } = await supabase.from("actions").select("project_id").eq("id", actionId).maybeSingle();
  if (!data) return false;
  if (!data.project_id) return true;
  return canAccessProject(supabase, data.project_id, userId);
}
