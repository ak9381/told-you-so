import { log } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireUser, readJson, jsonError, canAccessProject } from "@/lib/api-guard";

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

  // Avoid duplicates by name within the project — update the email instead.
  const { data: existing } = await supabase
    .from("people")
    .select("id")
    .eq("project_id", projectId)
    .ilike("name", clean)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("people")
      .update({ email: cleanEmail })
      .eq("id", existing.id)
      .select("id, name, email, project_id")
      .single();
    if (error) return jsonError("Could not update this person.", 500);
    return NextResponse.json({ person: data });
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
  return NextResponse.json({ person: data });
}
