import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireUser, canAccessProject } from "@/lib/api-guard";

// Decision spine for a project: all decisions grouped by topic, newest first,
// with their status (active / superseded / overruled) so the UI can strike
// through the ones that were ruled against.
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ decisions: [] });

  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const supabase = createServerClient();
  if (!(await canAccessProject(supabase, projectId, auth.user.id))) {
    return NextResponse.json({ decisions: [], error: "Project not found." }, { status: 404 });
  }
  const { data, error } = await supabase
    .from("decisions")
    .select("id, topic, exact_quote, speaker, said_at, meeting_seq, status")
    .eq("project_id", projectId)
    .order("topic", { ascending: true })
    .order("meeting_seq", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("timeline error:", error);
    return NextResponse.json({ decisions: [] }, { status: 500 });
  }
  return NextResponse.json({ decisions: data ?? [] });
}
