import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  const { data: actions } = await supabase
    .from("actions")
    .select(
      "id, title, owner, due_date, status, source_quote, reminder_lead_min, notion_page_id, meeting:meetings(title)"
    )
    .order("created_at", { ascending: false });
  const { data: notionLog } = await supabase
    .from("notion_log")
    .select("id, status, error, notion_page_id, action_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ actions: actions ?? [], notionLog: notionLog ?? [] });
}

// Update an action's status (one-tap open/done/blocked).
export async function POST(request: NextRequest) {
  const { actionId, status } = await request.json();
  if (!actionId || !["open", "done", "blocked"].includes(status)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const supabase = createServerClient();
  const { error } = await supabase.from("actions").update({ status }).eq("id", actionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
