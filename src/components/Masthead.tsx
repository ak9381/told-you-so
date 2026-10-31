export default function Masthead() {
  return (
    <header className="border-b border-[#DDD3C1] pb-6 pt-6 mb-8 text-center">
      <h1 className="text-5xl md:text-6xl font-serif font-black tracking-tight text-[#1C1917] mb-2">
        Told You So
      </h1>
      <p className="text-lg font-serif italic text-[#C0392B] font-medium tracking-wide">
        the meeting agent that argues back.
      </p>
      <div className="mt-3 flex items-center justify-center gap-3 text-[11px] font-mono text-[#78716C] uppercase tracking-wide">
        <span>Remembers what you decided</span>
        <span>•</span>
        <span>Objects when you drift</span>
      </div>
    </header>
  );
}
