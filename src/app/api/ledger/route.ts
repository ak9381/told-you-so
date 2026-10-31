import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { createTask, updateNotionTaskStatus } from "@/lib/trackers";

// Supabase returns an embedded relation as an object or a 1-element array.
function one<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v ?? undefined;
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const projectId = new URL(request.url).searchParams.get("projectId");
  let aq = supabase
    .from("actions")
    .select(
      "id, title, owner, due_date, status, source_quote, reminder_lead_min, notion_page_id, project_id, meeting:meetings(title)"
    )
    .order("created_at", { ascending: false });
  if (projectId) aq = aq.eq("project_id", projectId);
  const { data: actions } = await aq;
  const { data: notionLog } = await supabase
    .from("notion_log")
    .select("id, status, error, notion_page_id, action_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const dbId = process.env.NOTION_DATABASE_ID;
  const notionDbUrl = dbId ? `https://www.notion.so/${dbId.replace(/-/g, "")}` : null;
  return NextResponse.json({
    actions: actions ?? [],
    notionLog: notionLog ?? [],
    notionDbUrl,
  });
}

// Update an action's status (syncs to Notion) OR file it to Notion on demand.
export async function POST(request: NextRequest) {
  const { actionId, status, fileNotion } = await request.json();
  if (!actionId) return NextResponse.json({ error: "actionId required" }, { status: 400 });
  const supabase = createServerClient();

  // "Send to Notion": file (or re-file) this task.
  if (fileNotion) {
    const { data: act } = await supabase
      .from("actions")
      .select(
        "id, title, owner, due_date, status, source_quote, project:projects(name), meeting:meetings(title)"
      )
      .eq("id", actionId)
      .maybeSingle();
    if (!act) return NextResponse.json({ error: "action not found" }, { status: 404 });
    const projName = one<{ name?: string }>(act.project as never)?.name ?? "";
    const mtg = one<{ title?: string }>(act.meeting as never)?.title ?? "";
    const result = await createTask({
      title: act.title,
      owner: act.owner ?? "",
      due: act.due_date,
      status: act.status || "open",
      sourceQuote: act.source_quote ?? "",
      project: projName,
      decisionId: act.id,
      meeting: mtg,
    });
    if (result.ok) {
      await supabase.from("actions").update({ notion_page_id: result.id }).eq("id", actionId);
      await supabase
        .from("notion_log")
        .insert({ action_id: actionId, notion_page_id: result.id, status: "filed" });
      return NextResponse.json({ ok: true, notion_page_id: result.id });
    }
    await supabase
      .from("notion_log")
      .insert({ action_id: actionId, status: "failed", error: result.error });
    return NextResponse.json({ error: result.error || "Notion filing failed" }, { status: 502 });
  }

  // Status update (+ real-time Notion sync if the task is filed).
  if (!["open", "done", "blocked"].includes(status)) {
    return NextResponse.json({ error: "bad status" }, { status: 400 });
  }
  const { error } = await supabase.from("actions").update({ status }).eq("id", actionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: act } = await supabase
    .from("actions")
    .select("notion_page_id")
    .eq("id", actionId)
    .maybeSingle();
  let notionSynced = false;
  let notionError: string | null = null;
  if (act?.notion_page_id) {
    const up = await updateNotionTaskStatus(act.notion_page_id, status);
    notionSynced = up.ok;
    notionError = up.error ?? null;
  }
  return NextResponse.json({ ok: true, notionSynced, notionError });
}
