import { log } from "@/lib/log";
import { fetchWithRetry } from "@/lib/http";
import { checkAndIncrementUsage } from "@/lib/usage";
import type { ExtractionResult } from "@/lib/extractor";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

export interface ItemCheck {
  kind: "decision" | "action";
  index: number;
  confidence: number; // 0..1
  quote_found: boolean;
  reason: string;
}

export interface Verification {
  status: "verified" | "not_verified";
  reason?: string; // why it is not verified (limit, timeout, error…)
  overall: number | null; // 0..1
  items: ItemCheck[];
  missed: string[]; // decisions/actions present in the text but not extracted
}

const NOT_VERIFIED = (reason: string): Verification => ({
  status: "not_verified",
  reason,
  overall: null,
  items: [],
  missed: [],
});

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clamp01 = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Cheap deterministic check: is the quote literally (modulo punctuation) in the text? */
export function quoteInText(quote: string, rawText: string): boolean {
  const q = norm(quote || "");
  return q.length > 0 && norm(rawText).includes(q);
}

/**
 * Second Gemini pass: checks each extracted item against the source text.
 * Never throws — on any failure returns status "not_verified" so the user can
 * still confirm. Counts against the per-user daily AI cap.
 */
export async function verifyExtraction(
  rawText: string,
  extraction: ExtractionResult,
  userId: string
): Promise<Verification> {
  const decisions = extraction.decisions ?? [];
  const actions = extraction.actions ?? [];
  if (decisions.length + actions.length === 0) {
    return { status: "verified", overall: 1, items: [], missed: [] };
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NOT_VERIFIED("AI key not configured");

  try {
    const usage = await checkAndIncrementUsage(userId, false);
    if (!usage.allowed) return NOT_VERIFIED("Daily AI limit reached");

    const items = [
      ...decisions.map((d, i) => ({ kind: "decision", index: i, quote: d.exact_quote, speaker: d.speaker, summary: d.summary })),
      ...actions.map((a, i) => ({ kind: "action", index: i, quote: a.source_quote, owner: a.owner, due: a.due_date, title: a.title })),
    ];
    const prompt = `You are a strict fact-checker. Compare each EXTRACTED item with the SOURCE text.
For each item judge: is the quote actually present (verbatim or near-verbatim) in the source? Are speaker / owner / due date faithful to the source (respecting self-corrections: the LAST correction wins)? Is anything hallucinated?
Also list important decisions or action items in the source that were NOT extracted.

SOURCE:
"""
${rawText.slice(0, 60_000)}
"""

EXTRACTED ITEMS:
${JSON.stringify(items)}

Return ONLY JSON:
{"items":[{"kind":"decision|action","index":0,"confidence":0.0,"quote_found":true,"reason":"max 15 words"}],"missed":["short description"],"overall":0.0}
confidence is 0-1: 1 = fully faithful, below 0.6 = likely wrong or hallucinated.`;

    const res = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      },
      { timeoutMs: 12_000, retries: 1, label: "gemini-verify" }
    );
    if (!res.ok) return NOT_VERIFIED(`AI check failed (HTTP ${res.status})`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text ?? "{}") as { items?: unknown; missed?: unknown; overall?: unknown };

    const out: ItemCheck[] = [];
    for (const raw of Array.isArray(parsed.items) ? parsed.items : []) {
      const r = raw as Record<string, unknown>;
      const kind = r.kind === "action" ? "action" : r.kind === "decision" ? "decision" : null;
      const index = typeof r.index === "number" ? r.index : -1;
      const src = kind === "decision" ? decisions[index] : kind === "action" ? actions[index] : undefined;
      if (!kind || !src) continue;
      const quote = kind === "decision" ? (src as { exact_quote: string }).exact_quote : (src as { source_quote: string }).source_quote;
      // Ground truth beats the model: a quote that is literally absent caps confidence.
      const literal = quoteInText(quote, rawText);
      let confidence = clamp01(r.confidence);
      if (!literal && r.quote_found !== true) confidence = Math.min(confidence, 0.4);
      out.push({
        kind,
        index,
        confidence,
        quote_found: literal || r.quote_found === true,
        reason: typeof r.reason === "string" ? r.reason.slice(0, 160) : "",
      });
    }
    if (out.length === 0) return NOT_VERIFIED("AI check returned no results");
    const overall = typeof parsed.overall === "number"
      ? clamp01(parsed.overall)
      : out.reduce((s, i) => s + i.confidence, 0) / out.length;
    const missed = Array.isArray(parsed.missed)
      ? parsed.missed.filter((m): m is string => typeof m === "string").slice(0, 10).map((m) => m.slice(0, 200))
      : [];
    return { status: "verified", overall, items: out, missed };
  } catch (e) {
    log.error("verifyExtraction failed:", e instanceof Error ? e.message : e);
    return NOT_VERIFIED("AI check timed out or failed");
  }
}
