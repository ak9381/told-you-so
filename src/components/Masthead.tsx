export default function Masthead() {
  return (
    <header className="border-b-2 border-double border-[#1C1917] pb-6 pt-8 mb-8 text-center">
      <div className="flex items-center justify-between border-b border-[#DDD3C1] pb-2 mb-4 text-xs font-mono uppercase tracking-widest text-[#78716C]">
        <span>Courtroom Ledger & Record</span>
        <span>Vol. I · Edition 2026</span>
        <span>Official Proceedings</span>
      </div>
      <h1 className="text-6xl md:text-7xl font-serif font-black tracking-tight text-[#1C1917] mb-2">
        Told You So
      </h1>
      <p className="text-lg md:text-xl font-serif italic text-[#C0392B] font-medium tracking-wide">
        the meeting agent that argues back.
      </p>
      <div className="mt-4 flex items-center justify-center gap-4 text-xs font-mono text-[#44403C]">
        <span>EST. OCT 2026</span>
        <span>•</span>
        <span>UNCOMPROMISING RECALL</span>
        <span>•</span>
        <span>NO MORE LOST DECISIONS</span>
      </div>
    </header>
  );
}

