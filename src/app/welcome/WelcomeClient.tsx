"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

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

/** Scroll-reveal wrapper: fades + lifts its children when it enters the viewport. */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`tys-glass rounded-2xl p-6 ${className}`}>{children}</div>;
}

export default function WelcomeClient() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0A0A0B] text-[#F5F5F4]">
      <style>{STYLES}</style>

      {/* ───────── Sticky glass header ───────── */}
      <header className="sticky top-0 z-50 tys-nav">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/welcome" className="font-serif text-lg font-semibold tracking-tight">
            TOLD YOU SO
          </a>
          <nav className="flex items-center text-sm">
            <a
              href="/login"
              className="rounded-full bg-[#F5F5F4] px-4 py-2 text-[13px] font-medium text-[#0A0A0B] transition-transform hover:scale-[1.03]"
            >
              Open the app →
            </a>
          </nav>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="relative flex min-h-[88vh] items-center overflow-hidden px-6">
        <div className="tys-hero-glow" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl py-24 text-center">
          <p className="tys-fade tys-d1 mb-6 text-[11px] font-medium uppercase tracking-[0.25em] text-[#A8A29E]">
            Decision memory for teams · across calls, chats &amp; voice
          </p>
          <h1 className="tys-fade tys-d2 font-serif text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl md:text-[5.5rem]">
            The meeting agent
            <br />
            that <span className="italic text-[#C0392B]">argues back.</span>
          </h1>
          <p className="tys-fade tys-d3 mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-[#A8A29E] md:text-xl">
            Decision logs failed because writing them is a chore.{" "}
            <span className="text-[#F5F5F4]">Told You So writes itself</span> from your voice and
            chats, then objects when you drift.
          </p>
          <div className="tys-fade tys-d4 mt-10 flex flex-wrap justify-center gap-4">
            <a
              href="/login"
              className="rounded-xl bg-[#F5F5F4] px-7 py-3.5 text-sm font-semibold text-[#0A0A0B] transition-transform hover:scale-[1.03]"
            >
              Try the live demo →
            </a>
            <a
              href="/eval"
              className="rounded-xl border border-white/15 px-7 py-3.5 text-sm font-medium text-[#F5F5F4] transition-colors hover:bg-white/5"
            >
              See the eval numbers
            </a>
          </div>
        </div>
        <div className="tys-fade tys-d5 absolute bottom-10 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.25em] text-[#A8A29E]">
          <span className="tys-scroll">scroll to explore ↓</span>
        </div>
      </section>

      {/* ───────── The objection moment ───────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="mb-10 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#A8A29E]">
            The objection moment
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            It remembers. Then it objects.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Reveal className="md:col-span-2">
            <GlassCard className="h-full border-[#C0392B]/40">
              <div className="mb-5 inline-flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-[#C0392B]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E86a5c]">
                  Objection
                </span>
                <span className="text-xs text-[#A8A29E]">conflict with an earlier decision</span>
              </div>
              <div className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-2">
                <div className="border-l-2 border-white/15 pl-4">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#A8A29E]">
                    Then — Oct 24
                  </div>
                  <blockquote className="italic leading-relaxed text-[#A8A29E]">
                    “We’re going with Postgres for the ledger, not Mongo. Money movement needs
                    ACID.”
                  </blockquote>
                </div>
                <div className="border-l-2 border-[#C0392B] pl-4">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#E86a5c]">
                    Now
                  </div>
                  <blockquote className="italic leading-relaxed text-[#F5F5F4]">
                    “Why are we on Postgres? Mongo is faster, let’s switch.”
                  </blockquote>
                </div>
              </div>
              <p className="mt-6 text-xs text-[#A8A29E]">
                The receipt, not a gotcha. You keep the old decision in one click.
              </p>
            </GlassCard>
          </Reveal>

          <Reveal delay={120}>
            <GlassCard className="flex h-full flex-col justify-center">
              <div className="font-serif text-6xl font-semibold text-[#F5F5F4]">30s</div>
              <p className="mt-4 text-sm leading-relaxed text-[#A8A29E]">
                Voice → decisions → objection. Talk for 30 seconds after a call; it does the rest.
              </p>
            </GlassCard>
          </Reveal>
        </div>
      </section>

      {/* ───────── Differentiators ───────── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Reveal className="mb-10 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#A8A29E]">
            Why it is different
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Not another summary tool.
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {DIFFERENTIATORS.map((d, i) => (
            <Reveal key={d.k} delay={i * 90}>
              <GlassCard className="h-full tys-lift">
                <h3 className="mb-2 font-serif text-xl text-[#F5F5F4]">{d.k}</h3>
                <p className="text-sm leading-relaxed text-[#A8A29E]">{d.v}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── Context ───────── */}
      <section className="mx-auto max-w-6xl px-6 py-16 pb-32">
        <Reveal className="mb-10 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#A8A29E]">
            The context
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Who it is for, and how.
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {CONTEXT.map((c, i) => (
            <Reveal key={c.k} delay={i * 90}>
              <GlassCard className="h-full tys-lift">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#E86a5c]">
                  {c.k}
                </div>
                <p className="text-sm leading-relaxed text-[#A8A29E]">{c.v}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── Sticky glass footer ───────── */}
      <footer className="fixed inset-x-0 bottom-0 z-40 tys-footer">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1 px-6 py-3 text-center text-[11px] text-[#A8A29E] sm:flex-row sm:text-left">
          <span>© 2026 Akash K Raju</span>
          <span>Built for the Product Space × Wispr Flow — Agentic AI Hackathon</span>
        </div>
      </footer>
    </main>
  );
}

const STYLES = `
.tys-nav {
  background: rgba(10, 10, 11, 0.6);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.tys-footer {
  background: rgba(10, 10, 11, 0.65);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.tys-glass {
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.tys-lift {
  transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease;
}
.tys-lift:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.07);
}

/* Hero glow */
.tys-hero-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  width: 120vw;
  height: 90vh;
  transform: translateX(-50%);
  pointer-events: none;
  background:
    radial-gradient(42% 55% at 50% 0%, rgba(16, 185, 129, 0.16) 0%, rgba(16, 185, 129, 0) 70%),
    radial-gradient(45% 50% at 72% 18%, rgba(99, 102, 241, 0.14) 0%, rgba(99, 102, 241, 0) 72%),
    radial-gradient(40% 45% at 26% 22%, rgba(192, 57, 43, 0.10) 0%, rgba(192, 57, 43, 0) 72%);
  animation: tys-glow 14s ease-in-out infinite alternate;
}
@keyframes tys-glow {
  0%   { opacity: 0.75; transform: translateX(-50%) scale(1); }
  100% { opacity: 1;    transform: translateX(-52%) scale(1.08); }
}

/* Entrance fade-up */
.tys-fade {
  opacity: 0;
  transform: translateY(22px);
  animation: tys-fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.tys-d1 { animation-delay: 0.05s; }
.tys-d2 { animation-delay: 0.18s; }
.tys-d3 { animation-delay: 0.34s; }
.tys-d4 { animation-delay: 0.5s; }
.tys-d5 { animation-delay: 0.9s; }
@keyframes tys-fade-up {
  to { opacity: 1; transform: translateY(0); }
}

/* Scroll cue */
.tys-scroll {
  display: inline-block;
  animation: tys-bob 2s ease-in-out infinite;
}
@keyframes tys-bob {
  0%, 100% { transform: translateY(0); opacity: 0.6; }
  50%      { transform: translateY(5px); opacity: 1; }
}

/* Scroll reveal */
.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.75s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.75s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}
.reveal.is-visible {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .tys-fade,
  .tys-scroll,
  .tys-hero-glow,
  .tys-lift {
    animation: none !important;
    transition: none !important;
  }
  .tys-fade { opacity: 1; transform: none; }
  .reveal {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
`;
