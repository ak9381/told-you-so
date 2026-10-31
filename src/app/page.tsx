"use client";

import { useState, useEffect } from "react";
import Masthead from "@/components/Masthead";
import Nav from "@/components/Nav";
import { formatSpokenTokens, TokenPart } from "@/lib/messySpeech";
import { ExtractionResult, ExtractedDecision, ExtractedAction } from "@/lib/extractor";
import type { Objection, Maybe, TraceStep, Refinement } from "@/lib/agent";

const VERDICTS = ["overrule", "pivot", "keep_old", "flag"] as const;
const verdictLabel = (v: string) =>
  v === "keep_old" ? "Keep old" : v.charAt(0).toUpperCase() + v.slice(1);

// #3 polite cards flag (client-readable) + a short date like "Oct 24".
const POLITE_CARDS = process.env.NEXT_PUBLIC_FLAG_POLITE_CARDS === "true";
const shortDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

interface TimelineDecision {
  id: string;
  topic: string;
  exact_quote: string;
  speaker: string;
  said_at: string | null;
  meeting_seq: number;
  status: string;
}

function groupByTopic(decisions: TimelineDecision[]) {
  const map: Record<string, TimelineDecision[]> = {};
  for (const d of decisions) (map[d.topic] ||= []).push(d);
  return map;
}

interface ProjectOption {
  id: string;
  name: string;
}

const DEFAULT_PROJECTS: ProjectOption[] = [
  { id: "proj-hackathon", name: "Hackathon submission" },
  { id: "proj-client", name: "Client website" },
];

export default function HomePage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("proj-hackathon");
  const [projects, setProjects] = useState<ProjectOption[]>(DEFAULT_PROJECTS);
  const [activeTab, setActiveTab] = useState<"debrief" | "paste">("debrief");

  // Load the real projects (with real UUIDs) so commits target valid rows.
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (d.projects && d.projects.length > 0) {
          setProjects(d.projects);
          setSelectedProjectId(d.projects[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Load the decision spine whenever the project changes.
  function loadTimeline(pid: string) {
    if (!pid || pid.startsWith("proj-")) return;
    fetch(`/api/timeline?projectId=${pid}`)
      .then((r) => r.json())
      .then((d) => setTimeline(d.decisions ?? []))
      .catch(() => {});
  }
  useEffect(() => {
    loadTimeline(selectedProjectId);
  }, [selectedProjectId]);

  // If arriving from the live meeting (End Meeting), prefill the paste box.
  useEffect(() => {
    try {
      const t = sessionStorage.getItem("tys_live_transcript");
      if (t) {
        setActiveTab("paste");
        setRawInput(t);
        sessionStorage.removeItem("tys_live_transcript");
      }
    } catch {
      /* ignore */
    }
  }, []);
  const [rawInput, setRawInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [tokens, setTokens] = useState<TokenPart[]>([]);

  // Confirmation tray checked states
  const [checkedDecisions, setCheckedDecisions] = useState<Record<number, boolean>>({});
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});
  const [committedStatus, setCommittedStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Agent (MB3) output
  const [objections, setObjections] = useState<Objection[]>([]);
  const [maybes, setMaybes] = useState<Maybe[]>([]);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [refinements, setRefinements] = useState<Refinement[]>([]);
  const [agentPath, setAgentPath] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<number, string>>({});
  const [timeline, setTimeline] = useState<TimelineDecision[]>([]);

  // Auto-named meeting
  const now = new Date();
  const formattedTime = now.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const currentProjectName = projects.find((p) => p.id === selectedProjectId)?.name || "Meeting";
  const autoMeetingTitle = `${currentProjectName} #2 · ${formattedTime} IST`;

  async function handleExtract() {
    if (!rawInput.trim()) return;
    setIsProcessing(true);
    setCommittedStatus(null);
    setErrorMsg(null);
    setObjections([]);
    setMaybes([]);
    setTrace([]);
    setRefinements([]);
    setAgentPath(null);
    setVerdicts({});

    // Format tokens for "What you said" column
    const formatted = formatSpokenTokens(rawInput);
    setTokens(formatted);

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawInput,
          sourceType: activeTab === "debrief" ? "debrief" : undefined,
          userName: "Akash",
          projectId: selectedProjectId,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.aiError) {
        setResult(null);
        setErrorMsg(
          data.error || "The AI could not process this. Please try again."
        );
        return;
      }
      if (data.extraction) {
        setResult(data.extraction);
        setObjections(data.objections ?? []);
        setMaybes(data.maybes ?? []);
        setTrace(data.trace ?? []);
        setRefinements(data.refinements ?? []);
        setAgentPath(data.agentPath ?? null);
        // Pre-tick all items in the tray by default
        const decMap: Record<number, boolean> = {};
        data.extraction.decisions.forEach((_: unknown, i: number) => {
          decMap[i] = true;
        });
        setCheckedDecisions(decMap);

        const actMap: Record<number, boolean> = {};
        data.extraction.actions.forEach((_: unknown, i: number) => {
          actMap[i] = true;
        });
        setCheckedActions(actMap);
      }
    } catch (e) {
      console.error("Extraction failed:", e);
      setErrorMsg("Could not reach the server. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  // #4: log each verdict click as a labelled example (server no-ops unless flag on).
  function logVerdict(obj: Objection, verdict: string) {
    fetch("/api/log-verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldDecisionId: obj.old.id,
        newQuote: obj.now.quote,
        topic: obj.topic,
        verdict,
        confidence: obj.confidence,
      }),
    }).catch(() => {});
  }

  async function handleConfirm() {
    if (!result) return;
    setIsProcessing(true);

    const selectedDecisions = result.decisions.filter((_, i) => checkedDecisions[i]);
    const selectedActions = result.actions.filter((_, i) => checkedActions[i]);

    // Build verdicts for any objections the user ruled on
    const objectionVerdicts = objections
      .map((obj, i) =>
        verdicts[i]
          ? {
              oldDecisionId: obj.old.id,
              oldQuote: obj.old.quote,
              oldSpeaker: obj.old.speaker,
              newQuote: obj.now.quote,
              newSpeaker: obj.now.speaker,
              verdict: verdicts[i],
            }
          : null
      )
      .filter(Boolean);

    try {
      const res = await fetch("/api/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          meetingTitle: autoMeetingTitle,
          sourceType: activeTab,
          rawText: rawInput,
          decisions: selectedDecisions,
          actions: selectedActions,
          objectionVerdicts,
        }),
      });

      if (res.ok) {
        setCommittedStatus("CONFIRMED & RECORDED IN COURT DOCKET");
        loadTimeline(selectedProjectId);
      } else {
        const body = await res.json().catch(() => ({}));
        setCommittedStatus(`NOT RECORDED — ${body.error || "commit failed"}`);
      }
    } catch {
      setCommittedStatus("NOT RECORDED — could not reach the server");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 min-h-screen">
      <Masthead />
      <Nav />

      {/* Project Selector & Auto Title Header */}
      <section className="border border-[#DDD3C1] bg-[#FAF7F2] p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="font-mono text-xs uppercase tracking-wider text-[#78716C]">
              Workstream:
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="border border-[#DDD3C1] bg-[#F4EFE6] px-3 py-1 font-mono text-sm text-[#1C1917] focus:outline-none focus:border-[#C0392B]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="font-mono text-xs text-[#1C1917] font-semibold bg-[#E8E1D5] px-3 py-1 border border-[#DDD3C1]">
            Docket: {autoMeetingTitle}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex border-b-2 border-[#1C1917] mb-6">
        <button
          onClick={() => setActiveTab("debrief")}
          className={`px-6 py-2.5 font-mono text-sm uppercase tracking-wider transition-colors ${
            activeTab === "debrief"
              ? "bg-[#1C1917] text-[#F4EFE6] font-bold"
              : "bg-[#FAF7F2] text-[#44403C] hover:bg-[#E8E1D5]"
          }`}
        >
          🎙 Dictate with Wispr
        </button>
        <button
          onClick={() => setActiveTab("paste")}
          className={`px-6 py-2.5 font-mono text-sm uppercase tracking-wider transition-colors ${
            activeTab === "paste"
              ? "bg-[#1C1917] text-[#F4EFE6] font-bold"
              : "bg-[#FAF7F2] text-[#44403C] hover:bg-[#E8E1D5]"
          }`}
        >
          📋 Paste Transcripts / WhatsApp / Slack
        </button>
      </div>

      {/* Input Box */}
      <section className="border border-[#DDD3C1] bg-[#FAF7F2] p-6 shadow-sm mb-8">
        {activeTab === "debrief" ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs uppercase tracking-wider text-[#C0392B] font-bold">
                Spoken Debrief Box
              </span>
              <span className="font-mono text-xs text-[#78716C] bg-[#F4EFE6] px-2 py-0.5 border border-[#DDD3C1]">
                Hold <kbd className="font-bold text-[#1C1917]">Fn</kbd> and just talk with Wispr Flow
              </span>
            </div>
            <textarea
              rows={4}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="e.g. Um, so quick recap. Harsh, no wait, I take the video, by Tuesday. Oh and the coffee machine is broken again, anyway..."
              className="w-full border border-[#DDD3C1] bg-[#F4EFE6] p-4 font-mono text-sm text-[#1C1917] focus:outline-none focus:border-[#C0392B]"
            />
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs uppercase tracking-wider text-[#C0392B] font-bold">
                Transcript &amp; Chat Ingestion
              </span>
              <span className="font-mono text-xs text-[#78716C]">
                Auto-detects Zoom/Meet, WhatsApp (iOS/Android), and Slack format
              </span>
            </div>
            <textarea
              rows={6}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Paste Zoom transcript [mm:ss] Speaker: text, WhatsApp export .txt, or Slack Name: text..."
              className="w-full border border-[#DDD3C1] bg-[#F4EFE6] p-4 font-mono text-sm text-[#1C1917] focus:outline-none focus:border-[#C0392B]"
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setRawInput(
                  "Um, like, quick update. Harsh, no wait, I take the video, by Tuesday. The coffee machine broke again anyway."
                )
              }
              className="text-xs font-mono text-[#78716C] underline hover:text-[#1C1917]"
            >
              Load Sample Debrief
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                setActiveTab("paste");
                setRawInput(
                  `[31/10/26, 2:05:12 PM] Rohan: Bro I'm in for the hackathon, adding Neha too, we can be 3 na?\n[31/10/26, 2:06:01 PM] Neha: Yes 3 is fine I think, they never said a limit\n[31/10/26, 2:07:33 PM] Akash: Let's aim to submit by midnight then`
                );
              }}
              className="text-xs font-mono text-[#78716C] underline hover:text-[#1C1917]"
            >
              Load Sample WhatsApp
            </button>
          </div>

          <button
            onClick={handleExtract}
            disabled={isProcessing || !rawInput.trim()}
            className="bg-[#1C1917] text-[#F4EFE6] font-mono text-xs uppercase tracking-wider px-6 py-2.5 hover:bg-[#C0392B] disabled:opacity-50 transition-colors"
          >
            {isProcessing ? "Analyzing Speech..." : "Process Recorded Speech"}
          </button>
        </div>
      </section>

      {/* AI error banner — surfaced instead of a silent fallback */}
      {errorMsg && (
        <section className="mb-8 border-2 border-[#C0392B] bg-[#FADBD8] p-4">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#962D22]">
            AI Error — nothing was recorded
          </p>
          <p className="font-serif text-sm text-[#1C1917] mt-1">{errorMsg}</p>
        </section>
      )}

      {/* Split View: What you said vs What we understood */}
      {result && (
        <section className="mb-8">
          <div className="border border-[#1C1917] bg-[#FAF7F2] p-6">
            <h3 className="font-serif text-xl font-bold text-[#1C1917] border-b border-[#DDD3C1] pb-3 mb-6">
              Courtroom Transcript Record
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Column 1: What you said */}
              <div className="border border-[#DDD3C1] bg-[#F4EFE6] p-4">
                <div className="flex items-center justify-between border-b border-[#DDD3C1] pb-2 mb-3">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#78716C]">
                    What You Said (Spoken Stream)
                  </span>
                  <span className="font-mono text-[10px] text-[#78716C]">RAW SPEECH</span>
                </div>
                <div className="font-mono text-sm leading-relaxed text-[#1C1917] space-y-2">
                  <p>
                    {tokens.map((t, idx) => {
                      if (t.isStrikethrough) {
                        return (
                          <span
                            key={idx}
                            className="line-through text-[#C0392B] font-semibold bg-[#FADBD8] px-1"
                          >
                            {t.text}
                          </span>
                        );
                      }
                      if (t.isFiller) {
                        return (
                          <span key={idx} className="text-[#A8A29E] italic">
                            {t.text}
                          </span>
                        );
                      }
                      return <span key={idx}>{t.text}</span>;
                    })}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#DDD3C1] text-[11px] font-mono text-[#78716C]">
                  Legend: <span className="line-through text-[#C0392B]">Struck = corrected</span> ·{" "}
                  <span className="text-[#A8A29E] italic">Grey = filler/digression</span>
                </div>
              </div>

              {/* Column 2: What we understood */}
              <div className="border border-[#DDD3C1] bg-[#F4EFE6] p-4">
                <div className="flex items-center justify-between border-b border-[#DDD3C1] pb-2 mb-3">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#1C1917]">
                    What We Understood (Clean Ledger)
                  </span>
                  <span className="font-mono text-[10px] text-[#C0392B] font-bold">STRUCTURED</span>
                </div>

                <div className="space-y-4 font-mono text-xs">
                  {result.actions.length > 0 && (
                    <div>
                      <span className="font-bold uppercase text-[#C0392B] block mb-2">
                        Assigned Actions
                      </span>
                      {result.actions.map((act: ExtractedAction, idx: number) => (
                        <div key={idx} className="border-l-2 border-[#1C1917] bg-[#FAF7F2] p-2.5 mb-2">
                          <div className="font-bold text-[#1C1917]">{act.title}</div>
                          <div className="text-[#44403C] mt-1">
                            Owner: <span className="font-semibold text-[#1C1917]">{act.owner}</span> · Due:{" "}
                            <span className="font-semibold text-[#1C1917]">{act.due_date}</span>
                          </div>
                          <blockquote className="mt-1 text-[11px] text-[#78716C] italic">
                            &ldquo;{act.source_quote}&rdquo;
                          </blockquote>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.decisions.length > 0 && (
                    <div className="mt-4">
                      <span className="font-bold uppercase text-[#1C1917] block mb-2">
                        Recorded Commitments
                      </span>
                      {result.decisions.map((dec: ExtractedDecision, idx: number) => (
                        <div key={idx} className="border-l-2 border-[#C0392B] bg-[#FAF7F2] p-2.5 mb-2">
                          <span className="text-[10px] font-mono uppercase bg-[#E8E1D5] px-1.5 py-0.5">
                            {dec.topic}
                          </span>
                          <div className="font-semibold text-[#1C1917] mt-1">{dec.summary}</div>
                          <blockquote className="mt-1 text-[11px] text-[#78716C] italic">
                            &ldquo;{dec.exact_quote}&rdquo; — {dec.speaker}
                          </blockquote>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.actions.length === 0 && result.decisions.length === 0 && (
                    <div className="text-[#78716C] italic py-4">No formal commitments extracted.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* OBJECTION! cards (MB3) */}
      {objections.length > 0 && (
        <section className="mb-8 space-y-4">
          {objections.map((obj, i) => (
            <div key={i} className="border-2 border-[#C0392B] bg-[#FADBD8]/50 p-5 shadow-sm">
              <div className="flex items-center justify-between border-b-2 border-[#C0392B] pb-2 mb-4">
                <span
                  className={
                    POLITE_CARDS
                      ? "font-serif text-xl font-bold text-[#1C1917]"
                      : "font-serif text-3xl font-black text-[#C0392B] tracking-tight -rotate-1"
                  }
                >
                  {POLITE_CARDS ? "Heads up" : "OBJECTION!"}
                </span>
                <span className="flex items-center gap-2">
                  {typeof obj.confidence === "number" && (
                    <span className="font-mono text-[10px] text-[#962D22]">
                      {Math.round(obj.confidence * 100)}% sure
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#962D22] border border-[#C0392B] px-2 py-0.5">
                    {obj.topic}
                  </span>
                </span>
              </div>
              {POLITE_CARDS && (
                <p className="font-serif text-sm text-[#1C1917] mb-3">
                  On {shortDate(obj.old.decidedAt) || `meeting #${obj.old.meeting_seq}`} you decided{" "}
                  <span className="font-bold">{obj.topic.replace(/_/g, " ")}</span>, and this now conflicts with it — here&rsquo;s the receipt:
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                <div className="border-l-2 border-[#78716C] pl-3">
                  <div className="uppercase text-[10px] text-[#78716C] font-bold mb-1">
                    Then — Meeting #{obj.old.meeting_seq}
                    {obj.old.said_at ? ` · ${obj.old.said_at}` : ""}
                  </div>
                  <blockquote className="italic text-[#44403C]">&ldquo;{obj.old.quote}&rdquo;</blockquote>
                  <div className="text-[#78716C] mt-1">— {obj.old.speaker}</div>
                </div>
                <div className="border-l-2 border-[#C0392B] pl-3">
                  <div className="uppercase text-[10px] text-[#C0392B] font-bold mb-1">Now</div>
                  <blockquote className="italic text-[#1C1917]">&ldquo;{obj.now.quote}&rdquo;</blockquote>
                  <div className="text-[#78716C] mt-1">— {obj.now.speaker}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {VERDICTS.map((vd) => (
                  <button
                    key={vd}
                    onClick={() => {
                      setVerdicts((p) => ({ ...p, [i]: vd }));
                      logVerdict(obj, vd);
                    }}
                    className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                      verdicts[i] === vd
                        ? "bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]"
                        : "bg-[#F4EFE6] text-[#44403C] border-[#DDD3C1] hover:border-[#1C1917]"
                    }`}
                  >
                    {verdictLabel(vd)}
                  </button>
                ))}
                {verdicts[i] && (
                  <span className="font-mono text-[10px] text-[#C0392B] self-center">
                    ✓ {verdictLabel(verdicts[i])} selected
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Low-confidence "maybe a conflict" chips (#1) */}
      {maybes.length > 0 && (
        <section className="mb-8 space-y-2">
          {maybes.map((m, i) => (
            <div key={i} className="border border-[#C0392B]/40 bg-[#F4EFE6] p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#78716C]">
                  Maybe a conflict · {m.topic}
                </span>
                <span className="font-mono text-[10px] text-[#78716C]">
                  {Math.round(m.confidence * 100)}% sure
                </span>
              </div>
              <div className="font-mono text-[11px] text-[#78716C]">
                Earlier: &ldquo;{m.old.quote}&rdquo; — {m.old.speaker} · Now: &ldquo;{m.now.quote}&rdquo;
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Refinement chips — proof of no false positives */}
      {refinements.length > 0 && (
        <section className="mb-8 flex flex-wrap gap-2">
          {refinements.map((r, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-2 bg-[#E8E1D5] border border-[#DDD3C1] px-3 py-1.5 font-mono text-[11px]"
            >
              <span className="uppercase text-[10px] text-[#78716C]">refinement · not flagged</span>
              <span className="text-[#1C1917]">&ldquo;{r.quote}&rdquo;</span>
            </div>
          ))}
        </section>
      )}

      {/* Reasoning trail (the agent thinking out loud) */}
      {trace.length > 0 && (
        <section className="mb-8 border border-[#DDD3C1] bg-[#FAF7F2] p-5">
          <div className="flex items-center justify-between border-b border-[#DDD3C1] pb-2 mb-3">
            <h4 className="font-serif text-lg font-bold text-[#1C1917]">Reasoning Trail</h4>
            {agentPath && (
              <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-[#DDD3C1] text-[#78716C]">
                path: {agentPath}
              </span>
            )}
          </div>
          <ol className="space-y-2 font-mono text-xs">
            {trace.map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-[#C0392B] font-bold">{t.step}.</span>
                <div>
                  <span className="uppercase font-bold text-[#1C1917]">{t.tool}</span>
                  <span className="text-[#78716C]"> — {t.input} → {t.output}</span>
                  <div className="text-[#44403C] italic">{t.reasoning}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Confirmation Tray */}
      {result && (
        <section className="border-2 border-[#1C1917] bg-[#FAF7F2] p-6 shadow-md mb-12">
          <div className="flex items-center justify-between border-b border-[#DDD3C1] pb-3 mb-4">
            <div>
              <h4 className="font-serif text-lg font-bold text-[#1C1917]">
                Confirmation Tray
              </h4>
              <p className="font-mono text-xs text-[#78716C]">
                Nothing is saved to database or sent to Notion until ticked and confirmed.
              </p>
            </div>
            {committedStatus && (
              <span className="font-mono text-xs font-bold text-[#C0392B] bg-[#FADBD8] px-3 py-1 border border-[#C0392B]">
                {committedStatus}
              </span>
            )}
          </div>

          <div className="space-y-3 font-mono text-xs my-4">
            {result.actions.map((act, i) => (
              <label
                key={`act-${i}`}
                className="flex items-start gap-3 p-3 border border-[#DDD3C1] bg-[#F4EFE6] cursor-pointer hover:border-[#1C1917]"
              >
                <input
                  type="checkbox"
                  checked={!!checkedActions[i]}
                  onChange={(e) =>
                    setCheckedActions((prev) => ({ ...prev, [i]: e.target.checked }))
                  }
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-bold text-[#1C1917]">
                    [ACTION] {act.title}
                  </div>
                  <div className="text-[#44403C]">
                    Owner: <strong>{act.owner}</strong> · Due: <strong>{act.due_date}</strong>
                  </div>
                  <div className="text-[#78716C] italic mt-0.5">&ldquo;{act.source_quote}&rdquo;</div>
                </div>
              </label>
            ))}

            {result.decisions.map((dec, i) => (
              <label
                key={`dec-${i}`}
                className="flex items-start gap-3 p-3 border border-[#DDD3C1] bg-[#F4EFE6] cursor-pointer hover:border-[#1C1917]"
              >
                <input
                  type="checkbox"
                  checked={!!checkedDecisions[i]}
                  onChange={(e) =>
                    setCheckedDecisions((prev) => ({ ...prev, [i]: e.target.checked }))
                  }
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-bold text-[#C0392B]">
                    [COMMITMENT: {dec.topic}]
                  </div>
                  <div className="text-[#1C1917]">{dec.summary}</div>
                  <div className="text-[#78716C] italic mt-0.5">&ldquo;{dec.exact_quote}&rdquo; — {dec.speaker}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="pt-4 border-t border-[#DDD3C1] flex items-center justify-between">
            <span className="font-mono text-xs text-[#78716C]">
              Review all items above carefully before sealing the ledger.
            </span>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="bg-[#C0392B] text-[#F4EFE6] font-mono text-xs uppercase tracking-wider font-bold px-8 py-3 hover:bg-[#962D22] disabled:opacity-50 transition-colors"
            >
              {isProcessing ? "Sealing Record..." : "Tick & Confirm Record"}
            </button>
          </div>
        </section>
      )}
      {/* Decision Spine — the project's memory, superseded decisions struck through */}
      {timeline.length > 0 && (
        <section className="mb-12 border border-[#DDD3C1] bg-[#FAF7F2] p-6">
          <h3 className="font-serif text-xl font-bold text-[#1C1917] border-b border-[#DDD3C1] pb-3 mb-4">
            Decision Spine — {currentProjectName}
          </h3>
          <div className="space-y-5">
            {Object.entries(groupByTopic(timeline)).map(([topic, decs]) => (
              <div key={topic}>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#C0392B] mb-1.5">
                  {topic}
                </div>
                <ul className="space-y-1.5">
                  {decs.map((d) => {
                    const struck = d.status !== "active";
                    return (
                      <li key={d.id} className="font-mono text-xs flex items-start gap-2">
                        <span
                          className={`flex-1 ${
                            struck ? "line-through text-[#A8A29E]" : "text-[#1C1917]"
                          }`}
                        >
                          &ldquo;{d.exact_quote}&rdquo;{" "}
                          <span className="text-[#78716C]">
                            — {d.speaker} · M#{d.meeting_seq}
                            {d.said_at ? ` · ${d.said_at}` : ""}
                          </span>
                        </span>
                        {struck && (
                          <span className="text-[9px] font-bold uppercase border border-[#C0392B] text-[#C0392B] px-1 py-0.5 -rotate-3 shrink-0">
                            {d.status === "overruled" ? "OVERRULED" : "PIVOT"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
