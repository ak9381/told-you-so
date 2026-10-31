import { NextRequest, NextResponse } from "next/server";
import { parseMeetingInput, InputSourceType } from "@/lib/parser";
import { extractMeetingItems, ExtractionError } from "@/lib/extractor";

export async function POST(request: NextRequest) {
  try {
    const { rawText, sourceType, userName, projectId } = await request.json();

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    const currentUserName = userName || "Akash";
    const { utterances, detectedType } = parseMeetingInput(
      rawText,
      sourceType as InputSourceType,
      currentUserName
    );

    // Call extractor — surface AI failures instead of masking them with fallback
    let extraction;
    try {
      extraction = await extractMeetingItems(
        rawText,
        "authenticated-user",
        currentUserName
      );
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

    return NextResponse.json({
      ok: true,
      detectedType,
      utterances,
      extraction,
      projectId,
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to process text" },
      { status: 500 }
    );
  }
}

