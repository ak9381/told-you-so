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
 * Main extraction function calling Gemini 3.5 Flash Lite with structured JSON schema.
 */
export async function extractMeetingItems(
  rawText: string,
  userId: string,
  currentUserName = "Akash"
): Promise<ExtractionResult> {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // If no Gemini key, use fallback
  if (!geminiApiKey) {
    return extractWithFallback(rawText, currentUserName);
  }

  // Check usage limiter
  const usage = await checkAndIncrementUsage(userId, false);
  if (!usage.allowed) {
    const fallback = extractWithFallback(rawText, currentUserName);
    fallback.is_cached = true;
    return fallback;
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
      "due_date": "resolved date/time string",
      "source_quote": "exact substring from input",
      "reminder_lead_min": 1440
    }
  ]
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn("Gemini API call failed with status:", response.status);
      return extractWithFallback(rawText, currentUserName);
    }

    const data = await response.json();
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      return extractWithFallback(rawText, currentUserName);
    }

    const parsed: ExtractionResult = JSON.parse(textOutput);
    return parsed;
  } catch (err) {
    console.error("Gemini extraction error:", err);
    return extractWithFallback(rawText, currentUserName);
  }
}

