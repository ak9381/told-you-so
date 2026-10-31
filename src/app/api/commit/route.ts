import { log } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { createTask } from "@/lib/trackers";
import { resolveDue, isDemoProject } from "@/lib/dates";
import { requireUser, readJson, canAccessProject, jsonError } from "@/lib/api-guard";

interface ObjectionVerdict {
  oldDecisionId: string;
  oldQuote: string;
  oldSpeaker?: string;
  newQuote: string;
  newSpeaker?: string;
  verdict: "overrule" | "pivot" | "keep_old" | "flag";
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const parsed = await readJson(request, 2_000_000);
    if (parsed.error) return parsed.error;
    const {
      projectId,
      meetingTitle,
      sourceType,
      rawText,
      utterances,
      decisions,
      actions,
      objectionVerdicts,
      meetingDate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } = parsed.body as Record<string, any>;

    if (!projectId || !meetingTitle) {
      return NextResponse.json(
        { error: "projectId and meetingTitle are required" },
        { status: 400 }
      );
    }

    if (typeof projectId !== "string" || typeof meetingTitle !== "string") {
      return jsonError("projectId and meetingTitle must be strings", 400);
    }
    for (const [name, arr] of [["utterances", utterances], ["decisions", decisions], ["actions", actions], ["objectionVerdicts", objectionVerdicts]] as const) {
      if (arr != null && (!Array.isArray(arr) || arr.length > 2000)) {
        return jsonError(`${name} must be a list (max 2000 items)`, 400);
      }
    }

    const supabase = createServerClient();
    const userId = auth.user.id;
    if (!(await canAccessProject(supabase, projectId, userId))) {
      return jsonError("Project not found.", 404);
    }

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
        user_id: userId,
        seq: nextSeq,
        title: meetingTitle.slice(0, 200),
        meeting_date:
          typeof meetingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(meetingDate) && !isNaN(Date.parse(meetingDate))
            ? meetingDate
            : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
        source_type: sourceType || "debrief",
        raw_text: rawText,
      })
      .select()
      .single();

    if (meetingErr || !meeting) {
      log.error("Meeting insert failed:", meetingErr);
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
      const { error: uErr } = await supabase.from("utterances").insert(utteranceRows);
      if (uErr) log.error("utterances insert failed:", uErr.message);
    }

    // 4. Insert Decisions (capture ids so objection verdicts can supersede)
    const quoteToDecisionId: Record<string, string> = {};
    if (decisions && Array.isArray(decisions) && decisions.length > 0) {
      const decisionRows = decisions.map((d: { topic: string; exact_quote: string; speaker: string; said_at: string }) => ({
        project_id: projectId,
        meeting_id: meeting.id,
        meeting_seq: nextSeq,
        topic: d.topic || "other",
        exact_quote: (d.exact_quote || "").toString().slice(0, 2000) || "(no quote)",
        speaker: (d.speaker || "").toString().slice(0, 120) || "Organizer",
        said_at: d.said_at || "",
        status: "active",
      }));
      const { data: inserted, error: dErr } = await supabase
        .from("decisions")
        .insert(decisionRows)
        .select("id, exact_quote");
      if (dErr) {
        log.error("decisions insert failed:", dErr.message);
        return jsonError("Saved the meeting but could not save its decisions. Please try again.", 500);
      }
      for (const row of inserted ?? []) {
        quoteToDecisionId[row.exact_quote] = row.id;
      }
    }

    // 4b. Apply objection verdicts.
    if (objectionVerdicts && Array.isArray(objectionVerdicts)) {
      for (const ov of objectionVerdicts as ObjectionVerdict[]) {
        if (!ov.verdict) continue;
        const newDecisionId = quoteToDecisionId[ov.newQuote] ?? null;
        if (!newDecisionId) continue; // objections table requires both decision ids

        await supabase.from("objections").insert({
          project_id: projectId,
          old_decision_id: ov.oldDecisionId,
          new_decision_id: newDecisionId,
          old_quote: ov.oldQuote,
          new_quote: ov.newQuote,
          old_speaker: ov.oldSpeaker ?? null,
          new_speaker: ov.newSpeaker ?? null,
          verdict: ov.verdict,
        });

        if (ov.verdict === "overrule" || ov.verdict === "pivot") {
          // the new decision wins; the old one is struck through
          await supabase
            .from("decisions")
            .update({
              status: ov.verdict === "overrule" ? "overruled" : "superseded",
              superseded_by: newDecisionId,
            })
            .eq("id", ov.oldDecisionId)
            .eq("project_id", projectId);
        } else if (ov.verdict === "keep_old") {
          // the old decision stands; the new one is superseded
          await supabase
            .from("decisions")
            .update({ status: "superseded", superseded_by: ov.oldDecisionId })
            .eq("id", newDecisionId)
            .eq("project_id", projectId);
        }
      }
    }

    // 5. Insert Actions (resolved due dates) + best-effort Notion filing.
    const { data: proj } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();
    const projectName = proj?.name || "";
    const demo = isDemoProject(projectName);

    if (actions && Array.isArray(actions) && actions.length > 0) {
      const actionRows = actions.map(
        (a: { title: string; owner: string; due_date: string; source_quote: string; reminder_lead_min?: number }) => ({
          project_id: projectId,
          meeting_id: meeting.id,
          title: a.title,
          owner: a.owner,
          due_date: resolveDue(a.due_date),
          source_quote: a.source_quote,
          reminder_lead_min: a.reminder_lead_min ?? (demo ? 2 : 1440),
          status: "open",
        })
      );
      const { data: insertedActions, error: aErr } = await supabase
        .from("actions")
        .insert(actionRows)
        .select("id, title, owner, due_date, source_quote");
      if (aErr) log.error("actions insert failed:", aErr.message);

      // Best-effort: file each action in Notion; never block the ledger.
      for (const act of insertedActions ?? []) {
        const result = await createTask({
          title: act.title,
          owner: act.owner,
          due: act.due_date,
          status: "open",
          sourceQuote: act.source_quote,
          project: projectName,
          decisionId: act.id,
          meeting: meetingTitle,
        });
        if (result.ok) {
          await supabase.from("actions").update({ notion_page_id: result.id }).eq("id", act.id);
          await supabase.from("notion_log").insert({
            action_id: act.id,
            notion_page_id: result.id,
            status: "filed",
          });
        } else {
          await supabase.from("notion_log").insert({
            action_id: act.id,
            status: "failed",
            error: result.error,
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      meetingId: meeting.id,
      meetingSeq: nextSeq,
      title: meetingTitle,
    });
  } catch (error) {
    log.error("Commit error:", error);
    return NextResponse.json(
      { error: "Failed to commit record" },
      { status: 500 }
    );
  }
}

