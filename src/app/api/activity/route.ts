import { log } from "@/lib/log";
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

  let q = supabase
    .from("activity_log")
    .select("id, kind, summary, data, created_at, project_id, user_id")
    .order("created_at", { ascending: false })
    .limit(50);

  if (projectId) {
    q = q.eq("project_id", projectId);
  } else {
    q = q.eq("user_id", auth.user.id);
  }

  const { data, error } = await q;
  if (error) {
    log.warn("activity fetch error (table may not be migrated yet):", error.message);
    return NextResponse.json({ activities: [] });
  }

  return NextResponse.json({ activities: data ?? [] });
}
