"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { fetchProjectsClient, invalidateProjectsCache } from "@/lib/client-cache";
import { log } from "@/lib/log";

interface Project {
  id: string;
  name: string;
}

// Tools nav — lives in the sticky top header (per the design image).
// "Home" is the live workspace (the live listener folded into the home page).
const TOOLS = [
  { href: "/", label: "Home" },
  { href: "/ledger", label: "Tasks" },
  { href: "/outbox", label: "Reminders" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [email, setEmail] = useState("");
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createMsg, setCreateMsg] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    Promise.all([
      fetchProjectsClient()
        .then((d) => setProjects(d.projects ?? []))
        .catch((e) => log.error("projects request failed", e)),
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => setEmail(d.email ?? ""))
        .catch((e) => log.error("me request failed", e)),
    ]);
    // Selected project is global: URL ?project= wins (deep links), else the
    // last choice from localStorage. Keep them in sync.
    try {
      const url = new URLSearchParams(window.location.search).get("project");
      const ls = localStorage.getItem("tys_project");
      const chosen = url || ls;
      setActiveProject(chosen);
      if (url && url !== ls) localStorage.setItem("tys_project", url);
    } catch {
      // storage/URL/scroll unavailable (e.g. private mode) — safe to use defaults
    }
  }, [pathname]);

  const handle = (email.split("@")[0] || "you").replace(/\+.*$/, "");
  const initials = handle.slice(0, 2).toUpperCase();
  const currentId = activeProject || projects[0]?.id || null;
  const currentProjectName =
    projects.find((p) => p.id === currentId)?.name || "Select project";

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      log.error("logout request failed", e);
    }
    window.location.href = "/welcome";
  }

  // Stay on the current tab, but re-scope it to the chosen project. Persist the
  // choice so every tab (Tasks, Reminders, Home) shows the same project.
  function switchProject(id: string) {
    try {
      localStorage.setItem("tys_project", id);
    } catch {
      // storage/URL/scroll unavailable (e.g. private mode) — safe to use defaults
    }
    const base = pathname || "/";
    window.location.href = `${base}?project=${id}`;
  }

  async function createProject() {
    const name = newName.trim();
    if (!name) return;
    setCreateMsg("");
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (!r.ok || !d.project) {
        setCreateMsg(d.error || "Could not create the project");
        return;
      }
      invalidateProjectsCache();
      try {
        localStorage.setItem("tys_project", d.project.id);
      } catch {
        // storage/URL/scroll unavailable (e.g. private mode) — safe to use defaults
      }
      window.location.href = `/?project=${d.project.id}`;
    } catch {
      setCreateMsg("Could not create the project");
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <aside className="w-full md:w-60 shrink-0 glass-shell border-b md:border-b-0 md:border-r border-white/60 flex flex-col md:sticky md:top-0 md:h-screen">
        <Link href="/" className="px-6 pt-7 pb-5 block" aria-label="Told You So home">
          <div className="font-serif text-2xl font-black leading-[1.05] tracking-tight text-[#1A1715]">
            TOLD
            <br />
            YOU SO
          </div>
        </Link>

        {/* Project switcher */}
        <div className="px-4 pt-3 pb-3 border-t border-[#EFEEEA]">
          <div className="text-xs uppercase tracking-wider text-[#9B9690] mb-2">Project</div>
          <div className="relative">
            <button
              onClick={() => {
                setOpen((o) => !o);
                setCreating(false);
                setCreateMsg("");
              }}
              className="w-full flex items-center justify-between gap-2 rounded-lg border border-[#E7E5E0] bg-white/70 px-3 py-2 text-sm text-[#1A1715] hover:border-[#C9C6BE] transition-colors"
            >
              <span className="truncate flex items-center gap-2">
                <span className="text-[#9B9690]">▪</span>
                {currentProjectName}
              </span>
              <span className="text-[#9B9690] text-xs">▾</span>
            </button>

            {open && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                <div className="absolute z-40 mt-1 w-full rounded-xl border border-[#E7E5E0] bg-white shadow-lg overflow-hidden">
                  <div className="max-h-60 overflow-y-auto py-1">
                    {projects.length === 0 && (
                      <div className="px-3 py-2 text-xs text-[#9B9690]">No projects yet — create one below.</div>
                    )}
                    {projects.map((p) => {
                      const active = currentId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => switchProject(p.id)}
                          className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                            active
                              ? "bg-[#F1F0EC] text-[#1A1715] font-medium"
                              : "text-[#6B6560] hover:bg-[#F7F6F3]"
                          }`}
                        >
                          <span className="text-[#9B9690]">▪</span>
                          <span className="truncate">{p.name}</span>
                          {active && <span className="ml-auto text-[#1C7A4A] text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="border-t border-[#EFEEEA] p-2">
                    {!creating ? (
                      <button
                        onClick={() => setCreating(true)}
                        className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-[#1A1715] hover:bg-[#F7F6F3] transition-colors"
                      >
                        + Create project
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") createProject();
                          }}
                          placeholder="Project name"
                          aria-label="New project name"
                          className="flex-1 min-w-0 rounded-lg border border-[#E7E5E0] px-2.5 py-1.5 text-sm text-[#1A1715] focus:outline-none focus:border-[#B9B6AE]"
                        />
                        <button
                          onClick={createProject}
                          disabled={!newName.trim()}
                          className="shrink-0 rounded-lg bg-[#1C1C1E] text-white px-3 py-1.5 text-xs font-medium hover:bg-[#333338] disabled:opacity-50 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    )}
                    {createMsg && <p className="text-xs text-[#C0392B] mt-1.5 px-1">{createMsg}</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-[#EFEEEA]">
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
        {/* Sticky dark header with the tools nav */}
        <header className="sticky top-0 z-30 bg-[#1C1C1E] border-b border-black/30">
          <nav className="max-w-6xl px-6 md:px-10 py-3 flex items-center justify-end gap-1">
            {TOOLS.map((t) => {
              const active = t.href === "/" ? pathname === "/" : pathname === t.href;
              const href = currentId ? `${t.href}?project=${currentId}` : t.href;
              return (
                <a
                  key={t.href}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
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
