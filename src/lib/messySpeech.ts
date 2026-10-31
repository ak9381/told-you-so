/**
 * Clean and structure messy spoken text.
 * Highlights fillers in grey and wraps corrected words with strikethrough.
 */

export interface TokenPart {
  text: string;
  isFiller?: boolean;
  isStrikethrough?: boolean;
}

const COMMON_FILLERS = new Set([
  "um",
  "uh",
  "like",
  "er",
  "ah",
  "you know",
  "i mean",
  "sort of",
  "kind of",
  "basically",
  "actually",
  "anyway",
  "anyways",
]);

/**
 * Parses raw messy speech into visual tokens (fillers greyed, corrected words struck through).
 * For example: "Harsh, no wait, I take the video, by Tuesday"
 * "Harsh" -> struck through
 * "no wait" -> struck through / filler
 */
export function formatSpokenTokens(rawText: string): TokenPart[] {
  const result: TokenPart[] = [];
  const correctionPattern = /\b([A-Za-z0-9_]+),?\s*(?:no wait|wait|scratch that),?\s*/gi;
  
  let match: RegExpExecArray | null;

  while ((match = correctionPattern.exec(rawText)) !== null) {
    const fullMatch = match[0];
    const struckWord = match[1];
    const matchIndex = match.index;

    // Push preceding text
    const before = rawText.substring(result.reduce((acc, t) => acc + t.text.length, 0), matchIndex);
    if (before) {
      pushTokensWithFillers(before, result);
    }

    // Struck word
    result.push({ text: struckWord, isStrikethrough: true });
    // The phrase "no wait" / "wait"
    const fillerPhrase = fullMatch.substring(struckWord.length);
    result.push({ text: fillerPhrase, isFiller: true });
  }

  const processedLen = result.reduce((acc, t) => acc + t.text.length, 0);
  if (processedLen < rawText.length) {
    pushTokensWithFillers(rawText.substring(processedLen), result);
  }

  return result;
}

function pushTokensWithFillers(text: string, list: TokenPart[]) {
  const parts = text.split(/(\s+|[.,!?;]+)/);
  for (const part of parts) {
    if (!part) continue;
    const cleanWord = part.trim().toLowerCase();
    if (COMMON_FILLERS.has(cleanWord)) {
      list.push({ text: part, isFiller: true });
    } else {
      list.push({ text: part });
    }
  }
}
