import { log } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { parseMeetingInput, InputSourceType } from "@/lib/parser";
import { extractMeetingItems, ExtractionError } from "@/lib/extractor";
import { runAgent, type AgentResult } from "@/lib/agent";
import { requireUser, readJson, canAccessProject, jsonError } from "@/lib/api-guard";
import { createServerClient } from "@/lib/supabase";
import { flags } from "@/lib/flags";
import { verifyExtraction, type Verification } from "@/lib/verifier";

const MAX_RAW_CHARS = 200_000;

/** Who "I" is: the team member with this email, else the profile name, else the email handle. */
async function speakerNameFor(email: string, meta?: Record<string, unknown>): Promise<string> {
  if (email) {
    const { data } = await createServerClient()
      .from("people")
      .select("name")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (data?.name) return String(data.name);
  }
  const full = typeof meta?.full_name === "string" ? meta.full_name : typeof meta?.name === "string" ? meta.name : "";
  if (full.trim()) return full.trim().split(/\s+/)[0].slice(0, 80);
  const handle = email.split("@")[0].replace(/\+.*$/, "").replace(/[^a-zA-Z]/g, "");
  return handle ? handle.charAt(0).toUpperCase() + handle.slice(1) : "Me";
}

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

    const userId = auth.user.id;
    const currentUserName =
      (typeof userName === "string" && userName.trim().slice(0, 80)) ||
      (await speakerNameFor(auth.user.email ?? "", auth.user.user_metadata));
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
      log.error("Extraction error:", err);
      return NextResponse.json(
        { error: message, aiError: true, kind, detectedType, utterances },
        { status: kind === "daily_limit" ? 429 : 502 }
      );
    }

    // Extraction verification (#5) runs FIRST, then the conflict-detection
    // agent (MB3). Running them in parallel made them compete for the Worker's
    // per-request subrequest budget, and verify lost. Neither may block the tray.
    const verification: Verification | null = flags.verifyExtraction
      ? await verifyExtraction(rawText, extraction, userId)
      : null;
    const agent: AgentResult | null =
      typeof projectId === "string" && extraction.decisions.length > 0
        ? await runAgent(extraction.decisions, projectId, userId).catch((e) => {
            log.error("Agent error:", e);
            return null;
          })
        : null;

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
      agentNotes: agent?.notes ?? [],
      verification,
    });
  } catch (error) {
    log.error("Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to process text" },
      { status: 500 }
    );
  }
}

