import { log } from "@/lib/log";
import { fetchWithRetry } from "@/lib/http";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, readJson, canAccessProject } from "@/lib/api-guard";
import { createServerClient } from "@/lib/supabase";
import { getProjectMemory } from "@/lib/agent";
import { checkAndIncrementUsage } from "@/lib/usage";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

// Cheap gate: only call Gemini when a chunk actually looks decision-like.
const DECISION_GATE =
  /\b(deadline|due|team|submit|submission|video|deploy|launch|must|let'?s|decide|decided|budget|price|pricing|scope|member|people|minute|min|hour|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|by\s+\d|\d+\s*(pm|am|min|minutes|members|people)|postgres|mongo|database|\bdb\b|polling|webhook|auth|clerk|jwt|switch|instead|go with|why are we)/i;

export interface LiveResult {
  quote: string;
  topic: string;
  verdict: "contradicts" | "refines" | "new";
  old_quote?: string;
  old_speaker?: string;
  speaker?: string;
  old_meeting_seq?: number;
  reasoning?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const parsed = await readJson(request, 50_000);
    if (parsed.error) return parsed.error;
    const { newText, projectId, demo } = parsed.body as { newText?: unknown; projectId?: unknown; demo?: unknown };
    if (typeof newText !== "string" || !newText.trim() || typeof projectId !== "string" || newText.length > 20_000) {
      return NextResponse.json({ skipped: true, results: [] });
    }

    // 1. Regex gate — skip Gemini entirely for small talk.
    if (!DECISION_GATE.test(newText)) {
      return NextResponse.json({ skipped: true, reason: "no_decision_words", results: [] });
    }

    // 2. Per-user rate limit (1 live-check / 15s, daily cap). The scripted demo
    //    clip is exempt — its lines fire faster than 15s on purpose.
    if (!(await canAccessProject(createServerClient(), projectId, auth.user.id))) {
      return NextResponse.json({ skipped: true, reason: "no_project", results: [] }, { status: 404 });
    }
    {
      // Demo clip skips the 15s spacing but still counts toward the daily AI cap.
      const usage = await checkAndIncrementUsage(auth.user.id, !demo);
      if (!usage.allowed) {
        return NextResponse.json({ skipped: true, reason: usage.reason, results: [] });
      }
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ skipped: true, reason: "no_key", results: [] });

    // 3. Inline the project memory and ask Gemini to extract + classify in one call.
    const memory = await getProjectMemory(projectId);
    const memList = memory.length
      ? memory
          .map(
            (m) =>
              `- [${m.topic}] "${m.exact_quote}" — ${m.speaker}, meeting #${m.meeting_seq}${
                m.said_at ? ` ${m.said_at}` : ""
              }`
          )
          .join("\n")
      : "(no prior decisions)";

    const prompt = `You monitor a live meeting and flag when someone contradicts a decision the team already agreed.

PRIOR agreed decisions (project memory):
${memList}

NEW lines just spoken in the meeting (lines may start with "Name:" — that is who said it):
"""
${newText}
"""

For each decision-like statement in the NEW lines, classify it against the MOST RELEVANT prior decision:
- "contradicts": directly conflicts with a prior decision (e.g. a different team size, moving a deadline to a LATER time or a different day, reversing a rule).
- "refines": a narrower/more specific version that still fits (e.g. "by 11 PM" or "by midnight" vs an agreed "by 11:59 PM tonight"; a tighter same-day deadline). NOT a contradiction.
- "new": a decision on something with no prior decision — INCLUDING assigning an owner or a task's own due time (e.g. "Priya owns the video, due 10:30 tonight"). A task's internal due time is NOT a contradiction of the overall submission deadline unless it is clearly AFTER that deadline.
Ignore small talk and lines with no decision. Be conservative: only mark "contradicts" when the conflict is clear.

Return ONLY JSON: {"results":[{"quote":"exact words from the new lines (without the Name: prefix)","speaker":"who said it, from the line's Name: prefix, else empty","topic":"one topic key","verdict":"contradicts|refines|new","old_quote":"the prior decision's quote if contradicts/refines else empty","old_speaker":"who said the prior decision (from project memory)","old_meeting_seq":0,"reasoning":"one short sentence"}]}`;

    const res = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      }
    );
    if (!res.ok) {
      return NextResponse.json({ skipped: true, reason: `gemini_${res.status}`, results: [] });
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    let out: { results?: unknown } = {};
    try {
      out = JSON.parse(text ?? "{}");
    } catch {
      return NextResponse.json({ skipped: true, reason: "bad_ai_json", results: [] });
    }
    const results: LiveResult[] = Array.isArray(out.results) ? (out.results as LiveResult[]) : [];

    return NextResponse.json({ skipped: false, results });
  } catch (e) {
    log.error("live-check error:", e);
    return NextResponse.json({ skipped: true, reason: "error", results: [] });
  }
}
