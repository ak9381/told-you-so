"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
}

// Tools nav — now lives in the sticky top header (per the design image).
// "Live" is the home workspace (the live listener folded into the home page).
const TOOLS = [
  { href: "/", label: "Home" },
  { href: "/ledger", label: "Tasks" },
  { href: "/outbox", label: "Reminders" },
  { href: "/eval", label: "Accuracy" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [email, setEmail] = useState("");
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
    // Read the user from the server (do NOT call auth.getUser() client-side —
    // it would trigger a token refresh that conflicts with the middleware's).
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setEmail(d.email ?? ""))
      .catch(() => {});
    try {
      setActiveProject(new URLSearchParams(window.location.search).get("project"));
    } catch {}
  }, [pathname]);

  const handle = (email.split("@")[0] || "you").replace(/\+.*$/, "");
  const initials = handle.slice(0, 2).toUpperCase();

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/welcome";
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 glass-shell border-r border-white/60 flex flex-col sticky top-0 h-screen">
        <a href="/" className="px-6 pt-7 pb-5 block">
          <div className="font-serif text-2xl font-black leading-[1.05] tracking-tight text-[#1A1715]">
            TOLD
            <br />
            YOU SO
          </div>
        </a>

        <div className="px-6 pt-2 pb-2 text-xs uppercase tracking-wider text-[#9B9690] border-t border-[#EFEEEA]">
          Projects
        </div>
        <div className="px-3 space-y-0.5 overflow-y-auto flex-1">
          {projects.map((p) => {
            const active = activeProject === p.id;
            return (
              <button
                key={p.id}
                onClick={() => router.push(`/?project=${p.id}`)}
                className={`w-full text-left flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-[#F1F0EC] text-[#1A1715] font-medium"
                    : "text-[#6B6560] hover:bg-[#F7F6F3]"
                }`}
              >
                <span className="text-[#9B9690]">▪</span>
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-[#EFEEEA]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#ECEAE5] flex items-center justify-center text-xs font-semibold text-[#6B6560]">
              {initials}
            </div>
            <span className="text-sm text-[#1A1715] flex-1 truncate capitalize">{handle}</span>
            <a href="/welcome" className="text-[#9B9690] hover:text-[#1A1715] text-sm" title="About">
              ⓘ
            </a>
          </div>
          <button
            onClick={logout}
            className="w-full text-left rounded-lg px-3 py-2 text-sm text-[#6B6560] hover:bg-[#F7F6F3] hover:text-[#C0392B] transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Sticky glass header with the tools nav */}
        <header className="sticky top-0 z-30 glass-shell border-b border-white/60">
          <nav className="max-w-6xl px-6 md:px-10 py-3 flex items-center justify-end gap-1">
            {TOOLS.map((t) => {
              const active = t.href === "/" ? pathname === "/" : pathname === t.href;
              return (
                <a
                  key={t.href}
                  href={t.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#F1F0EC] text-[#1A1715]"
                      : "text-[#6B6560] hover:text-[#1A1715] hover:bg-[#F7F6F3]"
                  }`}
                >
                  {t.label}
                </a>
              );
            })}
          </nav>
        </header>

        <div className="px-6 md:px-10 py-8 max-w-6xl w-full">{children}</div>
      </main>
    </div>
  );
}
