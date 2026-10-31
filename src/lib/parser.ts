export interface ParsedUtterance {
  speaker: string;
  said_at: string; // "mm:ss" or time string
  content: string;
  seq: number;
}

export type InputSourceType = "transcript" | "whatsapp" | "debrief" | "chat";

/**
 * Parses raw text from transcripts, WhatsApp exports (iOS & Android formats),
 * Slack/Google Chat lines ("Name: text"), or spoken debriefs.
 */
export function parseMeetingInput(
  rawText: string,
  sourceType?: InputSourceType,
  currentUserName: string = "Akash"
): { utterances: ParsedUtterance[]; detectedType: InputSourceType } {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const utterances: ParsedUtterance[] = [];

  if (lines.length === 0) {
    return { utterances: [], detectedType: sourceType || "debrief" };
  }

  // Regex patterns
  // 1. Transcript: [mm:ss] Speaker Name: Text OR [hh:mm:ss] Speaker: Text
  const transcriptRegex = /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*([^:]+):\s*(.+)$/i;

  // 2. WhatsApp iOS: [DD/MM/YY, h:mm:ss AM/PM] Name: Text or [DD/MM/YYYY, ...]
  const waIosRegex = /^\[\d{1,2}\/\d{1,2}\/\d{2,4},\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\]\s*([^:]+):\s*(.+)$/i;

  // 3. WhatsApp Android: DD/MM/YY, h:mm - Name: Text or DD/MM/YYYY, HH:mm - Name: Text
  const waAndroidRegex = /^\d{1,2}\/\d{1,2}\/\d{2,4},\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|am|pm))?)\s*-\s*([^:]+):\s*(.+)$/i;

  // 4. Slack / Google Chat / Generic: Name: Text
  const genericChatRegex = /^([A-Z][a-zA-Z0-9_\s]{1,30}):\s*(.+)$/;

  // Check system lines to ignore in WhatsApp
  const isWaSystemLine = (text: string) => {
    return (
      text.includes("Messages and calls are end-to-end encrypted") ||
      text.includes("Messages are end-to-end encrypted") ||
      text.includes("<Media omitted>") ||
      text.includes("image omitted") ||
      text.includes("video omitted") ||
      text.includes("audio omitted")
    );
  };

  // Determine detected type if not explicitly forced
  let detectedType: InputSourceType = sourceType || "debrief";
  if (!sourceType) {
    const firstNonEmpty = lines.find((l) => !isWaSystemLine(l)) || lines[0];
    if (waIosRegex.test(firstNonEmpty) || waAndroidRegex.test(firstNonEmpty)) {
      detectedType = "whatsapp";
    } else if (transcriptRegex.test(firstNonEmpty)) {
      detectedType = "transcript";
    } else if (lines.length > 0 && lines.every((l) => genericChatRegex.test(l))) {
      detectedType = "chat";
    } else {
      detectedType = "debrief";
    }
  }

  let seq = 1;
  for (const line of lines) {
    if (isWaSystemLine(line)) continue;

    // Try WhatsApp iOS
    const matchIos = line.match(waIosRegex);
    if (matchIos) {
      utterances.push({
        said_at: matchIos[1].trim(),
        speaker: matchIos[2].trim(),
        content: matchIos[3].trim(),
        seq: seq++,
      });
      continue;
    }

    // Try WhatsApp Android
    const matchAndroid = line.match(waAndroidRegex);
    if (matchAndroid) {
      utterances.push({
        said_at: matchAndroid[1].trim(),
        speaker: matchAndroid[2].trim(),
        content: matchAndroid[3].trim(),
        seq: seq++,
      });
      continue;
    }

    // Try Transcript [mm:ss] Speaker: Text
    const matchTrans = line.match(transcriptRegex);
    if (matchTrans) {
      utterances.push({
        said_at: matchTrans[1].trim(),
        speaker: matchTrans[2].trim(),
        content: matchTrans[3].trim(),
        seq: seq++,
      });
      continue;
    }

    // Try Generic Chat "Speaker: Text"
    const matchChat = line.match(genericChatRegex);
    if (matchChat && (detectedType === "chat" || detectedType === "transcript")) {
      utterances.push({
        said_at: "",
        speaker: matchChat[1].trim(),
        content: matchChat[2].trim(),
        seq: seq++,
      });
      continue;
    }

    // Otherwise, treat as debrief line or continuation
    if (detectedType === "debrief") {
      utterances.push({
        said_at: "",
        speaker: currentUserName,
        content: line,
        seq: seq++,
      });
    } else if (utterances.length > 0) {
      // Append multi-line message to the previous utterance
      utterances[utterances.length - 1].content += "\n" + line;
    }
  }

  return { utterances, detectedType };
}
