import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireUser, canAccessProject, jsonError } from "@/lib/api-guard";

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
    .select("id")
    .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]);
  const ids = (acts ?? []).map((a) => a.id);

  let q = supabase
    .from("outbox")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  q = ids.length ? q.or(`action_id.in.(${ids.join(",")}),type.eq.digest`) : q.eq("type", "digest");

  const { data, error } = await q;
  if (error) {
    console.error("outbox fetch error:", error.message);
    return jsonError("Could not load reminders. Please refresh.", 500);
  }
  return NextResponse.json({ outbox: data ?? [] });
}
