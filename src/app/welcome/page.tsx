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

export default function WelcomePage() {
  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1C1917] overflow-x-hidden">
      <style>{`
        @keyframes tysFadeUp { from { opacity:0; transform:translateY(20px);} to { opacity:1; transform:translateY(0);} }
        @keyframes tysStamp { 0%{opacity:0; transform:scale(1.7) rotate(-10deg);} 55%{opacity:1; transform:scale(.92) rotate(-2deg);} 100%{transform:scale(1) rotate(-1deg);} }
        @keyframes tysLineGrow { from { transform:scaleX(0);} to { transform:scaleX(1);} }
        .tys-fade { animation: tysFadeUp .7s ease-out both; }
        .tys-stamp { animation: tysStamp .75s cubic-bezier(.2,.8,.2,1) both; }
        .tys-line { transform-origin:left; animation: tysLineGrow .8s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .tys-fade,.tys-stamp,.tys-line { animation: none; } }
      `}</style>
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="text-center border-b border-[#DDD3C1] pb-6 mb-10 tys-fade">
          <div className="flex justify-center font-mono text-[10px] uppercase tracking-widest text-[#78716C] mb-4">
            <span>Decision memory for teams · across calls, chats &amp; voice</span>
          </div>
          <h1 className="font-serif text-6xl md:text-7xl font-black tracking-tight">Told You So</h1>
          <p className="font-serif italic text-xl text-[#C0392B] mt-2">
            the meeting agent that argues back.
          </p>
        </header>

        {/* Hero line */}
        <section className="text-center max-w-3xl mx-auto mb-12">
          <p className="font-serif text-2xl md:text-3xl leading-snug">
            Decision logs failed because writing them is a chore.{" "}
            <span className="text-[#C0392B]">Told You So writes itself</span> from your voice and
            chats, then objects when you drift.
          </p>
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <a
              href="/login"
              className="bg-[#C0392B] text-[#F4EFE6] font-mono text-sm uppercase tracking-wider px-8 py-3 hover:bg-[#962D22] transition-colors"
            >
              Try the live demo →
            </a>
            <a
              href="/eval"
              className="border border-[#1C1917] font-mono text-sm uppercase tracking-wider px-8 py-3 hover:bg-[#1C1917] hover:text-[#F4EFE6] transition-colors"
            >
              See the eval numbers
            </a>
          </div>
        </section>

        {/* Bento: the "we said blue, we shipped green" demo moment */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2 border-2 border-[#C0392B] bg-[#FADBD8]/40 p-6">
            <div className="font-serif text-4xl font-black text-[#C0392B] -rotate-1 mb-3">OBJECTION!</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div className="border-l-2 border-[#78716C] pl-3">
                <div className="uppercase text-[10px] text-[#78716C] font-bold mb-1">Then — Oct 24</div>
                <blockquote className="italic text-[#44403C]">
                  “We’re going with Postgres for the ledger, not Mongo. Money movement needs ACID.”
                </blockquote>
              </div>
              <div className="border-l-2 border-[#C0392B] pl-3">
                <div className="uppercase text-[10px] text-[#C0392B] font-bold mb-1">Now</div>
                <blockquote className="italic">
                  “Why are we on Postgres? Mongo is faster, let’s switch.”
                </blockquote>
              </div>
            </div>
            <p className="font-mono text-[11px] text-[#78716C] mt-4">
              The receipt, not a gotcha. You keep the old decision in one click.
            </p>
          </div>
          <div className="border border-[#DDD3C1] bg-[#FAF7F2] p-6 flex flex-col justify-center">
            <div className="font-serif text-5xl font-black">30s</div>
            <p className="font-mono text-xs text-[#78716C] mt-2 uppercase tracking-wide">
              Voice → decisions → objection. Talk for 30 seconds after a call; it does the rest.
            </p>
          </div>
        </section>

        {/* Bento: four differentiators */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {DIFFERENTIATORS.map((d) => (
            <div key={d.k} className="border border-[#DDD3C1] bg-[#FAF7F2] p-6">
              <h3 className="font-serif text-xl font-bold mb-2">{d.k}</h3>
              <p className="font-mono text-xs text-[#44403C] leading-relaxed">{d.v}</p>
            </div>
          ))}
        </section>

        {/* Bento: who it's for + stack */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="border border-[#DDD3C1] bg-[#FAF7F2] p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#C0392B] mb-2">Who it’s for</div>
            <p className="font-mono text-xs text-[#44403C] leading-relaxed">
              Agencies and IT-services firms where a client re-opening a settled decision costs billable
              hours. And engineering teams whose settled architecture keeps getting re-argued.
            </p>
          </div>
          <div className="border border-[#DDD3C1] bg-[#FAF7F2] p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#C0392B] mb-2">How it works</div>
            <p className="font-mono text-xs text-[#44403C] leading-relaxed">
              Two steps, not one big prompt: extract decisions (Gemini 3.5 Flash Lite, JSON), then a
              separate strict check within the same project and topic, with a confidence score.
            </p>
          </div>
          <div className="border border-[#DDD3C1] bg-[#FAF7F2] p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#C0392B] mb-2">Built on</div>
            <p className="font-mono text-xs text-[#44403C] leading-relaxed">
              Next.js on Cloudflare Workers · Supabase Postgres · Gemini 3.5 Flash Lite · Notion ·
              Resend. Built entirely by voice with Wispr Flow.
            </p>
          </div>
        </section>

        <footer className="text-center border-t border-[#DDD3C1] pt-6 font-mono text-[11px] text-[#78716C]">
          <p>
            Product Space × Wispr Flow — Agentic AI Hackathon, 2026 ·{" "}
            <a href="/login" className="underline hover:text-[#C0392B]">
              Enter the courtroom →
            </a>
          </p>
          <p className="mt-2 italic font-serif">
            Just talk. It cleans up the mess, remembers what you decided, and tells you so.
          </p>
        </footer>
      </div>
    </main>
  );
}
