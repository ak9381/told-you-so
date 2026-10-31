import { NextRequest, NextResponse } from "next/server";
import { parseMeetingInput, InputSourceType } from "@/lib/parser";
import { extractMeetingItems, ExtractionError } from "@/lib/extractor";
import { runAgent, type AgentResult } from "@/lib/agent";
import { createClient } from "@supabase/supabase-js";

// Resolve the signed-in user's real UUID from the auth cookie so the Gemini
// usage cap tracks per actual user (middleware has already gated this route).
async function resolveUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get("sb-access-token")?.value;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await sb.auth.getUser(token);
  return data.user?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const { rawText, sourceType, userName, projectId } = await request.json();

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    const currentUserName = userName || "Akash";
    const userId =
      (await resolveUserId(request)) ?? "00000000-0000-0000-0000-000000000000";
    const { utterances, detectedType } = parseMeetingInput(
      rawText,
      sourceType as InputSourceType,
      currentUserName
    );

    // Call extractor — surface AI failures instead of masking them with fallback
    let extraction;
    try {
      extraction = await extractMeetingItems(rawText, userId, currentUserName);
    } catch (err) {
      const kind = err instanceof ExtractionError ? err.kind : "api_error";
      const message =
        err instanceof Error ? err.message : "AI extraction failed.";
      console.error("Extraction error:", err);
      return NextResponse.json(
        { error: message, aiError: true, kind, detectedType, utterances },
        { status: kind === "daily_limit" ? 429 : 502 }
      );
    }

    // Conflict-detection agent (MB3): check extracted decisions against memory.
    let agent: AgentResult | null = null;
    if (projectId && extraction.decisions.length > 0) {
      try {
        agent = await runAgent(extraction.decisions, projectId);
      } catch (e) {
        console.error("Agent error:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      detectedType,
      utterances,
      extraction,
      projectId,
      objections: agent?.objections ?? [],
      refinements: agent?.refinements ?? [],
      trace: agent?.trace ?? [],
      agentPath: agent?.path ?? null,
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to process text" },
      { status: 500 }
    );
  }
}

