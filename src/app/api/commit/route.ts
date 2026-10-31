import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const {
      projectId,
      meetingTitle,
      sourceType,
      rawText,
      utterances,
      decisions,
      actions,
    } = await request.json();

    if (!projectId || !meetingTitle) {
      return NextResponse.json(
        { error: "projectId and meetingTitle are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // 1. Get next seq for project
    const { data: latestMeeting } = await supabase
      .from("meetings")
      .select("seq")
      .eq("project_id", projectId)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSeq = (latestMeeting?.seq || 0) + 1;

    // 2. Insert Meeting
    const { data: meeting, error: meetingErr } = await supabase
      .from("meetings")
      .insert({
        project_id: projectId,
        seq: nextSeq,
        title: meetingTitle,
        source_type: sourceType || "debrief",
        raw_text: rawText,
      })
      .select()
      .single();

    if (meetingErr || !meeting) {
      console.error("Meeting insert failed:", meetingErr);
      return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
    }

    // 3. Insert Utterances
    if (utterances && Array.isArray(utterances) && utterances.length > 0) {
      const utteranceRows = utterances.map((u: { speaker: string; said_at: string; content: string }, idx: number) => ({
        meeting_id: meeting.id,
        speaker: u.speaker,
        said_at: u.said_at || "",
        content: u.content,
        seq: idx + 1,
      }));
      await supabase.from("utterances").insert(utteranceRows);
    }

    // 4. Insert Decisions
    if (decisions && Array.isArray(decisions) && decisions.length > 0) {
      const decisionRows = decisions.map((d: { topic: string; exact_quote: string; speaker: string; said_at: string }) => ({
        project_id: projectId,
        meeting_id: meeting.id,
        meeting_seq: nextSeq,
        topic: d.topic || "other",
        exact_quote: d.exact_quote,
        speaker: d.speaker,
        said_at: d.said_at || "",
        status: "active",
      }));
      await supabase.from("decisions").insert(decisionRows);
    }

    // 5. Insert Actions
    if (actions && Array.isArray(actions) && actions.length > 0) {
      const actionRows = actions.map((a: { title: string; owner: string; due_date: string; source_quote: string; reminder_lead_min: number }) => ({
        project_id: projectId,
        meeting_id: meeting.id,
        title: a.title,
        owner: a.owner,
        due_date: a.due_date ? new Date().toISOString() : null, // or resolved timestamp
        source_quote: a.source_quote,
        reminder_lead_min: a.reminder_lead_min || 1440,
        status: "open",
      }));
      await supabase.from("actions").insert(actionRows);
    }

    return NextResponse.json({
      ok: true,
      meetingId: meeting.id,
      meetingSeq: nextSeq,
      title: meetingTitle,
    });
  } catch (error) {
    console.error("Commit error:", error);
    return NextResponse.json(
      { error: "Failed to commit record" },
      { status: 500 }
    );
  }
}

