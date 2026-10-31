import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const projectId = new URL(request.url).searchParams.get("projectId");

  // No project filter → everything.
  if (!projectId) {
    const { data } = await supabase
      .from("outbox")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ outbox: data ?? [] });
  }

  // Project filter: reminders belong to the project via their action; digests
  // are per-person (not project-scoped), so we always include them.
  const { data: acts } = await supabase
    .from("actions")
    .select("id")
    .eq("project_id", projectId);
  const ids = (acts ?? []).map((a) => a.id);

  let q = supabase
    .from("outbox")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  q = ids.length ? q.or(`action_id.in.(${ids.join(",")}),type.eq.digest`) : q.eq("type", "digest");

  const { data } = await q;
  return NextResponse.json({ outbox: data ?? [] });
}
