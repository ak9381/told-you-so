import { log } from "@/lib/log";
import { findDuplicate } from "@/lib/people";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireUser, readJson, jsonError, canAccessProject } from "@/lib/api-guard";
import { logActivity } from "@/lib/activity";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Team members PER PROJECT (migration 005). Legacy members with no project
// (project_id IS NULL) stay visible everywhere until they're assigned.
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const projectId = request.nextUrl.searchParams.get("projectId");
  const supabase = createServerClient();
  if (!projectId) return NextResponse.json({ people: [] });
  if (!(await canAccessProject(supabase, projectId, auth.user.id))) return jsonError("Project not found.", 404);
  const { data, error } = await supabase
    .from("people")
    .select("id, name, email, project_id")
    .or(`project_id.eq.${projectId},project_id.is.null`)
    .order("created_at", { ascending: true });
  if (error) {
    log.error("people fetch failed:", error.message);
    return jsonError("Could not load team members.", 500);
  }
  return NextResponse.json({ people: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const parsed = await readJson(request, 10_000);
  if (parsed.error) return parsed.error;
  const { name, email, projectId } = parsed.body as Record<string, unknown>;
  const clean = (typeof name === "string" ? name : "").trim().slice(0, 80);
  if (!clean) return jsonError("A name is required", 400);
  if (typeof projectId !== "string") return jsonError("Pick a project first.", 400);
  const supabase = createServerClient();
  if (!(await canAccessProject(supabase, projectId, auth.user.id))) return jsonError("Project not found.", 404);

  const cleanEmail = (typeof email === "string" ? email : "").trim().slice(0, 254) || null;
  if (cleanEmail && !EMAIL_RE.test(cleanEmail)) return jsonError("That email address doesn't look right.", 400);

  // Block duplicates (same name or same email) among the people this project
  // can see, including legacy shared members. Pass update:true to change the
  // email of an existing member of this project.
  const { update } = parsed.body as Record<string, unknown>;
  const { data: team } = await supabase
    .from("people")
    .select("id, name, email, project_id")
    .or(`project_id.eq.${projectId},project_id.is.null`);
  const dup = findDuplicate(team ?? [], clean, cleanEmail);
  if (dup) {
    if (update === true && dup.field === "name" && dup.person.project_id === projectId) {
      const { data, error } = await supabase
        .from("people")
        .update({ email: cleanEmail })
        .eq("id", dup.person.id)
        .select("id, name, email, project_id")
        .single();
      if (error) return jsonError("Could not update this person.", 500);
      return NextResponse.json({ person: data, updated: true });
    }
    return jsonError(
      dup.field === "name"
        ? `${dup.person.name} is already on the team.`
        : `${cleanEmail} already belongs to ${dup.person.name}.`,
      409
    );
  }

  const { data, error } = await supabase
    .from("people")
    .insert({ name: clean, email: cleanEmail, project_id: projectId })
    .select("id, name, email, project_id")
    .single();
  if (error) {
    log.error("people insert failed:", error.message);
    return jsonError("Could not add this person.", 500);
  }
  await logActivity({
    userId: auth.user.id,
    projectId,
    kind: "member_added",
    summary: `Added ${clean} to the team`,
    data: { personId: data.id, name: clean, email: cleanEmail },
  });
  return NextResponse.json({ person: data });
}
