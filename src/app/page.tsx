"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { Card, PageTitle, SectionTitle, Pill, Chip, PrimaryButton } from "@/components/ui";
import { formatSpokenTokens, TokenPart } from "@/lib/messySpeech";
import { ExtractionResult, ExtractedDecision, ExtractedAction } from "@/lib/extractor";
import type { Objection, Maybe, TraceStep, Refinement } from "@/lib/agent";

const VERDICTS = ["overrule", "pivot", "keep_old", "flag"] as const;
const verdictLabel = (v: string) =>
  v === "keep_old" ? "Keep old" : v.charAt(0).toUpperCase() + v.slice(1);

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
  const [rawInput, setRawInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [tokens, setTokens] = useState<TokenPart[]>([]);
  const [checkedDecisions, setCheckedDecisions] = useState<Record<number, boolean>>({});
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});
  const [committedStatus, setCommittedStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [maybes, setMaybes] = useState<Maybe[]>([]);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [refinements, setRefinements] = useState<Refinement[]>([]);
  const [agentPath, setAgentPath] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<number, string>>({});
  const [timeline, setTimeline] = useState<TimelineDecision[]>([]);

  // Load real projects; honour a ?project=<id> coming from the sidebar.
  useEffect(() => {
    let urlProject: string | null = null;
    try {
      urlProject = new URLSearchParams(window.location.search).get("project");
    } catch {}
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (d.projects && d.projects.length > 0) {
          setProjects(d.projects);
          const match = urlProject && d.projects.find((p: ProjectOption) => p.id === urlProject);
          setSelectedProjectId(match ? (urlProject as string) : d.projects[0].id);
        }
      })
      .catch(() => {});
  }, []);

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

  // If arriving from a live meeting (End Meeting), prefill the paste box.
  useEffect(() => {
    try {
      const t = sessionStorage.getItem("tys_live_transcript");
      if (t) {
        setActiveTab("paste");
        setRawInput(t);
        sessionStorage.removeItem("tys_live_transcript");
      }
    } catch {}
  }, []);

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
        setErrorMsg(data.error || "The AI could not process this. Please try again.");
        return;
      }
      if (data.extraction) {
        setResult(data.extraction);
        setObjections(data.objections ?? []);
        setMaybes(data.maybes ?? []);
        setTrace(data.trace ?? []);
        setRefinements(data.refinements ?? []);
        setAgentPath(data.agentPath ?? null);
        const decMap: Record<number, boolean> = {};
        data.extraction.decisions.forEach((_: unknown, i: number) => (decMap[i] = true));
        setCheckedDecisions(decMap);
        const actMap: Record<number, boolean> = {};
        data.extraction.actions.forEach((_: unknown, i: number) => (actMap[i] = true));
        setCheckedActions(actMap);
      }
    } catch (e) {
      console.error("Extraction failed:", e);
      setErrorMsg("Could not reach the server. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

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
        setCommittedStatus("Confirmed — saved to the ledger");
        loadTimeline(selectedProjectId);
      } else {
        const body = await res.json().catch(() => ({}));
        setCommittedStatus(`Not recorded — ${body.error || "commit failed"}`);
      }
    } catch {
      setCommittedStatus("Not recorded — could not reach the server");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <AppShell>
      <PageTitle
        aside={
          <span className="rounded-full bg-[#F1F0EC] px-3.5 py-1.5 text-sm text-[#6B6560]">
            60 AI calls / day
          </span>
        }
      >
        {currentProjectName}
      </PageTitle>
      <p className="text-[#9B9690] text-sm -mt-5 mb-8">{autoMeetingTitle}</p>

      {/* Capture methods */}
      <SectionTitle>Three ways to put info in</SectionTitle>
      <div className="inline-flex flex-wrap gap-1 bg-[#F1F0EC] rounded-xl p-1 mb-5">
        <Pill active={activeTab === "debrief"} onClick={() => setActiveTab("debrief")}>
          🎙 Dictate with Wispr
        </Pill>
        <Pill active={activeTab === "paste"} onClick={() => setActiveTab("paste")}>
          📋 Paste transcript / WhatsApp
        </Pill>
        <a href="/live">
          <Pill>📡 Live meeting</Pill>
        </a>
      </div>

      {/* Input card */}
      <Card className="p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="font-serif text-lg text-[#1A1715]">
            {activeTab === "debrief" ? "Dictate with Wispr" : "Paste a transcript or chat"}
          </span>
          <span className="text-xs text-[#9B9690]">
            {activeTab === "debrief"
              ? "Hold Fn and just talk — Wispr Flow types it"
              : "Auto-detects Zoom/Meet, WhatsApp (iOS/Android), and Slack"}
          </span>
        </div>
        <textarea
          rows={activeTab === "debrief" ? 4 : 6}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder={
            activeTab === "debrief"
              ? "e.g. Um, so quick recap. Harsh, no wait, I take the video, by Tuesday. Oh and the coffee machine is broken again, anyway…"
              : "Paste a Zoom transcript, a WhatsApp export, or Slack lines (Name: text)…"
          }
          className="w-full rounded-xl border border-[#E0DED8] bg-[#FBFAF8] p-4 text-sm text-[#1A1715] focus:outline-none focus:border-[#B9B6AE] focus:ring-2 focus:ring-[#ECEAE5]"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3 text-xs text-[#9B9690]">
            <button
              type="button"
              onClick={() =>
                setRawInput(
                  "Um, like, quick update. Harsh, no wait, I take the video, by Tuesday. The coffee machine broke again anyway."
                )
              }
              className="underline hover:text-[#1A1715]"
            >
              Load sample debrief
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("paste");
                setRawInput(
                  `[31/10/26, 2:05:12 PM] Rohan: Bro I'm in for the hackathon, adding Neha too, we can be 3 na?\n[31/10/26, 2:06:01 PM] Neha: Yes 3 is fine I think, they never said a limit\n[31/10/26, 2:07:33 PM] Akash: Let's aim to submit by midnight then`
                );
              }}
              className="underline hover:text-[#1A1715]"
            >
              Load sample WhatsApp
            </button>
          </div>
          <PrimaryButton onClick={handleExtract} disabled={isProcessing || !rawInput.trim()}>
            {isProcessing ? "Analyzing…" : "Process"}
          </PrimaryButton>
        </div>
      </Card>

      {/* AI error */}
      {errorMsg && (
        <Card className="p-4 mb-8 border-l-4 border-[#C0392B]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#C0392B]">
            AI error — nothing was recorded
          </p>
          <p className="text-sm text-[#1A1715] mt-1">{errorMsg}</p>
        </Card>
      )}

      {/* Split view */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9B9690]">
                What you said
              </span>
              <Chip tone="neutral">raw speech</Chip>
            </div>
            <p className="text-sm leading-relaxed text-[#1A1715]">
              {tokens.map((t, idx) => {
                if (t.isStrikethrough)
                  return (
                    <span key={idx} className="line-through text-[#C0392B] bg-[#FBE9E7] px-1 rounded">
                      {t.text}
                    </span>
                  );
                if (t.isFiller)
                  return (
                    <span key={idx} className="text-[#B9B6AE] italic">
                      {t.text}
                    </span>
                  );
                return <span key={idx}>{t.text}</span>;
              })}
            </p>
            <div className="mt-4 pt-3 border-t border-[#EFEEEA] text-[11px] text-[#9B9690]">
              <span className="line-through text-[#C0392B]">Struck</span> = corrected ·{" "}
              <span className="text-[#B9B6AE] italic">Grey</span> = filler
            </div>
          </Card>

          {/* "What we understood" — dark card, like the reference */}
          <div className="rounded-2xl bg-[#1C1C1E] text-white p-5 card-soft">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/60">
                What we understood
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-white/80 rounded-md px-2 py-0.5">
                Structured
              </span>
            </div>
            <div className="space-y-4 text-sm">
              {result.actions.length > 0 && (
                <div>
                  <span className="text-[11px] uppercase tracking-wide text-white/50 block mb-2">
                    Assigned actions
                  </span>
                  {result.actions.map((act: ExtractedAction, idx: number) => (
                    <div key={idx} className="bg-white/[0.06] rounded-xl p-3 mb-2">
                      <div className="font-medium">{act.title}</div>
                      <div className="text-white/60 text-xs mt-0.5">
                        {act.owner} · due {act.due_date}
                      </div>
                      <blockquote className="text-white/40 text-xs italic mt-1">
                        &ldquo;{act.source_quote}&rdquo;
                      </blockquote>
                    </div>
                  ))}
                </div>
              )}
              {result.decisions.length > 0 && (
                <div>
                  <span className="text-[11px] uppercase tracking-wide text-white/50 block mb-2">
                    Decisions
                  </span>
                  {result.decisions.map((dec: ExtractedDecision, idx: number) => (
                    <div key={idx} className="bg-white/[0.06] rounded-xl p-3 mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#3B4E7A] text-white rounded px-1.5 py-0.5">
                        {dec.topic}
                      </span>
                      <div className="font-medium mt-1.5">{dec.summary}</div>
                      <blockquote className="text-white/40 text-xs italic mt-1">
                        &ldquo;{dec.exact_quote}&rdquo; — {dec.speaker}
                      </blockquote>
                    </div>
                  ))}
                </div>
              )}
              {result.actions.length === 0 && result.decisions.length === 0 && (
                <div className="text-white/40 italic py-2">No formal commitments extracted.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Objection cards */}
      {objections.map((obj, i) => (
        <Card key={i} className="p-5 mb-4 border-l-4 border-[#C0392B]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Chip tone="accent">{POLITE_CARDS ? "Heads up" : "Objection"}</Chip>
              <Chip tone="neutral">{obj.topic.replace(/_/g, " ")}</Chip>
            </div>
            {typeof obj.confidence === "number" && (
              <span className="text-xs text-[#6B6560]">{Math.round(obj.confidence * 100)}% sure</span>
            )}
          </div>
          {POLITE_CARDS && (
            <p className="text-sm text-[#1A1715] mb-3">
              On {shortDate(obj.old.decidedAt) || `meeting #${obj.old.meeting_seq}`} you decided{" "}
              <span className="font-semibold">{obj.topic.replace(/_/g, " ")}</span>, and this now conflicts — here&rsquo;s the receipt:
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border-l-2 border-[#E0DED8] pl-3">
              <div className="text-[11px] uppercase text-[#9B9690] mb-1">
                Then — Meeting #{obj.old.meeting_seq}
                {obj.old.said_at ? ` · ${obj.old.said_at}` : ""}
              </div>
              <blockquote className="italic text-[#6B6560]">&ldquo;{obj.old.quote}&rdquo;</blockquote>
              <div className="text-[#9B9690] mt-1">— {obj.old.speaker}</div>
            </div>
            <div className="border-l-2 border-[#C0392B] pl-3">
              <div className="text-[11px] uppercase text-[#C0392B] mb-1">Now</div>
              <blockquote className="italic text-[#1A1715]">&ldquo;{obj.now.quote}&rdquo;</blockquote>
              <div className="text-[#9B9690] mt-1">— {obj.now.speaker}</div>
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
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  verdicts[i] === vd
                    ? "bg-[#1C1C1E] text-white border-[#1C1C1E]"
                    : "bg-white text-[#6B6560] border-[#E0DED8] hover:border-[#1A1715]"
                }`}
              >
                {verdictLabel(vd)}
              </button>
            ))}
            {verdicts[i] && (
              <span className="text-xs text-[#1C7A4A]">✓ {verdictLabel(verdicts[i])}</span>
            )}
          </div>
        </Card>
      ))}

      {/* Maybe chips */}
      {maybes.map((m, i) => (
        <Card key={i} className="p-3 mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wide text-[#9B9690]">
              Maybe a conflict · {m.topic.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-[#9B9690]">{Math.round(m.confidence * 100)}% sure</span>
          </div>
          <div className="text-xs text-[#6B6560]">
            Earlier: &ldquo;{m.old.quote}&rdquo; — {m.old.speaker} · Now: &ldquo;{m.now.quote}&rdquo;
          </div>
        </Card>
      ))}

      {/* Refinement chips */}
      {refinements.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {refinements.map((r, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-2 bg-white border border-[#E7E5E0] rounded-lg px-3 py-1.5 text-xs card-soft"
            >
              <Chip tone="neutral">refinement · not flagged</Chip>
              <span className="text-[#1A1715]">&ldquo;{r.quote}&rdquo;</span>
            </div>
          ))}
        </div>
      )}

      {/* Reasoning trail */}
      {trace.length > 0 && (
        <Card className="p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-serif text-lg text-[#1A1715]">Reasoning trail</h4>
            {agentPath && <Chip tone="neutral">path: {agentPath}</Chip>}
          </div>
          <ol className="space-y-2.5 text-sm">
            {trace.map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-[#9B9690] font-medium">{t.step}.</span>
                <div>
                  <span className="font-medium text-[#1A1715]">{t.tool}</span>
                  <span className="text-[#9B9690]">
                    {" "}
                    — {t.input} → {t.output}
                  </span>
                  <div className="text-[#6B6560] italic">{t.reasoning}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Confirmation tray */}
      {result && (
        <Card className="p-6 mb-10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFEEEA] pb-3 mb-4">
            <div>
              <h4 className="font-serif text-xl text-[#1A1715]">Confirmation tray</h4>
              <p className="text-xs text-[#9B9690]">
                Nothing is saved or sent to Notion until you tick and confirm.
              </p>
            </div>
            {committedStatus && (
              <Chip tone={committedStatus.startsWith("Confirmed") ? "green" : "accent"}>
                {committedStatus}
              </Chip>
            )}
          </div>

          <div className="space-y-2.5 my-4">
            {result.actions.map((act, i) => (
              <label
                key={`act-${i}`}
                className="flex items-start gap-3 p-3 rounded-xl border border-[#E7E5E0] cursor-pointer hover:border-[#C9C6BE]"
              >
                <input
                  type="checkbox"
                  checked={!!checkedActions[i]}
                  onChange={(e) =>
                    setCheckedActions((prev) => ({ ...prev, [i]: e.target.checked }))
                  }
                  className="mt-1 accent-[#1C1C1E]"
                />
                <div className="flex-1 text-sm">
                  <div className="font-medium text-[#1A1715]">{act.title}</div>
                  <div className="text-[#6B6560] text-xs">
                    {act.owner} · due {act.due_date}
                  </div>
                  <div className="text-[#9B9690] italic text-xs mt-0.5">
                    &ldquo;{act.source_quote}&rdquo;
                  </div>
                </div>
                <Chip tone="neutral">action</Chip>
              </label>
            ))}
            {result.decisions.map((dec, i) => (
              <label
                key={`dec-${i}`}
                className="flex items-start gap-3 p-3 rounded-xl border border-[#E7E5E0] cursor-pointer hover:border-[#C9C6BE]"
              >
                <input
                  type="checkbox"
                  checked={!!checkedDecisions[i]}
                  onChange={(e) =>
                    setCheckedDecisions((prev) => ({ ...prev, [i]: e.target.checked }))
                  }
                  className="mt-1 accent-[#1C1C1E]"
                />
                <div className="flex-1 text-sm">
                  <div className="font-medium text-[#1A1715]">{dec.summary}</div>
                  <div className="text-[#9B9690] italic text-xs mt-0.5">
                    &ldquo;{dec.exact_quote}&rdquo; — {dec.speaker}
                  </div>
                </div>
                <Chip tone="neutral">{dec.topic.replace(/_/g, " ")}</Chip>
              </label>
            ))}
          </div>

          <div className="pt-4 border-t border-[#EFEEEA] flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#9B9690]">Review each item before you confirm.</span>
            <PrimaryButton onClick={handleConfirm} disabled={isProcessing}>
              {isProcessing ? "Saving…" : "Tick & confirm"}
            </PrimaryButton>
          </div>
        </Card>
      )}

      {/* Decision timeline */}
      {timeline.length > 0 && (
        <Card className="p-6 mb-12">
          <h3 className="font-serif text-xl text-[#1A1715] mb-5">
            Decision history — {currentProjectName}
          </h3>
          <div className="space-y-5">
            {Object.entries(groupByTopic(timeline)).map(([topic, decs]) => (
              <div key={topic}>
                <div className="text-[11px] uppercase tracking-wide text-[#9B9690] mb-2">
                  {topic.replace(/_/g, " ")}
                </div>
                <ul className="space-y-2">
                  {decs.map((d) => {
                    const struck = d.status !== "active";
                    return (
                      <li key={d.id} className="text-sm flex items-start gap-2">
                        <span className={`flex-1 ${struck ? "line-through text-[#B9B6AE]" : "text-[#1A1715]"}`}>
                          &ldquo;{d.exact_quote}&rdquo;{" "}
                          <span className="text-[#9B9690]">
                            — {d.speaker} · M#{d.meeting_seq}
                            {d.said_at ? ` · ${d.said_at}` : ""}
                          </span>
                        </span>
                        {struck && (
                          <Chip tone="accent">{d.status === "overruled" ? "overruled" : "pivot"}</Chip>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}
    </AppShell>
  );
}
