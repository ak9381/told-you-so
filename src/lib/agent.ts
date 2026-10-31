import { log } from "@/lib/log";
import { checkAndIncrementUsage } from "@/lib/usage";
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

// B2: every decision is conflict-checked. Gemini verify calls per ingest are
// budgeted (free-tier RPM); decisions past the budget get the conservative
// offline check (grey "maybe" at most) and the user is told how many.
export const MAX_AI_VERIFY_CALLS = Math.max(1, Number(process.env.AGENT_MAX_AI_VERIFY_CALLS) || 12);

export interface MemoryDecision {
  id: string;
  topic: string;
  exact_quote: string;
  speaker: string;
  said_at: string | null;
  meeting_seq: number;
  created_at?: string;
  meeting_date?: string | null; // real meeting date (migration 005)
}

// Supabase embeds a to-one relation as an object or 1-element array.
function withMeetingDate(rows: unknown[] | null): MemoryDecision[] {
  return (rows ?? []).map((r) => {
    const row = r as MemoryDecision & { meeting?: { meeting_date?: string | null } | { meeting_date?: string | null }[] };
    const m = Array.isArray(row.meeting) ? row.meeting[0] : row.meeting;
    const { meeting: _m, ...rest } = row;
    void _m;
    return { ...rest, meeting_date: m?.meeting_date ?? null };
  });
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
  // itemIndex = position of the new decision in the extraction (B3: stable id
  // so commit never maps a verdict by quote text).
  now: { quote: string; speaker: string; summary: string; itemIndex?: number };
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
  /** User-facing notes, e.g. how many decisions got only the offline check. */
  notes?: string[];
}

type Verdict = "contradicts" | "refines" | "unrelated";

/** search_memory: active decisions in the SAME project + topic, newest first. */
async function searchMemory(
  projectId: string,
  topic: string
): Promise<MemoryDecision[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("decisions")
    .select("id, topic, exact_quote, speaker, said_at, meeting_seq, created_at, meeting:meetings(meeting_date)")
    .eq("project_id", projectId)
    .eq("topic", topic)
    .eq("status", "active")
    .is("superseded_by", null)
    .order("meeting_seq", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`search_memory failed: ${error.message}`);
  return withMeetingDate(data);
}

/** All active (non-superseded) decisions in a project — the live memory. */
export async function getProjectMemory(
  projectId: string
): Promise<MemoryDecision[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("decisions")
    .select("id, topic, exact_quote, speaker, said_at, meeting_seq, created_at, meeting:meetings(meeting_date)")
    .eq("project_id", projectId)
    .eq("status", "active")
    .is("superseded_by", null)
    .order("meeting_seq", { ascending: false });
  if (error) throw new Error(`project memory failed: ${error.message}`);
  return withMeetingDate(data);
}

const TIME_TOPICS = new Set(["deadline", "submission", "launch-date"]);

interface VerifyOutput {
  verdict: Verdict;
  matchIndex: number; // index into candidates of the matched prior decision, or -1
  confidence: number; // 0..1
  reasoning: string;
  usedGemini: boolean;
}

/**
 * Deterministic fallback (Gemini down, over the cap, or past the per-ingest
 * budget). It is deliberately CONSERVATIVE (B4): it can only ever produce a
 * low-confidence "maybe" — never a hard red objection — because it has no real
 * understanding of the statements.
 */
export const FALLBACK_MAX_CONFIDENCE = 0.5;
export function deterministicVerify(
  candidates: MemoryDecision[],
  item: Pick<ExtractedDecision, "exact_quote" | "summary">,
  topic: string
): VerifyOutput {
  const newText = `${item.exact_quote} ${item.summary}`.toLowerCase();
  const prior = (candidates[0]?.exact_quote ?? "").toLowerCase();
  if (newText.trim() && prior && newText.includes(prior)) {
    return { verdict: "refines", matchIndex: 0, confidence: 0.2, reasoning: "Restates the agreed decision.", usedGemini: false };
  }
  if (TIME_TOPICS.has(topic)) {
    const pushesLater = /tomorrow|next day|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|postpone|push(ed)? (it )?back|delay|later/.test(newText);
    if (pushesLater) {
      return {
        verdict: "contradicts",
        matchIndex: 0,
        confidence: 0.45,
        reasoning: `Possibly moves the agreed time later than "${candidates[0].exact_quote}" (offline check — AI unavailable, so this is only a maybe).`,
        usedGemini: false,
      };
    }
    return {
      verdict: "refines",
      matchIndex: 0,
      confidence: 0.3,
      reasoning: `Looks like a same-day/tighter time that fits "${candidates[0].exact_quote}" (offline check).`,
      usedGemini: false,
    };
  }
  // Negation/antonym hint → weak maybe; otherwise don't flag at all.
  const negates = /\b(no|not|don't|dont|never|instead|switch|drop|cancel|scrap|replace|rather)\b/.test(newText);
  return negates
    ? {
        verdict: "contradicts",
        matchIndex: 0,
        confidence: 0.35,
        reasoning: `May differ from the agreed decision on "${topic}" (offline check — AI unavailable, so this is only a maybe).`,
        usedGemini: false,
      }
    : { verdict: "unrelated", matchIndex: 0, confidence: 0.1, reasoning: "Offline check found no clear conflict.", usedGemini: false };
}

/**
 * verify_conflict: strict, independent check against ALL prior decisions on the
 * topic, using the refinement rule. Returns which prior decision is contradicted
 * (or refined), so the objection cites the right receipt.
 */
async function verifyConflict(
  candidates: MemoryDecision[],
  item: ExtractedDecision,
  topic: string,
  allowGemini = true
): Promise<VerifyOutput> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !allowGemini) return deterministicVerify(candidates, item, topic);

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
  } catch (e) {
    log.warn("verify_conflict fell back to deterministic:", e instanceof Error ? e.message : e);
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
  projectId: string,
  userId?: string
): Promise<AgentResult> {
  const trace: TraceStep[] = [];
  const objections: Objection[] = [];
  const maybes: Maybe[] = [];
  const refinements: Refinement[] = [];
  let path: "agent" | "fallback" = "agent";
  let step = 0;

  const notes: string[] = [];
  let aiCalls = 0;
  let offlineOnly = 0;
  const memoryByTopic = new Map<string, MemoryDecision[]>();
  for (const [itemIndex, dec] of decisions.entries()) {
    // 1. search_memory
    step += 1;
    let candidates = memoryByTopic.get(dec.topic);
    if (!candidates) {
      candidates = await searchMemory(projectId, dec.topic);
      memoryByTopic.set(dec.topic, candidates);
    }
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
    // Every Gemini call counts toward the per-user daily cap; over the cap we
    // fall back to the deterministic check instead of failing.
    const withinBudget = aiCalls < MAX_AI_VERIFY_CALLS;
    if (!withinBudget) offlineOnly += 1;
    const allowGemini = withinBudget && (userId ? (await checkAndIncrementUsage(userId, false)).allowed : true);
    if (allowGemini) aiCalls += 1;
    const v = await verifyConflict(candidates, dec, dec.topic, allowGemini);
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
      // B4: a deterministic (non-AI) verdict is never a red card.
      const isHigh = v.usedGemini && (!flags.confidence || v.confidence >= CONFIDENCE_THRESHOLD);
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
            decidedAt: prior.meeting_date ?? prior.created_at ?? null,
          },
          now: {
            quote: dec.exact_quote,
            speaker: dec.speaker,
            summary: dec.summary,
            itemIndex,
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

  if (offlineOnly > 0) {
    const note = `${offlineOnly} decision(s) were past the AI check limit for one ingest (${MAX_AI_VERIFY_CALLS}) and got only the offline check — possible conflicts there show as grey "maybe", never red.`;
    notes.push(note);
    trace.push({ step: step + 1, tool: "verify_conflict", input: `${decisions.length} decisions`, output: `${offlineOnly} offline-only`, reasoning: note });
  }

  return { objections, maybes, refinements, trace, path, notes };
}
