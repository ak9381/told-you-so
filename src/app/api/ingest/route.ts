import { NextRequest, NextResponse } from "next/server";
import { parseMeetingInput, InputSourceType } from "@/lib/parser";
import { extractMeetingItems } from "@/lib/extractor";

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

    // Call extractor
    const extraction = await extractMeetingItems(
      rawText,
      "authenticated-user",
      currentUserName
    );

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

