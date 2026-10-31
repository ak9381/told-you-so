"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Masthead from "@/components/Masthead";

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

// Meeting-2 demo script (plan §5c) — the mic-free fallback path.
const DEMO_CLIP: { speaker: string; text: string }[] = [
  { speaker: "Akash", text: "Okay everyone, quick sync on the hackathon submission." },
  { speaker: "Rohan", text: "I think the demo video can be like five minutes, we have a lot to show." },
  { speaker: "Akash", text: "And the LinkedIn posts we can do by Monday, right?" },
  { speaker: "Neha", text: "Let's submit by 11 PM tonight to be safe." },
  { speaker: "Akash", text: "Decided: Priya owns the demo video, due 10:30 tonight." },
  { speaker: "Akash", text: "Okay, ending the meeting." },
];

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
    for (const line of DEMO_CLIP) {
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

  function tagSpeaker(id: number, name: string) {
    if (!name) return;
    setLastSpeaker(name);
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, speaker: name } : l)));
  }

  const projectName = projects.find((p) => p.id === projectId)?.name || "Meeting";
  const objectionCount = cards.filter((c) => c.verdict === "contradicts").length;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 min-h-screen">
      <Masthead />

      {/* Controls */}
      <section className="border border-[#DDD3C1] bg-[#FAF7F2] p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="font-mono text-xs uppercase tracking-wider text-[#78716C]">
              Workstream:
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="border border-[#DDD3C1] bg-[#F4EFE6] px-3 py-1 font-mono text-sm text-[#1C1917]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <span className="font-mono text-xs text-[#1C1917] font-semibold bg-[#E8E1D5] px-3 py-1 border border-[#DDD3C1]">
            LIVE · {projectName} #2
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 items-center">
          {!listening ? (
            <button
              onClick={startListening}
              disabled={!supported || !projectId}
              className="bg-[#C0392B] text-[#F4EFE6] font-mono text-xs uppercase tracking-wider px-5 py-2.5 hover:bg-[#962D22] disabled:opacity-50"
            >
              ● Start Listening
            </button>
          ) : (
            <button
              onClick={stopListening}
              className="bg-[#1C1917] text-[#F4EFE6] font-mono text-xs uppercase tracking-wider px-5 py-2.5"
            >
              ■ Stop
            </button>
          )}
          <button
            onClick={playDemoClip}
            disabled={!projectId}
            className="bg-[#1C1917] text-[#F4EFE6] font-mono text-xs uppercase tracking-wider px-5 py-2.5 hover:bg-[#44403C] disabled:opacity-50"
          >
            ▶ Play Demo Clip
          </button>
          {lines.length > 0 && (
            <button
              onClick={endMeeting}
              className="border border-[#1C1917] text-[#1C1917] font-mono text-xs uppercase tracking-wider px-5 py-2.5 hover:bg-[#1C1917] hover:text-[#F4EFE6]"
            >
              ⤓ End Meeting → Tray
            </button>
          )}
          {status && (
            <span className="font-mono text-xs text-[#78716C]">{status}</span>
          )}
          {!supported && (
            <span className="font-mono text-xs text-[#C0392B]">
              Web Speech not available in this browser — use Play Demo Clip.
            </span>
          )}
        </div>
        <p className="font-mono text-[11px] text-[#78716C] mt-3">
          Uses Chrome&rsquo;s built-in speech recognition (not Wispr), so it doesn&rsquo;t touch your Wispr word count.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Live transcript */}
        <section className="border border-[#DDD3C1] bg-[#FAF7F2] p-5">
          <h3 className="font-serif text-lg font-bold text-[#1C1917] border-b border-[#DDD3C1] pb-2 mb-3">
            Live Transcript
          </h3>
          <div className="space-y-2 font-mono text-xs max-h-[420px] overflow-y-auto">
            {lines.length === 0 && (
              <p className="text-[#78716C] italic">Nothing yet — start listening or play the demo clip.</p>
            )}
            {lines.map((l) => (
              <div key={l.id} className="flex items-start gap-2">
                <span className="text-[#78716C] shrink-0">[{l.ts}]</span>
                <input
                  value={l.speaker}
                  onChange={(e) => tagSpeaker(l.id, e.target.value)}
                  onFocus={(e) => {
                    if (e.target.value === "Speaker ?") tagSpeaker(l.id, lastSpeaker === "Speaker ?" ? "" : lastSpeaker);
                  }}
                  className={`w-24 shrink-0 bg-transparent border-b border-dashed ${
                    l.speaker === "Speaker ?" ? "border-[#C0392B] text-[#C0392B]" : "border-[#DDD3C1] text-[#1C1917]"
                  } focus:outline-none`}
                />
                <span className="text-[#1C1917]">{l.text}</span>
              </div>
            ))}
            {interim && (
              <div className="flex items-start gap-2 opacity-50">
                <span className="text-[#78716C] shrink-0">[…]</span>
                <span className="text-[#A8A29E] italic">{interim}</span>
              </div>
            )}
          </div>
        </section>

        {/* Live objections */}
        <section className="border border-[#DDD3C1] bg-[#FAF7F2] p-5">
          <div className="flex items-center justify-between border-b border-[#DDD3C1] pb-2 mb-3">
            <h3 className="font-serif text-lg font-bold text-[#1C1917]">Live Objections</h3>
            <span className="font-mono text-[10px] uppercase text-[#C0392B]">
              {objectionCount} objection{objectionCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {cards.length === 0 && (
              <p className="font-mono text-xs text-[#78716C] italic">No conflicts flagged yet.</p>
            )}
            {cards.map((c, i) => {
              if (c.verdict === "contradicts") {
                return (
                  <div key={i} className="border-2 border-[#C0392B] bg-[#FADBD8]/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-serif text-xl font-black text-[#C0392B] -rotate-1">OBJECTION!</span>
                      <span className="font-mono text-[9px] uppercase border border-[#C0392B] text-[#962D22] px-1.5 py-0.5">
                        {c.topic} · [{c.ts}]
                      </span>
                    </div>
                    <div className="font-mono text-[11px] space-y-1">
                      <div className="text-[#78716C]">
                        <span className="uppercase text-[9px] font-bold">Then</span> — &ldquo;{c.old_quote}&rdquo;
                        {c.old_speaker ? ` — ${c.old_speaker}` : ""}
                        {c.old_meeting_seq ? ` · M#${c.old_meeting_seq}` : ""}
                      </div>
                      <div className="text-[#1C1917]">
                        <span className="uppercase text-[9px] font-bold text-[#C0392B]">Now</span> — &ldquo;{c.quote}&rdquo;
                      </div>
                    </div>
                  </div>
                );
              }
              if (c.verdict === "refines") {
                return (
                  <div key={i} className="bg-[#E8E1D5] border border-[#DDD3C1] px-3 py-2 font-mono text-[11px]">
                    <span className="uppercase text-[9px] text-[#78716C]">refinement · not flagged · [{c.ts}]</span>
                    <div className="text-[#1C1917]">&ldquo;{c.quote}&rdquo;</div>
                  </div>
                );
              }
              return (
                <div key={i} className="bg-[#F4EFE6] border border-[#DDD3C1] px-3 py-2 font-mono text-[11px]">
                  <span className="uppercase text-[9px] text-[#1C7A4A]">new decision · [{c.ts}]</span>
                  <div className="text-[#1C1917]">&ldquo;{c.quote}&rdquo;</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <p className="font-mono text-[11px] text-[#78716C] mt-6 text-center">
        After the call, confirm decisions on the{" "}
        <a href="/" className="underline hover:text-[#1C1917]">home page</a> — paste the transcript into the Debrief/Paste box to run the full agent and tray.
      </p>
    </main>
  );
}
