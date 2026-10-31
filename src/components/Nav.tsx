const LINKS = [
  { href: "/", label: "Debrief" },
  { href: "/live", label: "Live" },
  { href: "/ledger", label: "Ledger" },
  { href: "/outbox", label: "Outbox" },
  { href: "/eval", label: "Eval" },
];

export default function Nav() {
  return (
    <nav className="flex flex-wrap gap-5 justify-center mb-8 font-mono text-xs uppercase tracking-wider border-b border-[#DDD3C1] pb-3">
      {LINKS.map((l) => (
        <a key={l.href} href={l.href} className="text-[#78716C] hover:text-[#C0392B] transition-colors">
          {l.label}
        </a>
      ))}
    </nav>
  );
}
