import { log } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireUser, canAccessProject, jsonError } from "@/lib/api-guard";
import { friendlyEmailError } from "@/lib/email";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const supabase = createServerClient();
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (projectId && !(await canAccessProject(supabase, projectId, auth.user.id))) {
    return jsonError("Project not found.", 404);
  }
  let projectIds: string[] = projectId ? [projectId] : [];
  if (!projectId) {
    // No project filter → everything the caller owns (not other users' mail).
    const { data: projs } = await supabase
      .from("projects")
      .select("id")
      .or(`user_id.eq.${auth.user.id},user_id.is.null`);
    projectIds = (projs ?? []).map((p) => p.id as string);
  }

  // Project filter: reminders belong to the project via their action; digests
  // are per-person (not project-scoped), so we always include them.
  const { data: acts } = await supabase
    .from("actions")
    .select("id, owner")
    .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]);
  const ids = (acts ?? []).map((a) => a.id);
  const ownerById = new Map((acts ?? []).map((a) => [a.id as string, (a.owner as string | null) ?? null]));

  // Digests are per person: only show digests for people on the caller's projects.
  const { data: ppl } = await supabase
    .from("people")
    .select("name")
    .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]);
  const names = Array.from(new Set((ppl ?? []).map((p) => String(p.name)).filter((n) => /^[\w .'-]+$/.test(n))));
  const digestFilter = names.length ? `and(type.eq.digest,person_name.in.(${names.map((n) => `"${n}"`).join(",")}))` : "";

  let q = supabase
    .from("outbox")
    .select("id, type, action_id, person_name, subject, scheduled_at, sent_at, channel, status, error, resend_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const parts = [ids.length ? `action_id.in.(${ids.join(",")})` : "", digestFilter].filter(Boolean);
  if (!parts.length) return NextResponse.json({ outbox: [] });
  q = q.or(parts.join(","));

  const { data, error } = await q;
  if (error) {
    log.error("outbox fetch error:", error.message);
    return jsonError("Could not load reminders. Please refresh.", 500);
  }
  // Show the task's CURRENT owner (it may have been reassigned after the
  // reminder was queued), and never the raw provider error.
  const rows = (data ?? []).map((r) => {
    const owner = r.action_id ? ownerById.get(r.action_id as string) : null;
    const { action_id: _a, error: rawErr, ...rest } = r;
    void _a;
    return {
      ...rest,
      person_name: owner && owner.toLowerCase() !== "unassigned" ? owner : r.person_name,
      status: r.status === "SENT" && rawErr ? "FAILED" : r.status,
      error: rawErr ? friendlyEmailError(rawErr as string) : null,
    };
  });
  return NextResponse.json({ outbox: rows });
}
