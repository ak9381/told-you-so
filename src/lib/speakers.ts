// Live-meeting speaker attribution helpers (pure, unit-tested).

const INTRO_PATTERNS = [
  /\b(?:this is|it'?s|i am|i'm|hi,? (?:i'm|this is)|hey,? (?:i'm|this is))\s+([a-z][a-z'-]{1,30})\b/i,
  /^\s*(?:hi|hey|hello|okay|ok|so)?[,\s]*([a-z][a-z'-]{1,30})\s+here\b/i,
];

/**
 * A self-introduction cue ("Rohan here", "this is Akash", "hi, I'm Neha").
 * With a known team list, only those names count (case-insensitive) and the
 * team's spelling is returned; otherwise any capitalised-looking name is used.
 */
export function detectSelfIntro(text: string, team: string[] = []): string | null {
  for (const re of INTRO_PATTERNS) {
    const m = (text || "").match(re);
    if (!m) continue;
    const word = m[1];
    if (team.length) {
      const hit = team.find((n) => n.split(/\s+/)[0].toLowerCase() === word.toLowerCase());
      if (hit) return hit;
      continue;
    }
    if (/^(here|there|fine|done|ready|good|okay|ok|not|just|going|sure)$/i.test(word)) continue;
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  }
  return null;
}

/** Live lines as "Name: text" so the conflict checker knows who said what. */
export function linesWithSpeakers(lines: { speaker: string; text: string }[]): string {
  return lines.map((l) => (isKnownSpeaker(l.speaker) ? `${l.speaker}: ${l.text}` : l.text)).join("\n");
}

export const UNKNOWN_SPEAKER = "Speaker ?";
export function isKnownSpeaker(s?: string | null): boolean {
  const v = (s || "").trim();
  return !!v && v !== UNKNOWN_SPEAKER && v.toLowerCase() !== "speaker";
}

/** Who said a quote: the most recent live line that contains it (or that it contains). */
export function speakerForQuote(quote: string, lines: { speaker: string; text: string }[]): string | null {
  const q = (quote || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  if (!q) return null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].text.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    if (t && (t.includes(q) || q.includes(t)) && isKnownSpeaker(lines[i].speaker)) return lines[i].speaker;
  }
  return null;
}
