import { log } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { createTask, updateNotionTaskStatus, updateNotionTaskOwner } from "@/lib/trackers";
import { requireUser, readJson, canAccessProject, canAccessAction, isUuid, jsonError } from "@/lib/api-guard";
import { logActivity } from "@/lib/activity";

// Supabase returns an embedded relation as an object or a 1-element array.
function one<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v ?? undefined;
}

// IDs of projects the user may see (own + legacy unowned seed rows).
async function myProjectIds(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const { data } = await supabase.from("projects").select("id").or(`user_id.eq.${userId},user_id.is.null`);
  return (data ?? []).map((p) => p.id as string);
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const supabase = createServerClient();
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (projectId && !(await canAccessProject(supabase, projectId, auth.user.id))) {
    return jsonError("Project not found.", 404);
  }
  const allowed = projectId ? [projectId] : await myProjectIds(supabase, auth.user.id);
  let aq = supabase
    .from("actions")
    .select(
      "id, title, owner, due_date, status, source_quote, reminder_lead_min, notion_page_id, project_id, meeting:meetings(title)"
    )
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  aq = aq.in("project_id", allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"]);
  const { data: actions, error: actErr } = await aq;
  if (actErr) {
    log.error("ledger fetch error:", actErr.message);
    return jsonError("Could not load tasks. Please refresh.", 500);
  }
  const actionIds = (actions ?? []).map((a) => a.id as string);
  const { data: notionLog } = actionIds.length
    ? await supabase
        .from("notion_log")
        .select("id, status, error, notion_page_id, action_id, created_at")
        .in("action_id", actionIds.slice(0, 500))
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
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
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const parsed = await readJson(request, 20_000);
  if (parsed.error) return parsed.error;
  const { actionId, status, fileNotion, owner, ownerId } = parsed.body as Record<string, unknown>;
  if (!isUuid(actionId)) return NextResponse.json({ error: "actionId required" }, { status: 400 });
  const supabase = createServerClient();
  if (!(await canAccessAction(supabase, actionId, auth.user.id))) {
    return jsonError("Task not found.", 404);
  }

  // Reassign the task owner.
  if (typeof owner === "string") {
    if (isUuid(ownerId)) {
      // The assignee must be on this task's project (or a legacy shared member).
      const { data: act } = await supabase.from("actions").select("project_id").eq("id", actionId).maybeSingle();
      const { data: person } = await supabase.from("people").select("project_id").eq("id", ownerId).maybeSingle();
      if (!person || (person.project_id && person.project_id !== act?.project_id)) {
        return jsonError("That person isn't on this project's team.", 400);
      }
    }
    const { data: updated, error } = await supabase
      .from("actions")
      .update({ owner: owner.slice(0, 120), owner_id: isUuid(ownerId) ? ownerId : null })
      .eq("id", actionId)
      .select("project_id, notion_page_id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // B5: keep the Notion page's Owner in sync (best-effort, reported back).
    let notionSynced: boolean | null = null;
    if (updated?.notion_page_id) {
      const r = await updateNotionTaskOwner(updated.notion_page_id, owner);
      notionSynced = r.ok;
      if (!r.ok) {
        log.warn("notion owner sync failed", { actionId, error: r.error });
        await supabase.from("notion_log").insert({ action_id: actionId, notion_page_id: updated.notion_page_id, status: "failed", error: `owner sync: ${r.error}` });
      }
    }
    await logActivity({
      userId: auth.user.id,
      projectId: updated?.project_id,
      kind: "task_reassigned",
      summary: `Reassigned task to ${owner.slice(0, 120)}`,
      data: { actionId, owner: owner.slice(0, 120) },
    });
    return NextResponse.json({ ok: true, notionSynced });
  }

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
  if (typeof status !== "string" || !["open", "done", "blocked"].includes(status)) {
    return NextResponse.json({ error: "bad status" }, { status: 400 });
  }
  const { error } = await supabase.from("actions").update({ status }).eq("id", actionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: act } = await supabase
    .from("actions")
    .select("project_id, notion_page_id")
    .eq("id", actionId)
    .maybeSingle();
  let notionSynced = false;
  let notionError: string | null = null;
  if (act?.notion_page_id) {
    const up = await updateNotionTaskStatus(act.notion_page_id, status);
    notionSynced = up.ok;
    notionError = up.error ?? null;
  }
  await logActivity({
    userId: auth.user.id,
    projectId: act?.project_id,
    kind: "task_status",
    summary: `Changed task status to ${status}`,
    data: { actionId, status },
  });
  return NextResponse.json({ ok: true, notionSynced, notionError });
}

// Remove a task.
export async function DELETE(request: NextRequest) {
  const actionId = new URL(request.url).searchParams.get("actionId");
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  if (!isUuid(actionId)) return NextResponse.json({ error: "actionId required" }, { status: 400 });
  const supabase = createServerClient();
  if (!(await canAccessAction(supabase, actionId, auth.user.id))) {
    return jsonError("Task not found.", 404);
  }
  const { data: act } = await supabase.from("actions").select("project_id, title").eq("id", actionId).maybeSingle();
  // Clear rows that reference this action first (avoid FK restrictions).
  await supabase.from("notion_log").delete().eq("action_id", actionId);
  await supabase.from("outbox").delete().eq("action_id", actionId);
  const { error } = await supabase.from("actions").delete().eq("id", actionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity({
    userId: auth.user.id,
    projectId: act?.project_id,
    kind: "task_removed",
    summary: `Removed task: ${act?.title || actionId}`,
    data: { actionId },
  });
  return NextResponse.json({ ok: true });
}
