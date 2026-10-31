"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import {
  Card,
  PageTitle,
  SectionTitle,
  Chip,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";

interface ProjectOption {
  id: string;
  name: string;
}
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

// Mic-free demo scripts, per project (plan §5c; fintech = stage-9d §4).
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

  // Google Meet: meet.google.com/abc-defg-hij
  if (host === "meet.google.com") {
    return u.toString();
  }

  // Zoom: *.zoom.us/j/<id> (optionally ?pwd=…) → browser-join URL
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

export default function LivePage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [lines, setLines] = useState<LiveLine[]>([]);
  const [cards, setCards] = useState<LiveCard[]>([]);
  const [lastSpeaker, setLastSpeaker] = useState("Speaker ?");
  const [status, setStatus] = useState<string>("");
  const [supported, setSupported] = useState(true);

  // Launch-from-link feature state (client-side only).
  const [meetingLink, setMeetingLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [launchHint, setLaunchHint] = useState("");

  const startRef = useRef<number>(Date.now());
  const lineId = useRef(0);
  const inFlight = useRef(false);
  const recognitionRef = useRef<unknown>(null);
  const router = useRouter();

  // End the meeting: hand the transcript to the home page to run the full
  // extraction + agent into the confirmation tray.
  function endMeeting() {
    stopListening();
    const transcript = lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");
    try {
      sessionStorage.setItem("tys_live_transcript", transcript);
    } catch {
      /* sessionStorage may be unavailable */
    }
    router.push("/");
  }

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (d.projects?.length) {
          setProjects(d.projects);
          setProjectId(d.projects[0].id);
        }
      })
      .catch(() => {});
    // Feature-detect Web Speech
    if (
      typeof window !== "undefined" &&
      !(
        "webkitSpeechRecognition" in window || "SpeechRecognition" in window
      )
    ) {
      setSupported(false);
    }
  }, []);

  const mmss = () => {
    const s = Math.floor((Date.now() - startRef.current) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  // Send new text to the live-check route (one request in flight).
  const sendForCheck = useCallback(
    async (text: string) => {
      if (!projectId || inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await fetch("/api/live-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newText: text, projectId }),
        });
        const data = await res.json();
        if (data.results?.length) {
          const stamped: LiveCard[] = data.results.map((r: LiveCard) => ({
            ...r,
            ts: mmss(),
          }));
          setCards((prev) => [...stamped, ...prev]);
        }
      } catch {
        /* ignore transient live-check errors */
      } finally {
        inFlight.current = false;
      }
    },
    [projectId]
  );

  const addLine = (speaker: string, text: string) => {
    lineId.current += 1;
    setLines((prev) => [...prev, { id: lineId.current, text, speaker, ts: mmss() }]);
  };

  function startListening() {
    const W = window as unknown as {
      webkitSpeechRecognition?: new () => unknown;
      SpeechRecognition?: new () => unknown;
    };
    const Rec = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Rec) {
      setSupported(false);
      return;
    }
    startRef.current = Date.now();
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
            addLine("Speaker ?", t);
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
    rec.onerror = () => setStatus("Mic error — use Play demo clip.");
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    setStatus("Listening… speak near the mic.");
    // flush buffer every 15s
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
    setStatus("");
  }

  async function playDemoClip() {
    stopListening();
    startRef.current = Date.now();
    setLines([]);
    setCards([]);
    setStatus("Playing demo clip…");
    const name = projects.find((p) => p.id === projectId)?.name || "";
    const clip = DEMO_CLIPS[name] ?? DEFAULT_CLIP;
    for (const line of clip) {
      addLine(line.speaker, line.text);
      await sendForCheckBlocking(line.text);
      await new Promise((r) => setTimeout(r, 1200));
    }
    setStatus("Demo clip finished.");
  }

  // Blocking variant used by the demo clip so results arrive in order.
  async function sendForCheckBlocking(text: string) {
    if (!projectId) return;
    try {
      const res = await fetch("/api/live-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newText: text, projectId, demo: true }),
      });
      const data = await res.json();
      if (data.results?.length) {
        const stamped: LiveCard[] = data.results.map((r: LiveCard) => ({ ...r, ts: mmss() }));
        setCards((prev) => [...stamped, ...prev]);
      }
    } catch {
      /* ignore */
    }
  }

  // Launch the meeting popup from a pasted link, then start listening.
  function launchFromLink() {
    setLinkError("");
    setLaunchHint("");
    const url = normalizeMeetingLink(meetingLink);
    if (!url) {
      setLinkError("Only Google Meet and Zoom links are supported for now.");
      return;
    }
    // Open the meeting on the left half of the screen.
    const sw = typeof window !== "undefined" ? window.screen.availWidth : 1280;
    const sh = typeof window !== "undefined" ? window.screen.availHeight : 800;
    const w = Math.floor(sw / 2);
    window.open(url, "_blank", `width=${w},height=${sh},left=0,top=0`);

    if (supported) {
      setLaunchHint("Sign in if asked, join the call, and we'll start listening.");
      startListening();
    } else {
      setLaunchHint("Open this in Chrome to listen live — or use Play Demo Clip.");
    }
  }

  function tagSpeaker(id: number, name: string) {
    if (!name) return;
    setLastSpeaker(name);
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, speaker: name } : l)));
  }

  const projectName = projects.find((p) => p.id === projectId)?.name || "Meeting";
  const objectionCount = cards.filter((c) => c.verdict === "contradicts").length;

  const titleControls = (
    <>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className="bg-white border border-[#E0DED8] rounded-xl px-4 py-2.5 text-sm text-[#1A1715] focus:outline-none focus:border-[#9B9690]"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Chip tone="dark">Live · {projectName} #2</Chip>
    </>
  );

  return (
    <AppShell>
      <PageTitle aside={titleControls}>Live Meeting</PageTitle>

      {/* Launch from a meeting link */}
      <Card className="p-6 mb-6" hover>
        <SectionTitle>Launch from a meeting link</SectionTitle>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={meetingLink}
              onChange={(e) => {
                setMeetingLink(e.target.value);
                if (linkError) setLinkError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") launchFromLink();
              }}
              placeholder="Paste a Google Meet or Zoom link…"
              className="w-full bg-white border border-[#E0DED8] rounded-xl px-4 py-2.5 text-sm text-[#1A1715] placeholder:text-[#9B9690] focus:outline-none focus:border-[#9B9690]"
            />
            {linkError && (
              <p className="text-sm text-[#C0392B] mt-2">{linkError}</p>
            )}
            {launchHint && !linkError && (
              <p className="text-sm text-[#6B6560] mt-2">{launchHint}</p>
            )}
          </div>
          <PrimaryButton onClick={launchFromLink} className="shrink-0">
            Launch
          </PrimaryButton>
        </div>
        <p className="text-sm text-[#9B9690] mt-3">
          We open the meeting in a window on the left and start listening in this tab.
        </p>
      </Card>

      {/* Controls */}
      <Card className="p-6 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          {!listening ? (
            <PrimaryButton onClick={startListening} disabled={!supported || !projectId}>
              ● Start Listening
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={stopListening}>■ Stop</PrimaryButton>
          )}
          <SecondaryButton onClick={playDemoClip} disabled={!projectId}>
            ▶ Play Demo Clip
          </SecondaryButton>
          {lines.length > 0 && (
            <SecondaryButton onClick={endMeeting}>End Meeting → Tray</SecondaryButton>
          )}
          {status && <span className="text-sm text-[#6B6560]">{status}</span>}
          {!supported && (
            <span className="text-sm text-[#C0392B]">
              Web Speech not available in this browser — use Play Demo Clip.
            </span>
          )}
        </div>
        <p className="text-sm text-[#9B9690] mt-4">
          Uses Chrome&rsquo;s built-in speech recognition (not Wispr), so it doesn&rsquo;t touch your Wispr word count.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Live transcript */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl font-medium text-[#1A1715]">Live Transcript</h3>
          </div>
          <div className="space-y-2.5 text-sm max-h-[420px] overflow-y-auto">
            {lines.length === 0 && (
              <p className="text-[#9B9690]">Nothing yet — start listening or play the demo clip.</p>
            )}
            {lines.map((l) => (
              <div key={l.id} className="flex items-start gap-2.5">
                <span className="text-[#9B9690] shrink-0 tabular-nums text-xs pt-0.5">{l.ts}</span>
                <input
                  value={l.speaker}
                  onChange={(e) => tagSpeaker(l.id, e.target.value)}
                  onFocus={(e) => {
                    if (e.target.value === "Speaker ?") tagSpeaker(l.id, lastSpeaker === "Speaker ?" ? "" : lastSpeaker);
                  }}
                  className={`w-24 shrink-0 bg-transparent border-b border-dashed text-sm focus:outline-none ${
                    l.speaker === "Speaker ?" ? "border-[#C0392B] text-[#C0392B]" : "border-[#E0DED8] text-[#6B6560]"
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
        </Card>

        {/* Live objections */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl font-medium text-[#1A1715]">Live Objections</h3>
            <Chip tone={objectionCount > 0 ? "accent" : "neutral"}>
              {objectionCount} objection{objectionCount === 1 ? "" : "s"}
            </Chip>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {cards.length === 0 && (
              <p className="text-sm text-[#9B9690]">No conflicts flagged yet.</p>
            )}
            {cards.map((c, i) => {
              if (c.verdict === "contradicts") {
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-[#C0392B]/40 bg-[#FBE9E7] p-4"
                  >
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
        </Card>
      </div>

      <p className="text-sm text-[#6B6560] mt-6 text-center">
        After the call, confirm decisions on the{" "}
        <a href="/" className="underline hover:text-[#1A1715]">home page</a> — paste the transcript into the Debrief/Paste box to run the full agent and tray.
      </p>
    </AppShell>
  );
}
