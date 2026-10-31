import { NextRequest, NextResponse } from "next/server";
import { parseMeetingInput, InputSourceType } from "@/lib/parser";
import { extractMeetingItems, ExtractionError } from "@/lib/extractor";
import { runAgent, type AgentResult } from "@/lib/agent";
import { requireUser, readJson, canAccessProject, jsonError } from "@/lib/api-guard";
import { createServerClient } from "@/lib/supabase";
import { flags } from "@/lib/flags";
import { verifyExtraction, type Verification } from "@/lib/verifier";

const MAX_RAW_CHARS = 200_000;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const parsed = await readJson(request);
    if (parsed.error) return parsed.error;
    const { rawText, sourceType, userName, projectId } = parsed.body as {
      rawText?: unknown; sourceType?: unknown; userName?: unknown; projectId?: unknown;
    };

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return NextResponse.json({ error: "Please add some text to process." }, { status: 400 });
    }
    if (rawText.length > MAX_RAW_CHARS) {
      return jsonError("That's too long to process at once (max 200,000 characters). Split it into smaller parts.", 413);
    }
    if (projectId != null && (typeof projectId !== "string" || !(await canAccessProject(createServerClient(), projectId, auth.user.id)))) {
      return jsonError("Project not found.", 404);
    }

    const currentUserName = (typeof userName === "string" && userName.trim().slice(0, 80)) || "Akash";
    const userId = auth.user.id;
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

    // Conflict-detection agent (MB3) and extraction verification (#5) run in
    // parallel; neither may block the tray.
    const agentP: Promise<AgentResult | null> =
      typeof projectId === "string" && extraction.decisions.length > 0
        ? runAgent(extraction.decisions, projectId).catch((e) => {
            console.error("Agent error:", e);
            return null;
          })
        : Promise.resolve(null);
    const verifyP: Promise<Verification | null> = flags.verifyExtraction
      ? verifyExtraction(rawText, extraction, userId)
      : Promise.resolve(null);
    const [agent, verification] = await Promise.all([agentP, verifyP]);

    return NextResponse.json({
      ok: true,
      detectedType,
      utterances,
      extraction,
      projectId,
      objections: agent?.objections ?? [],
      maybes: agent?.maybes ?? [],
      refinements: agent?.refinements ?? [],
      trace: agent?.trace ?? [],
      agentPath: agent?.path ?? null,
      verification,
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to process text" },
      { status: 500 }
    );
  }
}

