import Masthead from "@/components/Masthead";

export default function Home() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8 min-h-screen">
      <Masthead />

      <section className="border border-[#DDD3C1] bg-[#FAF7F2] p-8 shadow-sm rounded-none my-8">
        <div className="flex items-center justify-between border-b border-[#DDD3C1] pb-3 mb-6">
          <span className="font-mono text-xs uppercase tracking-wider text-[#C0392B] font-semibold">
            [DOCKET 001 · SYSTEM READY]
          </span>
          <span className="font-mono text-xs text-[#78716C]">
            STATUS: INITIALIZED
          </span>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-serif font-bold text-[#1C1917]">
            The Court of Recorded Commitments
          </h2>
          <p className="font-serif text-[#44403C] leading-relaxed">
            In Indian startups, decisions don&apos;t die in meetings. They die in
            WhatsApp. Someone says &ldquo;bro let&apos;s push launch to the
            30th&rdquo; and the 15th is quietly erased.
          </p>
          <blockquote className="border-l-4 border-[#C0392B] pl-4 py-1 my-4 bg-[#F4EFE6] font-mono text-sm text-[#1C1917]">
            &ldquo;We remember what the team decided, and we object with receipts
            the exact second someone contradicts it.&rdquo;
          </blockquote>
        </div>

        <div className="mt-8 pt-6 border-t border-[#DDD3C1] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#C0392B] animate-pulse"></span>
            <span className="font-mono text-xs uppercase text-[#1C1917]">
              Engine Standing By
            </span>
          </div>
          <div className="font-mono text-xs text-[#78716C]">
            FRAUNCES + JETBRAINS MONO · PAPER &amp; INK
          </div>
        </div>
      </section>
    </main>
  );
}
