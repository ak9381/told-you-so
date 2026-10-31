import { fetchWithRetry } from "@/lib/http";
import { createServerClient } from "./supabase";
import { ExtractedDecision } from "./extractor";
import { flags, CONFIDENCE_THRESHOLD } from "./flags";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

// The bounded conflict-detection agent (MB3). It is a deterministic orchestration
// — search_memory -> verify_conflict -> queue_action — that uses Gemini for the
// reasoning-heavy verify step and records every step to a trace the UI shows.
// This is more reliable for a live demo than LLM-driven function-calling, and it
// falls back to a deterministic check if Gemini errors or is rate-limited.

const MAX_DECISIONS = 8; // cap Gemini verify calls to respect the 15 RPM free tier

export interface MemoryDecision {
  id: string;
  topic: string;
  exact_quote: string;
  speaker: string;
  said_at: string | null;
  meeting_seq: number;
  created_at?: string;
}

export interface TraceStep {
  step: number;
  tool: "search_memory" | "verify_conflict" | "queue_action" | "ask_clarifying_question";
  input: string;
  output: string;
  reasoning: string;
}

export interface Objection {
  topic: string;
  old: {
    id: string;
    quote: string;
    speaker: string;
    meeting_seq: number;
    said_at: string | null;
    decidedAt?: string | null; // the date the old decision was made (#3)
  };
  now: { quote: string; speaker: string; summary: string };
  confidence?: number;
}

// #1: a low-confidence possible conflict (grey "maybe a conflict" chip).
export interface Maybe {
  topic: string;
  old: { quote: string; speaker: string; meeting_seq: number; said_at: string | null };
  now: { quote: string; speaker: string };
  confidence: number;
}

export interface Refinement {
  topic: string;
  quote: string;
  note: string;
}

export interface AgentResult {
  objections: Objection[];
  maybes: Maybe[];
  refinements: Refinement[];
  trace: TraceStep[];
  path: "agent" | "fallback";
}

type Verdict = "contradicts" | "refines" | "unrelated";

/** search_memory: active decisions in the SAME project + topic, newest first. */
async function searchMemory(
  projectId: string,
  topic: string
): Promise<MemoryDecision[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("decisions")
    .select("id, topic, exact_quote, speaker, said_at, meeting_seq, created_at")
    .eq("project_id", projectId)
    .eq("topic", topic)
    .eq("status", "active")
    .is("superseded_by", null)
    .order("meeting_seq", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as MemoryDecision[]) ?? [];
}

/** All active (non-superseded) decisions in a project — the live memory. */
export async function getProjectMemory(
  projectId: string
): Promise<MemoryDecision[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("decisions")
    .select("id, topic, exact_quote, speaker, said_at, meeting_seq, created_at")
    .eq("project_id", projectId)
    .eq("status", "active")
    .is("superseded_by", null)
    .order("meeting_seq", { ascending: false });
  return (data as MemoryDecision[]) ?? [];
}

const TIME_TOPICS = new Set(["deadline", "submission", "launch-date"]);

interface VerifyOutput {
  verdict: Verdict;
  matchIndex: number; // index into candidates of the matched prior decision, or -1
  confidence: number; // 0..1
  reasoning: string;
  usedGemini: boolean;
}

/** Deterministic fallback: check the new item against each candidate in turn. */
function deterministicVerify(
  candidates: MemoryDecision[],
  item: ExtractedDecision,
  topic: string
): VerifyOutput {
  const newText = `${item.exact_quote} ${item.summary}`.toLowerCase();
  const pushesLater =
    /tomorrow|next day|next week|monday|tuesday|wednesday|thursday|friday/.test(
      newText
    );
  if (TIME_TOPICS.has(topic)) {
    if (pushesLater) {
      return {
        verdict: "contradicts",
        matchIndex: 0,
        confidence: 0.9,
        reasoning: `New statement moves the agreed time to a later day, contradicting "${candidates[0].exact_quote}".`,
        usedGemini: false,
      };
    }
    return {
      verdict: "refines",
      matchIndex: 0,
      confidence: 0.9,
      reasoning: `A tighter same-day time refines "${candidates[0].exact_quote}", not a contradiction.`,
      usedGemini: false,
    };
  }
  return {
    verdict: "contradicts",
    matchIndex: 0,
    confidence: 0.7,
    reasoning: `New statement differs from the agreed decision on "${topic}".`,
    usedGemini: false,
  };
}

/**
 * verify_conflict: strict, independent check against ALL prior decisions on the
 * topic, using the refinement rule. Returns which prior decision is contradicted
 * (or refined), so the objection cites the right receipt.
 */
async function verifyConflict(
  candidates: MemoryDecision[],
  item: ExtractedDecision,
  topic: string
): Promise<VerifyOutput> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return deterministicVerify(candidates, item, topic);

  const list = candidates
    .map((c, i) => `[${i + 1}] "${c.exact_quote}"`)
    .join("\n");
  const prompt = `You are a strict auditor of team decisions stored in project memory.
TOPIC: ${topic}
PRIOR decisions the team already agreed (pick the ONE most relevant):
${list}

NEW statement made now: "${item.exact_quote}" — meaning: ${item.summary}

Decide the relationship between the NEW statement and the MOST RELEVANT prior decision:
- CONTRADICTS: the new statement conflicts with that prior decision.
- REFINES: the new statement is a narrower or MORE SPECIFIC version that still fits inside it (e.g. "by 11 PM" or "by midnight" vs an agreed "by 11:59 PM tonight"; a tighter same-day deadline; a more precise value). A refinement is NOT a contradiction.
- UNRELATED: not actually about any of these decisions.

Return ONLY JSON: {"verdict":"CONTRADICTS|REFINES|UNRELATED","match":<the [number] of the most relevant prior decision, or 0 if none>,"confidence":<a number 0..1 for how sure you are this is a real contradiction>,"reasoning":"one short sentence"}`;

  try {
    const res = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text);
    const verdict = String(parsed.verdict || "").toLowerCase() as Verdict;
    const norm: Verdict =
      verdict === "contradicts" || verdict === "refines" || verdict === "unrelated"
        ? verdict
        : "unrelated";
    const matchNum = Number(parsed.match) || 0;
    const matchIndex =
      matchNum >= 1 && matchNum <= candidates.length ? matchNum - 1 : 0;
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.9;
    return { verdict: norm, matchIndex, confidence, reasoning: parsed.reasoning || "", usedGemini: true };
  } catch {
    return deterministicVerify(candidates, item, topic);
  }
}

/**
 * Run the conflict-detection agent over freshly extracted decisions, scoped to
 * one project. Returns objections (contradictions), refinements (grey chips),
 * and the full reasoning trail.
 */
export async function runAgent(
  decisions: ExtractedDecision[],
  projectId: string
): Promise<AgentResult> {
  const trace: TraceStep[] = [];
  const objections: Objection[] = [];
  const maybes: Maybe[] = [];
  const refinements: Refinement[] = [];
  let path: "agent" | "fallback" = "agent";
  let step = 0;

  const toCheck = decisions.slice(0, MAX_DECISIONS);

  for (const dec of toCheck) {
    // 1. search_memory
    step += 1;
    const candidates = await searchMemory(projectId, dec.topic);
    trace.push({
      step,
      tool: "search_memory",
      input: `topic="${dec.topic}"`,
      output: `${candidates.length} prior active decision(s)`,
      reasoning: candidates.length
        ? `Found ${candidates.length} earlier decision(s) on "${dec.topic}" in this project.`
        : `No earlier decision on "${dec.topic}" — this is new, nothing to object to.`,
    });

    if (candidates.length === 0) continue;

    // 2. verify_conflict against ALL prior decisions on the topic
    step += 1;
    const v = await verifyConflict(candidates, dec, dec.topic);
    if (!v.usedGemini) path = "fallback";
    const prior = candidates[v.matchIndex] ?? candidates[0];
    trace.push({
      step,
      tool: "verify_conflict",
      input: `old="${prior.exact_quote}" vs now="${dec.exact_quote}"`,
      output: v.verdict.toUpperCase(),
      reasoning: v.reasoning,
    });

    if (v.verdict === "contradicts") {
      // #1: with the confidence flag on, only >= threshold becomes a red card;
      // below that it is a grey "maybe a conflict". Flag off = always red.
      const isHigh = !flags.confidence || v.confidence >= CONFIDENCE_THRESHOLD;
      step += 1;
      if (isHigh) {
        objections.push({
          topic: dec.topic,
          old: {
            id: prior.id,
            quote: prior.exact_quote,
            speaker: prior.speaker,
            meeting_seq: prior.meeting_seq,
            said_at: prior.said_at,
            decidedAt: prior.created_at ?? null,
          },
          now: {
            quote: dec.exact_quote,
            speaker: dec.speaker,
            summary: dec.summary,
          },
          confidence: flags.confidence ? v.confidence : undefined,
        });
        trace.push({
          step,
          tool: "queue_action",
          input: flags.confidence
            ? `objection on "${dec.topic}" (${Math.round(v.confidence * 100)}% conf)`
            : `objection on "${dec.topic}"`,
          output: "OBJECTION queued",
          reasoning: "Contradiction confirmed — queued a red objection for your verdict.",
        });
      } else {
        maybes.push({
          topic: dec.topic,
          old: {
            quote: prior.exact_quote,
            speaker: prior.speaker,
            meeting_seq: prior.meeting_seq,
            said_at: prior.said_at,
          },
          now: { quote: dec.exact_quote, speaker: dec.speaker },
          confidence: v.confidence,
        });
        trace.push({
          step,
          tool: "queue_action",
          input: `maybe on "${dec.topic}" (${Math.round(v.confidence * 100)}% conf)`,
          output: "MAYBE queued",
          reasoning: `Possible conflict, but only ${Math.round(v.confidence * 100)}% confident — shown as a grey maybe, not a red card.`,
        });
      }
    } else if (v.verdict === "refines") {
      refinements.push({
        topic: dec.topic,
        quote: dec.exact_quote,
        note: v.reasoning,
      });
    }
  }

  return { objections, maybes, refinements, trace, path };
}
