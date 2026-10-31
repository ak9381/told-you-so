"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { Card, SectionTitle, Chip, PrimaryButton, SecondaryButton } from "@/components/ui";
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

// --- Live Meeting (folded in from the old /live page) ---
interface LiveLine {
  id: number;
  text: string;
  speaker: string;
  ts: string;
}
interface LiveCard {
  verdict: "contradicts" | "refines" | "new";
  quote: string;
  topic: string;
  old_quote?: string;
  old_speaker?: string;
  old_meeting_seq?: number;
  reasoning?: string;
  ts: string;
}

// Mic-free demo scripts, per project (safety net for the live demo).
const DEMO_CLIPS: Record<string, { speaker: string; text: string }[]> = {
  "Hackathon submission": [
    { speaker: "Akash", text: "Okay everyone, quick sync on the hackathon submission." },
    { speaker: "Rohan", text: "I think the demo video can be like five minutes, we have a lot to show." },
    { speaker: "Akash", text: "And the LinkedIn posts we can do by Monday, right?" },
    { speaker: "Neha", text: "Let's submit by 11 PM tonight to be safe." },
    { speaker: "Akash", text: "Decided: Priya owns the demo video, due 10:30 tonight." },
    { speaker: "Akash", text: "Okay, ending the meeting." },
  ],
  "Fintech recon dashboard": [
    { speaker: "Akash", text: "Welcome Ankit, quick sync on the dashboard." },
    { speaker: "Ankit", text: "Why are we on Postgres? Mongo is faster for dashboards, let's switch." },
    { speaker: "Ankit", text: "And let's just do polling, webhooks are overkill for an MVP." },
    { speaker: "Ankit", text: "Clerk for auth is fine by me, maybe with Google login only." },
    { speaker: "Akash", text: "Decided: Ankit owns the dashboard read-model spec, due Tuesday." },
  ],
};
const DEFAULT_CLIP = DEMO_CLIPS["Hackathon submission"];

// Turn a pasted Google Meet / Zoom URL into a browser-joinable URL.
// Returns null if the link is neither Meet nor Zoom.
function normalizeMeetingLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let u: URL;
  try {
    u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host === "meet.google.com") return u.toString();
  if (host === "zoom.us" || host.endsWith(".zoom.us")) {
    const m = u.pathname.match(/\/(?:j|wc\/join)\/(\d+)/);
    if (m) {
      const id = m[1];
      const pwd = u.searchParams.get("pwd");
      const q = pwd ? `?pwd=${encodeURIComponent(pwd)}` : "";
      return `https://zoom.us/wc/join/${id}${q}`;
    }
  }
  return null;
}

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
  const [view, setView] = useState<"Day" | "Week" | "Month" | "Year">("Week");
  const [meetingLink, setMeetingLink] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Meeting state (folded in from /live).
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [liveLines, setLiveLines] = useState<LiveLine[]>([]);
  const [liveCards, setLiveCards] = useState<LiveCard[]>([]);
  const [lastSpeaker, setLastSpeaker] = useState("Speaker ?");
  const [liveStatus, setLiveStatus] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [linkError, setLinkError] = useState("");
  const [launchHint, setLaunchHint] = useState("");
  const liveStartRef = useRef<number>(Date.now());
  const liveLineId = useRef(0);
  const liveInFlight = useRef(false);
  const recognitionRef = useRef<unknown>(null);

  const liveOpen =
    meetingLink.trim().length > 0 || listening || liveLines.length > 0 || liveCards.length > 0;

  // Upload a .txt/.md transcript or WhatsApp export → fills the box (paste mode).
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setActiveTab("paste");
      setRawInput(String(reader.result || ""));
    };
    reader.readAsText(file);
  }

  // Feature-detect Web Speech once.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      !("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    ) {
      setSpeechSupported(false);
    }
  }, []);

  const mmss = () => {
    const s = Math.floor((Date.now() - liveStartRef.current) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const addLiveLine = (speaker: string, text: string) => {
    liveLineId.current += 1;
    setLiveLines((prev) => [...prev, { id: liveLineId.current, text, speaker, ts: mmss() }]);
  };

  // Send new text to the live-check route (one request in flight).
  const sendForCheck = useCallback(
    async (text: string, demo = false) => {
      if (!selectedProjectId || (!demo && liveInFlight.current)) return;
      if (!demo) liveInFlight.current = true;
      try {
        const res = await fetch("/api/live-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newText: text, projectId: selectedProjectId, demo }),
        });
        const data = await res.json();
        if (data.results?.length) {
          const stamped: LiveCard[] = data.results.map((r: LiveCard) => ({ ...r, ts: mmss() }));
          setLiveCards((prev) => [...stamped, ...prev]);
        }
      } catch {
        /* ignore transient live-check errors */
      } finally {
        if (!demo) liveInFlight.current = false;
      }
    },
    [selectedProjectId]
  );

  function startListening() {
    const W = window as unknown as {
      webkitSpeechRecognition?: new () => unknown;
      SpeechRecognition?: new () => unknown;
    };
    const Rec = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Rec) {
      setSpeechSupported(false);
      return;
    }
    liveStartRef.current = Date.now();
    const rec = new Rec() as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (e: unknown) => void;
      onerror: () => void;
      start: () => void;
      stop: () => void;
    };
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";
    let buffer: string[] = [];
    rec.onresult = (e: unknown) => {
      const ev = e as {
        resultIndex: number;
        results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
      };
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          const t = r[0].transcript.trim();
          if (t) {
            addLiveLine("Speaker ?", t);
            buffer.push(t);
            if (buffer.length >= 2) {
              sendForCheck(buffer.join(" "));
              buffer = [];
            }
          }
        } else {
          interimText += r[0].transcript;
        }
      }
      setInterim(interimText);
    };
    rec.onerror = () => setLiveStatus("Mic error — use Play demo clip.");
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    setLiveStatus("Listening… speak near the mic.");
    const flush = setInterval(() => {
      if (buffer.length) {
        sendForCheck(buffer.join(" "));
        buffer = [];
      }
    }, 15000);
    (rec as unknown as { _flush?: number })._flush = flush as unknown as number;
  }

  function stopListening() {
    const rec = recognitionRef.current as { stop?: () => void; _flush?: number } | null;
    if (rec?.stop) rec.stop();
    if (rec?._flush) clearInterval(rec._flush);
    setListening(false);
    setInterim("");
    setLiveStatus("");
  }

  async function playDemoClip() {
    stopListening();
    liveStartRef.current = Date.now();
    setLiveLines([]);
    setLiveCards([]);
    setLiveStatus("Playing demo clip…");
    const clip = DEMO_CLIPS[currentProjectName] ?? DEFAULT_CLIP;
    for (const line of clip) {
      addLiveLine(line.speaker, line.text);
      await sendForCheck(line.text, true);
      await new Promise((r) => setTimeout(r, 1200));
    }
    setLiveStatus("Demo clip finished.");
  }

  // Open the meeting popup from a pasted link, then start listening.
  function launchFromLink() {
    setLinkError("");
    setLaunchHint("");
    const url = normalizeMeetingLink(meetingLink);
    if (!url) {
      setLinkError("Only Google Meet and Zoom links are supported for now.");
      return;
    }
    const sw = typeof window !== "undefined" ? window.screen.availWidth : 1280;
    const sh = typeof window !== "undefined" ? window.screen.availHeight : 800;
    const w = Math.floor(sw / 2);
    window.open(url, "_blank", `width=${w},height=${sh},left=0,top=0`);
    if (speechSupported) {
      setLaunchHint("Sign in if asked, join the call, and we'll start listening.");
      startListening();
    } else {
      setLaunchHint("Open this in Chrome to listen live — or use Play Demo Clip.");
    }
  }

  // End the live meeting: pour the transcript into the tray via the full agent.
  function endLiveMeeting() {
    stopListening();
    const transcript = liveLines.map((l) => `${l.speaker}: ${l.text}`).join("\n");
    if (!transcript.trim()) return;
    setActiveTab("paste");
    setRawInput(transcript);
    handleExtract(transcript);
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  }

  function tagSpeaker(id: number, name: string) {
    if (!name) return;
    setLastSpeaker(name);
    setLiveLines((prev) => prev.map((l) => (l.id === id ? { ...l, speaker: name } : l)));
  }

  const liveObjectionCount = liveCards.filter((c) => c.verdict === "contradicts").length;

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

  async function handleExtract(textArg?: string) {
    const input = typeof textArg === "string" ? textArg : rawInput;
    if (!input.trim()) return;
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
      <Card className="px-6 md:px-8 py-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-[#1A1715]">
              {currentProjectName}
            </h1>
            <p className="text-[#9B9690] text-sm mt-1">{autoMeetingTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:inline-flex items-center rounded-full bg-[#F3F3F1] px-1 py-1 text-sm">
              {(["Day", "Week", "Month", "Year"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    view === v
                      ? "bg-white text-[#1A1715] shadow-sm font-medium"
                      : "text-[#9B9690] hover:text-[#1A1715]"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <span className="rounded-full bg-[#F3F3F1] px-3.5 py-1.5 text-sm text-[#6B6560]">
              60 AI calls left
            </span>
          </div>
        </div>
      </Card>

      {/* Four ways to put info in — Bento */}
      <SectionTitle>Four ways to put info in</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* Dictate with Wispr */}
        <Card className="p-6" hover>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">🎙️</span>
            <h3 className="font-serif text-2xl text-[#1A1715]">Dictate with Wispr</h3>
          </div>
          <textarea
            rows={4}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Hold Fn and just talk — Wispr Flow types it. e.g. Um, so Harsh, no wait, I take the video by Tuesday…"
            className="w-full rounded-xl border border-[#E7E5E0] bg-white/60 p-3.5 text-sm text-[#1A1715] focus:outline-none focus:border-[#B9B6AE] focus:ring-2 focus:ring-[#EDEDEB]"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-3 text-xs text-[#9B9690]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("debrief");
                  setRawInput(
                    "Um, like, quick update. Harsh, no wait, I take the video, by Tuesday. The coffee machine broke again anyway."
                  );
                }}
                className="underline hover:text-[#1A1715]"
              >
                Sample debrief
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
                Sample WhatsApp
              </button>
            </div>
            <PrimaryButton onClick={() => handleExtract()} disabled={isProcessing || !rawInput.trim()}>
              {isProcessing ? "Analyzing…" : "Process"}
            </PrimaryButton>
          </div>
        </Card>

        {/* Upload Files */}
        <Card className="p-6" hover>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">⬆️</span>
              <h3 className="font-serif text-2xl text-[#1A1715]">Upload Files</h3>
            </div>
            <span
              title="Works with WhatsApp and Slack too — export the chat (WhatsApp: Export chat → Without media) and drop the .txt here. No API needed."
              className="cursor-help w-5 h-5 rounded-full border border-[#D8D6D0] text-[#9B9690] text-[11px] font-serif flex items-center justify-center hover:border-[#B9B6AE] hover:text-[#6B6560]"
            >
              i
            </span>
          </div>
          <p className="text-sm text-[#6B6560] mb-4">Drag &amp; drop notes, transcripts, or chat exports.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-[#D8D6D0] bg-white/40 py-7 text-sm text-[#9B9690] hover:border-[#B9B6AE] hover:text-[#6B6560] transition-colors"
          >
            Drop files here or <span className="underline">browse</span>
          </button>
          {activeTab === "paste" && rawInput && (
            <p className="mt-2 text-xs text-[#1C7A4A]">Loaded — review in the Dictate box, then Process.</p>
          )}
        </Card>

        {/* Connect Calendar */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">📅</span>
            <h3 className="font-serif text-2xl text-[#1A1715]">Connect Calendar</h3>
          </div>
          <p className="text-sm text-[#6B6560] mb-4">Import events &amp; meetings automatically.</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#6B6560]">Google Calendar</span>
            <Chip tone="neutral">Coming soon</Chip>
          </div>
        </Card>

        {/* Live Meeting */}
        <Card className="p-6" hover>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">📡</span>
            <h3 className="font-serif text-2xl text-[#1A1715]">Live Meeting</h3>
          </div>
          <input
            value={meetingLink}
            onChange={(e) => {
              setMeetingLink(e.target.value);
              if (linkError) setLinkError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") launchFromLink();
            }}
            placeholder="Paste a Google Meet or Zoom link…"
            className="w-full rounded-xl border border-[#E7E5E0] bg-white/60 px-3.5 py-2.5 text-sm text-[#1A1715] mb-3 focus:outline-none focus:border-[#B9B6AE] focus:ring-2 focus:ring-[#EDEDEB]"
          />
          <button
            onClick={launchFromLink}
            disabled={!meetingLink.trim()}
            className="w-full bg-[#1C1C1E] text-white rounded-xl py-3 text-sm font-medium hover:bg-[#333338] disabled:opacity-50 transition-colors"
          >
            Launch &amp; Listen
          </button>
          {linkError && <p className="text-sm text-[#C0392B] mt-2">{linkError}</p>}
          <p className="text-xs text-[#9B9690] mt-3">
            Paste a link to open the call and reveal the live listener below — or{" "}
            <button
              type="button"
              onClick={playDemoClip}
              className="underline hover:text-[#6B6560]"
            >
              play a demo clip
            </button>
            .
          </p>
        </Card>
      </div>

      {/* Live meeting listener — revealed once a link is pasted or a clip plays */}
      {liveOpen && (
        <Card className="p-6 mb-8" id="live">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">📡</span>
              <h3 className="font-serif text-2xl text-[#1A1715]">
                Live meeting — {currentProjectName}
              </h3>
            </div>
            <Chip tone={liveObjectionCount > 0 ? "accent" : "neutral"}>
              {liveObjectionCount} objection{liveObjectionCount === 1 ? "" : "s"}
            </Chip>
          </div>

          {launchHint && <p className="text-sm text-[#6B6560] mb-3">{launchHint}</p>}

          <div className="flex flex-wrap gap-3 items-center">
            {!listening ? (
              <PrimaryButton onClick={startListening} disabled={!speechSupported || !selectedProjectId}>
                ● Start listening
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={stopListening}>■ Stop</PrimaryButton>
            )}
            <SecondaryButton onClick={playDemoClip} disabled={!selectedProjectId}>
              ▶ Play demo clip
            </SecondaryButton>
            {liveLines.length > 0 && (
              <SecondaryButton onClick={endLiveMeeting}>End meeting → tray</SecondaryButton>
            )}
            {liveStatus && <span className="text-sm text-[#6B6560]">{liveStatus}</span>}
            {!speechSupported && (
              <span className="text-sm text-[#C0392B]">
                Web Speech not available here — use Play demo clip.
              </span>
            )}
          </div>
          <p className="text-xs text-[#9B9690] mt-3 mb-5">
            Uses Chrome&rsquo;s built-in speech recognition (not Wispr), so it doesn&rsquo;t touch your Wispr word count.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live transcript */}
            <div className="rounded-xl border border-[#E7E5E0] bg-white/50 p-5">
              <h4 className="font-serif text-lg text-[#1A1715] mb-3">Live transcript</h4>
              <div className="space-y-2.5 text-sm max-h-[360px] overflow-y-auto">
                {liveLines.length === 0 && (
                  <p className="text-[#9B9690]">Nothing yet — start listening or play the demo clip.</p>
                )}
                {liveLines.map((l) => (
                  <div key={l.id} className="flex items-start gap-2.5">
                    <span className="text-[#9B9690] shrink-0 tabular-nums text-xs pt-0.5">{l.ts}</span>
                    <input
                      value={l.speaker}
                      onChange={(e) => tagSpeaker(l.id, e.target.value)}
                      onFocus={(e) => {
                        if (e.target.value === "Speaker ?")
                          tagSpeaker(l.id, lastSpeaker === "Speaker ?" ? "" : lastSpeaker);
                      }}
                      className={`w-24 shrink-0 bg-transparent border-b border-dashed text-sm focus:outline-none ${
                        l.speaker === "Speaker ?"
                          ? "border-[#C0392B] text-[#C0392B]"
                          : "border-[#E0DED8] text-[#6B6560]"
                      }`}
                    />
                    <span className="text-[#1A1715]">{l.text}</span>
                  </div>
                ))}
                {interim && (
                  <div className="flex items-start gap-2.5 opacity-50">
                    <span className="text-[#9B9690] shrink-0 text-xs pt-0.5">…</span>
                    <span className="text-[#9B9690] italic">{interim}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Live objections */}
            <div className="rounded-xl border border-[#E7E5E0] bg-white/50 p-5">
              <h4 className="font-serif text-lg text-[#1A1715] mb-3">Live objections</h4>
              <div className="space-y-3 max-h-[360px] overflow-y-auto">
                {liveCards.length === 0 && (
                  <p className="text-sm text-[#9B9690]">No conflicts flagged yet.</p>
                )}
                {liveCards.map((c, i) => {
                  if (c.verdict === "contradicts") {
                    return (
                      <div key={i} className="rounded-xl border border-[#C0392B]/40 bg-[#FBE9E7] p-4">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="font-serif text-base font-semibold text-[#C0392B]">
                            Objection
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-[#C0392B]">
                            {c.topic} · {c.ts}
                          </span>
                        </div>
                        <div className="text-sm space-y-1.5">
                          <div className="text-[#6B6560]">
                            <span className="uppercase text-[10px] font-semibold tracking-wider">Then</span>{" "}
                            — &ldquo;{c.old_quote}&rdquo;
                            {c.old_speaker ? ` — ${c.old_speaker}` : ""}
                            {c.old_meeting_seq ? ` · M#${c.old_meeting_seq}` : ""}
                          </div>
                          <div className="text-[#1A1715]">
                            <span className="uppercase text-[10px] font-semibold tracking-wider text-[#C0392B]">
                              Now
                            </span>{" "}
                            — &ldquo;{c.quote}&rdquo;
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (c.verdict === "refines") {
                    return (
                      <div key={i} className="rounded-xl bg-[#F1F0EC] border border-[#E7E5E0] px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Chip tone="neutral">Refinement</Chip>
                          <span className="text-[10px] uppercase tracking-wider text-[#9B9690]">
                            not flagged · {c.ts}
                          </span>
                        </div>
                        <div className="text-sm text-[#1A1715]">&ldquo;{c.quote}&rdquo;</div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="rounded-xl bg-white border border-[#E7E5E0] px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Chip tone="green">New decision</Chip>
                        <span className="text-[10px] uppercase tracking-wider text-[#9B9690]">{c.ts}</span>
                      </div>
                      <div className="text-sm text-[#1A1715]">&ldquo;{c.quote}&rdquo;</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-sm text-[#6B6560] mt-5 text-center">
            After the call, hit <span className="font-medium">End meeting → tray</span> to run the full agent and review before saving.
          </p>
        </Card>
      )}

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
