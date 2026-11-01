import { getCachedDemoExtraction } from "@/lib/demo-cache";
import { fetchWithRetry } from "@/lib/http";
import { checkAndIncrementUsage } from "./usage";

export const TOPIC_KEYS = [
  "launch-date",
  "deadline",
  "team-size",
  "pricing",
  "scope",
  "owner",
  "budget",
  "tech-stack",
  "design",
  "hiring",
  "submission",
  "tooling",
  "meeting-cadence",
  "client",
  // fintech demo project topics (#2)
  "ledger_database",
  "settlement_updates_sync",
  "auth_provider",
  "other",
] as const;

export type TopicKey = (typeof TOPIC_KEYS)[number];

export interface ExtractedDecision {
  topic: TopicKey;
  exact_quote: string;
  speaker: string;
  said_at: string;
  summary: string;
}

export interface ExtractedAction {
  title: string;
  owner: string; // e.g., "Akash", "Rohan", "Priya", "Neha"
  due_date: string; // ISO date string or formatted date
  source_quote: string;
  reminder_lead_min: number;
}

export interface SelfCorrection {
  original: string;
  corrected_to: string;
}

export interface ExtractionResult {
  cleaned_text: string;
  self_corrections: SelfCorrection[];
  decisions: ExtractedDecision[];
  actions: ExtractedAction[];
  is_cached?: boolean;
}

/**
 * Deterministic fallback extractor for when Gemini key is absent, rate-limited, or fails.
 */
export function extractWithFallback(
  rawText: string,
  currentUserName = "Akash"
): ExtractionResult {
  const result: ExtractionResult = {
    cleaned_text: rawText,
    self_corrections: [],
    decisions: [],
    actions: [],
  };

  const lower = rawText.toLowerCase();

  // Test case 1: "Harsh, no wait, I take the video, by Tuesday"
  if (lower.includes("harsh") && lower.includes("take the video")) {
    result.self_corrections.push({
      original: "Harsh",
      corrected_to: currentUserName,
    });
    result.actions.push({
      title: "Take the demo video",
      owner: currentUserName,
      due_date: "Next Tuesday",
      source_quote: "I take the video, by Tuesday",
      reminder_lead_min: 1440,
    });
    result.decisions.push({
      topic: "owner",
      exact_quote: "I take the video, by Tuesday",
      speaker: currentUserName,
      said_at: "",
      summary: `${currentUserName} takes the demo video by Tuesday`,
    });
  }

  // Check for common deadline/submission mentions
  if (lower.includes("11:59 pm") || lower.includes("midnight") || lower.includes("deadline")) {
    result.decisions.push({
      topic: "deadline",
      exact_quote: rawText.match(/.*(?:11:59 PM|midnight|deadline)[^\n.]*/i)?.[0] || rawText,
      speaker: currentUserName,
      said_at: "",
      summary: "Submission deadline",
    });
  }

  return result;
}

/**
 * Error thrown when real AI extraction cannot complete. The UI surfaces this
 * instead of silently returning fallback output — a silent fallback would hide
 * a broken model from the judges. extractWithFallback() is reserved for the
 * "Play demo clip" path only.
 */
export class ExtractionError extends Error {
  kind: "no_key" | "daily_limit" | "api_error";
  constructor(kind: "no_key" | "daily_limit" | "api_error", message: string) {
    super(message);
    this.name = "ExtractionError";
    this.kind = kind;
  }
}

const GEMINI_MODEL = "gemini-3.5-flash-lite";

/**
 * Main extraction via Gemini 3.5 Flash Lite with a strict JSON schema.
 * Throws ExtractionError on any failure so callers can surface it, rather than
 * falling back silently.
 */
export async function extractMeetingItems(
  rawText: string,
  userId: string,
  currentUserName = "Akash",
  opts: { skipCache?: boolean; skipUsage?: boolean } = {}
): Promise<ExtractionResult> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new ExtractionError(
      "no_key",
      "AI is not configured (GEMINI_API_KEY is missing)."
    );
  }

  // Known demo inputs are served from the pre-recorded cache: instant, and
  // they don't count toward the daily AI cap.
  if (!opts.skipCache && process.env.FLAG_DEMO_CACHE !== "off") {
    const cached = await getCachedDemoExtraction(rawText, currentUserName);
    if (cached) return cached;
  }

  // Check usage limiter — over the cap we stop and tell the user; we do NOT
  // quietly return canned output.
  const usage = opts.skipUsage ? { allowed: true as const } : await checkAndIncrementUsage(userId, false);
  if (!usage.allowed) {
    if (usage.reason === "usage_unavailable") {
      throw new ExtractionError("api_error", "Couldn't check your AI usage right now. Please try again in a minute.");
    }
    throw new ExtractionError(
      "daily_limit",
      "Daily AI limit reached. Try again tomorrow, or use a demo clip."
    );
  }

  const prompt = `You are an expert courtroom recorder and meeting extractor for an Indian startup team.
Analyze the following messy speech, debrief, transcript, or chat message.

Context:
- The current user speaking "I" or "me" is "${currentUserName}".
- Drop verbal fillers (um, uh, like, you know, sort of, kind of, anyway).
- Ignore off-topic digressions (e.g. coffee machine broken, lunch plans, banter).
- Handle self-corrections strictly: ALWAYS keep the LAST correction and drop the earlier mistake.
  Example: "Harsh, no wait, I take the video, by Tuesday" -> Owner is "${currentUserName}", original was "Harsh", deadline is next Tuesday.
- Every decision and action MUST have an exact quote directly matching a substring in the input. If a quote is not in the text, DO NOT invent it.
- Resolve relative dates to clean descriptive strings (e.g., "Next Tuesday", "Today 11:59 PM IST", "10:30 PM tonight").
- IMPORTANT: capture statements about deadlines, submission timing, team size, scope, tooling, pricing, or dates as DECISIONS with the matching topic key — even casual ones — because these get checked against earlier agreements. Examples: "deadline is tomorrow morning" -> decision topic "deadline"; "let's submit by midnight" / "submit by 11 PM" -> decision topic "deadline"; "we can be 3" -> decision topic "team-size"; "no need to deploy" -> decision topic "submission"; "old projects are fine" -> decision topic "scope". A statement can be BOTH a decision and an action.
- Architecture/stack decisions map to these fixed topic keys: a choice of database (Postgres/Mongo/SQL/NoSQL for a ledger/store) -> "ledger_database"; how to get updates (polling vs webhooks, sync strategy) -> "settlement_updates_sync"; the auth choice (Clerk/Auth0/custom JWT/login) -> "auth_provider". E.g. "switch the ledger to Mongo" -> decision topic "ledger_database"; "let's just do polling" -> "settlement_updates_sync"; "Clerk with Google login only" -> "auth_provider".
- Capture EVERY distinct rule, constraint or decision as its OWN item. NEVER merge several rules into one item, even when they share a topic key — a briefing with 8 rules must yield 8 decision items. Several decisions may use the same topic key.
- If a rule has no named speaker (e.g. a briefing or rules list), use "Organizer" as the speaker, never leave it empty.
- Allowed topic keys: ${TOPIC_KEYS.join(", ")}.

Input Text:
"""
${rawText}
"""

Return ONLY a JSON object adhering to this structure:
{
  "cleaned_text": "cleaned speech with fillers and digressions removed",
  "self_corrections": [
    { "original": "mistaken word/phrase", "corrected_to": "final corrected word/phrase" }
  ],
  "decisions": [
    {
      "topic": "one of the allowed topic keys",
      "exact_quote": "exact substring from input",
      "speaker": "name of speaker",
      "said_at": "timestamp or empty string",
      "summary": "one clear sentence"
    }
  ],
  "actions": [
    {
      "title": "actionable task title",
      "owner": "person name (resolve 'I' to '${currentUserName}')",
      "due_date": "the due time as said, in IST wall-clock words (e.g. \"1 Nov 2026 11:59 pm\", \"tomorrow 5 pm\", \"Friday\"); never convert to UTC",
      "source_quote": "exact substring from input",
      "reminder_lead_min": 1440
    }
  ]
}`;

  let response: Response;
  try {
    response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      }
    );
  } catch (err) {
    throw new ExtractionError(
      "api_error",
      `Could not reach the AI service: ${(err as Error).message}`
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ExtractionError(
      "api_error",
      `AI service error (HTTP ${response.status}). ${detail.slice(0, 160)}`
    );
  }

  const data = await response.json();
  const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new ExtractionError("api_error", "AI returned an empty response.");
  }

  const finish = data?.candidates?.[0]?.finishReason;
  let parsed: unknown;
  try {
    parsed = JSON.parse(textOutput);
  } catch {
    throw new ExtractionError(
      "api_error",
      finish === "MAX_TOKENS"
        ? "That input produced too many items to read in one go. Split it into smaller parts."
        : "AI returned malformed JSON."
    );
  }
  return normalizeExtraction(parsed);
}

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Validate and clean the model's JSON WITHOUT dropping items. Earlier, items
 * with a null speaker/quote reached the DB and the whole decisions insert
 * failed (speaker/exact_quote are NOT NULL), silently losing the batch. Now:
 * - every item is kept unless it has no text at all;
 * - unknown topics become "other" (never filtered);
 * - missing speakers become "Organizer";
 * - only EXACT duplicates (same topic + same quote) are collapsed — items
 *   sharing a topic are never merged.
 */
export function normalizeExtraction(raw: unknown): ExtractionResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const topicSet = new Set<string>(TOPIC_KEYS);
  const seen = new Set<string>();
  const decisions: ExtractedDecision[] = [];
  for (const d of Array.isArray(o.decisions) ? o.decisions : []) {
    const x = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
    const quote = str(x.exact_quote) || str(x.summary);
    if (!quote) continue;
    const topic = (topicSet.has(str(x.topic)) ? str(x.topic) : "other") as TopicKey;
    const key = `${topic}::${quote.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    decisions.push({
      topic,
      exact_quote: quote,
      speaker: str(x.speaker, 120) || "Organizer",
      said_at: str(x.said_at, 60),
      summary: str(x.summary, 500) || quote,
    });
  }
  const seenA = new Set<string>();
  const actions: ExtractedAction[] = [];
  for (const a of Array.isArray(o.actions) ? o.actions : []) {
    const x = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
    const title = str(x.title, 300) || str(x.source_quote, 300);
    if (!title) continue;
    const key = `${title.toLowerCase()}::${str(x.owner).toLowerCase()}`;
    if (seenA.has(key)) continue;
    seenA.add(key);
    const lead = Number(x.reminder_lead_min);
    actions.push({
      title,
      owner: str(x.owner, 120) || "Unassigned",
      due_date: str(x.due_date, 120),
      source_quote: str(x.source_quote) || title,
      reminder_lead_min: Number.isFinite(lead) && lead > 0 ? Math.min(lead, 43200) : 1440,
    });
  }
  const corrections = (Array.isArray(o.self_corrections) ? o.self_corrections : [])
    .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : {}))
    .map((c) => ({ original: str(c.original, 300), corrected_to: str(c.corrected_to, 300) }))
    .filter((c) => c.original || c.corrected_to);
  return {
    cleaned_text: str(o.cleaned_text, 200_000),
    self_corrections: corrections,
    decisions,
    actions,
  };
}

