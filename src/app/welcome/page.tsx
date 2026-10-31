import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Told You So — the meeting agent that argues back",
  description:
    "Told You So remembers what your team decided — across calls, Google Meet, Zoom and WhatsApp — and objects, with the exact quote, when someone contradicts it. Decision logs failed because writing them is a chore. This one writes itself from your voice and chats.",
  keywords: [
    "meeting agent",
    "decision log",
    "conflict detection",
    "meeting notes AI",
    "WhatsApp decisions",
    "architecture decision records",
    "Wispr Flow",
  ],
  openGraph: {
    title: "Told You So — the meeting agent that argues back",
    description:
      "Remembers what your team decided across calls and WhatsApp, and objects — with receipts — when someone drifts.",
    type: "website",
  },
};

const DIFFERENTIATORS = [
  {
    k: "It argues back",
    v: "Checks new talk against earlier decisions in the same project — live, during the meeting — and quotes the exact old line. Summaries only describe what was said today.",
  },
  {
    k: "It reads every source",
    v: "Voice, Google Meet, Zoom and WhatsApp land in one record, with a “sources don’t match” check across them. Most tools only cover their own meeting bot.",
  },
  {
    k: "Refinement ≠ reversal",
    v: "“By 11 PM” isn’t a new deadline; “Postgres with read replicas” isn’t a switch to Mongo. Proven with live precision/recall on the /eval page.",
  },
  {
    k: "Confirm before save",
    v: "Nothing is written until you tick it in the tray. Every “keep old” or “not a conflict” click is a label it learns from — rivals auto-save, so their mistakes pile up.",
  },
];

const CONTEXT = [
  {
    k: "Who it’s for",
    v: "Agencies and IT-services firms where a client re-opening a settled decision costs billable hours. And engineering teams whose settled architecture keeps getting re-argued.",
  },
  {
    k: "How it works",
    v: "Two steps, not one big prompt: extract decisions (Gemini 3.5 Flash Lite, JSON), then a separate strict check within the same project and topic, with a confidence score.",
  },
  {
    k: "Built on",
    v: "Next.js on Cloudflare Workers · Supabase Postgres · Gemini 3.5 Flash Lite · Notion · Resend. Built entirely by voice with Wispr Flow.",
  },
];

// Soft frosted card — mirrors the app's .glass surface.
function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`glass rounded-2xl card-soft p-6 ${className}`}>{children}</div>;
}

export default function WelcomePage() {
  return (
    <main className="min-h-screen text-[#1A1715] overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-6 py-14">
        {/* Header */}
        <header className="text-center mb-14">
          <div className="text-[11px] uppercase tracking-widest text-[#9B9690] mb-5">
            Decision memory for teams · across calls, chats &amp; voice
          </div>
          <h1 className="font-serif text-6xl md:text-7xl font-semibold tracking-tight">
            Told You So
          </h1>
          <p className="font-serif italic text-xl md:text-2xl text-[#C0392B] mt-3">
            the meeting agent that argues back.
          </p>
        </header>

        {/* Hero line */}
        <section className="text-center max-w-3xl mx-auto mb-14">
          <p className="font-serif text-2xl md:text-3xl leading-snug text-[#2B2825]">
            Decision logs failed because writing them is a chore.{" "}
            <span className="text-[#C0392B]">Told You So writes itself</span> from your voice and
            chats, then objects when you drift.
          </p>
          <div className="mt-9 flex flex-wrap gap-3 justify-center">
            <a
              href="/login"
              className="bg-[#1C1C1E] text-white rounded-xl px-7 py-3 text-sm font-medium hover:bg-[#333338] transition-colors"
            >
              Try the live demo →
            </a>
            <a
              href="/eval"
              className="bg-white text-[#1A1715] border border-[#E0DED8] rounded-xl px-7 py-3 text-sm font-medium hover:bg-[#F1F0EC] transition-colors"
            >
              See the eval numbers
            </a>
          </div>
        </section>

        {/* The "we said Postgres, someone wants Mongo" demo moment */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          <Panel className="md:col-span-2 !border-[#F3C9C2]">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="inline-flex items-center rounded-md bg-[#FBE9E7] text-[#C0392B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                Objection
              </span>
              <span className="text-xs text-[#9B9690]">conflict with an earlier decision</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
              <div className="border-l-2 border-[#E0DED8] pl-4">
                <div className="uppercase text-[10px] text-[#9B9690] font-semibold tracking-wider mb-1">
                  Then — Oct 24
                </div>
                <blockquote className="italic text-[#6B6560] leading-relaxed">
                  “We’re going with Postgres for the ledger, not Mongo. Money movement needs ACID.”
                </blockquote>
              </div>
              <div className="border-l-2 border-[#C0392B] pl-4">
                <div className="uppercase text-[10px] text-[#C0392B] font-semibold tracking-wider mb-1">
                  Now
                </div>
                <blockquote className="italic text-[#1A1715] leading-relaxed">
                  “Why are we on Postgres? Mongo is faster, let’s switch.”
                </blockquote>
              </div>
            </div>
            <p className="text-xs text-[#9B9690] mt-5">
              The receipt, not a gotcha. You keep the old decision in one click.
            </p>
          </Panel>
          <Panel className="flex flex-col justify-center">
            <div className="font-serif text-5xl font-semibold">30s</div>
            <p className="text-sm text-[#6B6560] mt-3 leading-relaxed">
              Voice → decisions → objection. Talk for 30 seconds after a call; it does the rest.
            </p>
          </Panel>
        </section>

        {/* Four differentiators */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {DIFFERENTIATORS.map((d) => (
            <Panel key={d.k}>
              <h3 className="font-serif text-xl text-[#1A1715] mb-2">{d.k}</h3>
              <p className="text-sm text-[#6B6560] leading-relaxed">{d.v}</p>
            </Panel>
          ))}
        </section>

        {/* Context: who it's for / how it works / stack */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {CONTEXT.map((c) => (
            <Panel key={c.k}>
              <div className="text-[10px] uppercase tracking-widest text-[#C0392B] font-semibold mb-2">
                {c.k}
              </div>
              <p className="text-sm text-[#6B6560] leading-relaxed">{c.v}</p>
            </Panel>
          ))}
        </section>

        <footer className="text-center border-t border-[#ECECEA] pt-7 text-xs text-[#9B9690]">
          <p>
            Product Space × Wispr Flow — Agentic AI Hackathon, 2026 ·{" "}
            <a href="/login" className="underline hover:text-[#1A1715]">
              Open the app →
            </a>
          </p>
          <p className="mt-2 italic font-serif text-sm text-[#6B6560]">
            Just talk. It cleans up the mess, remembers what you decided, and tells you so.
          </p>
        </footer>
      </div>
    </main>
  );
}
