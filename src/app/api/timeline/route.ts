import { log } from "@/lib/log";
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
    .select("id, topic, exact_quote, speaker, said_at, meeting_seq, status, superseded_by, meeting:meetings(meeting_date, title)")
    .eq("project_id", projectId)
    .order("topic", { ascending: true })
    .order("meeting_seq", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    log.error("timeline error:", error);
    return NextResponse.json({ decisions: [] }, { status: 500 });
  }
  const decisions = (data ?? []).map((d) => {
    const m = Array.isArray(d.meeting) ? d.meeting[0] : d.meeting;
    const { meeting: _m, ...rest } = d;
    void _m;
    const mm = m as { meeting_date?: string | null; title?: string | null } | null;
    return { ...rest, meeting_date: mm?.meeting_date ?? null, meeting_title: mm?.title ?? null };
  });
  return NextResponse.json({ decisions });
}
