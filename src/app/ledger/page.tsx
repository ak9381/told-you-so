"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { log } from "@/lib/log";
import { fetchProjectsClient } from "@/lib/client-cache";
import { formatIst, duePhraseFrom } from "@/lib/dates";
import {
  Card,
  PageTitle,
  SectionTitle,
  Chip,
} from "@/components/ui";

interface ActionRow {
  id: string;
  title: string;
  owner: string | null;
  due_date: string | null;
  status: string;
  source_quote: string | null;
  reminder_lead_min: number | null;
  notion_page_id: string | null;
  meeting: { title: string } | { title: string }[] | null;
}
interface NotionLogRow {
  id: string;
  status: string;
  error: string | null;
  notion_page_id: string | null;
  created_at: string;
}

const STATUS = ["open", "done", "blocked"] as const;

function meetingTitle(m: ActionRow["meeting"]): string {
  if (!m) return "";
  if (Array.isArray(m)) return m[0]?.title ?? "";
  return m.title ?? "";
}

const notionPageUrl = (pageId: string | null) =>
  pageId ? `https://www.notion.so/${pageId.replace(/-/g, "")}` : null;

const FILTERS = ["all", "open", "done", "blocked"] as const;
type Filter = (typeof FILTERS)[number];

function currentProjectId(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("project") || localStorage.getItem("tys_project");
  } catch {
    return null;
  }
}

/** The selected project, or the first one when nothing is chosen yet (fresh login). */
async function ensureProjectId(): Promise<string | null> {
  const pid = currentProjectId();
  if (pid) return pid;
  try {
    const first = (await fetchProjectsClient()).projects?.[0]?.id ?? null;
    if (first) localStorage.setItem("tys_project", first);
    return first;
  } catch {
    return null;
  }
}

export default function LedgerPage() {
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [reminderTo, setReminderTo] = useState("");
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setReminderTo(d.reminderTo ?? ""))
      .catch(() => {});
  }, []);
  const [notionLog, setNotionLog] = useState<NotionLogRow[]>([]);
  const [notionDbUrl, setNotionDbUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [people, setPeople] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    // Fresh sessions have no saved project: fall back to the first one so the
    // team list loads and "Add member" has a project to add to.
    const pid = await ensureProjectId();
    const url = pid ? `/api/ledger?projectId=${pid}` : "/api/ledger";
    const ledgerPromise = fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setActions(d.actions ?? []);
        setNotionLog(d.notionLog ?? []);
        setNotionDbUrl(d.notionDbUrl ?? null);
      })
      .catch((e) => {
        log.error("ledger request failed", e);
        setMsg("Couldn't load tasks. Refresh to try again.");
      });

    const peoplePromise = pid
      ? fetch(`/api/people?projectId=${encodeURIComponent(pid)}`)
          .then((r) => r.json())
          .then((d) => setPeople(d.people ?? []))
          .catch((e) => {
            log.error("team load failed", e);
            setMsg("Couldn't load team members. Refresh to try again.");
          })
      : Promise.resolve(null);

    Promise.all([ledgerPromise, peoplePromise]).finally(() => {
      if (!silent) setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addMember() {
    const name = newMemberName.trim();
    if (!name) return;
    const projectId = await ensureProjectId();
    if (!projectId) {
      setMsg("Create or pick a project first (top left), then add people.");
      return;
    }
    let d: { person?: { id: string; name: string; email: string | null }; error?: string } = {};
    try {
      const r = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: newMemberEmail.trim(), projectId }),
      });
      d = await r.json().catch(() => ({ error: `Could not add member (HTTP ${r.status})` }));
      if (
        r.status === 409 &&
        newMemberEmail.trim() &&
        String(d.error || "").endsWith("is already on the team.") &&
        window.confirm(`${d.error} Update their email to ${newMemberEmail.trim()}?`)
      ) {
        const r2 = await fetch("/api/people", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email: newMemberEmail.trim(), projectId, update: true }),
        });
        d = await r2.json().catch(() => ({ error: `Could not update member (HTTP ${r2.status})` }));
      }
    } catch {
      d = { error: "Could not reach the server. Try again." };
    }
    const person = d.person;
    if (person) {
      setPeople((prev) =>
        prev.some((p) => p.id === person.id)
          ? prev.map((p) => (p.id === person.id ? person : p))
          : [...prev, person]
      );
      setNewMemberName("");
      setNewMemberEmail("");
      setMsg(`Added ${person.name} to the team`);
    } else {
      setMsg(d.error || "Could not add member");
    }
  }

  async function reassignOwner(id: string, owner: string, ownerId: string | null) {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, owner } : a)));
    await fetch("/api/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: id, owner, ownerId }),
    });
    setMsg(`Reassigned to ${owner}`);
  }

  // B7: two-step remove (inline "Remove? Yes / Cancel"); restore on failure.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  async function deleteTask(id: string) {
    setConfirmDelete(null);
    const before = actions;
    setActions((prev) => prev.filter((a) => a.id !== id));
    try {
      const r = await fetch(`/api/ledger?actionId=${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setMsg("Task removed");
    } catch (e) {
      log.error("delete task failed", e);
      setActions(before);
      setMsg("Couldn't remove the task. Please try again.");
    }
  }

  // Optimistic: update the row in place so the card never jumps on click.
  async function setStatus(id: string, status: string) {
    setMsg("");
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    const r = await fetch("/api/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: id, status }),
    });
    const d = await r.json().catch(() => ({}));
    if (d.notionSynced) setMsg("Status updated — synced to Notion ✓");
    else if (d.notionError) setMsg(`Status updated (Notion sync failed: ${d.notionError})`);
    else setMsg("Status updated");
  }

  async function fileToNotion(id: string) {
    setMsg("Filing to Notion…");
    const r = await fetch("/api/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: id, fileNotion: true }),
    });
    const d = await r.json().catch(() => ({}));
    if (d.ok) {
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, notion_page_id: d.notion_page_id } : a))
      );
      setMsg("Filed in Notion ✓");
      load(true);
    } else {
      setMsg(`Notion filing failed: ${d.error || "unknown"}`);
    }
  }

  async function remindNow(id: string) {
    if (!window.confirm(`Send reminder to ${reminderTo || "the demo inbox"}?`)) return;
    setMsg("Sending reminder…");
    const r = await fetch("/api/send-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "reminder", actionId: id }),
    });
    const d = await r.json();
    setMsg(
      d.sent
        ? `Reminder sent to ${d.to || "the demo inbox"}. Check Reminders.`
        : `No email sent — ${d.errors?.join(", ") || "see Reminders"}.`
    );
  }

  const filed = notionLog.filter((n) => n.status === "filed").length;
  const failed = notionLog.filter((n) => n.status === "failed").length;
  const count = (f: Filter) => (f === "all" ? actions.length : actions.filter((a) => a.status === f).length);
  // Soonest due first; tasks without a due date go last.
  const dueMs = (a: ActionRow) => (a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY);
  const visible = (filter === "all" ? actions : actions.filter((a) => a.status === filter))
    .slice()
    .sort((x, y) => dueMs(x) - dueMs(y));
  const isOverdue = (a: ActionRow) => a.status !== "done" && !!a.due_date && new Date(a.due_date).getTime() < Date.now();
  const ownerOf = (a: ActionRow) => (a.owner && a.owner.toLowerCase() !== "unassigned" ? a.owner : "");

  return (
    <AppShell>
      <PageTitle
        aside={
          <div className="flex items-center gap-3">
            {msg && <span className="text-sm text-[#6B6560]">{msg}</span>}
            {notionDbUrl && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#1C7A4A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1C7A4A]" /> Notion connected
              </span>
            )}
            {notionDbUrl && (
              <a
                href={notionDbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E0DED8] bg-white px-4 py-2 text-sm font-medium text-[#1A1715] hover:bg-[#F1F0EC] transition-colors"
              >
                ↗ Open in Notion
              </a>
            )}
          </div>
        }
      >
        Tasks
      </PageTitle>

      <p className="text-[#6B6560] -mt-4 mb-4 max-w-2xl">
        Every action item we extracted from your meetings — each one is{" "}
        <strong className="font-medium text-[#1A1715]">filed into your Notion database</strong> and
        gets a reminder email before it&rsquo;s due. Status changes here sync to Notion. Mark them
        open / done / blocked below.
      </p>
      <div className="mb-6 inline-flex items-center gap-2 rounded-lg bg-[#FFF8E6] border border-[#F0E3B8] px-3.5 py-2 text-sm text-[#7A6A2F]">
        <span>✉️</span>
        <span>
          Demo note: reminder emails go to one verified demo inbox
          {reminderTo ? <> (<strong className="font-medium">{reminderTo}</strong>)</> : null}, with the
          owner&rsquo;s name in the subject. With a verified sending domain they would go to each owner directly.
        </span>
      </div>

      {/* Team */}
      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg text-[#1A1715]">Team</h3>
            <p className="text-xs text-[#9B9690] mt-0.5">
              Add people, then assign tasks to them below. Reminders go to each person&rsquo;s email.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Name"
              className="w-32 rounded-lg border border-[#E7E5E0] px-3 py-2 text-sm focus:outline-none focus:border-[#B9B6AE]"
            />
            <input
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addMember();
              }}
              placeholder="Email (optional)"
              className="w-48 rounded-lg border border-[#E7E5E0] px-3 py-2 text-sm focus:outline-none focus:border-[#B9B6AE]"
            />
            <button
              onClick={addMember}
              disabled={!newMemberName.trim()}
              className="rounded-lg bg-[#1C1C1E] text-white px-4 py-2 text-sm font-medium hover:bg-[#333338] disabled:opacity-50 transition-colors"
            >
              Add member
            </button>
          </div>
        </div>
        {loading && people.length === 0 && (
          <div className="flex flex-wrap gap-2 mt-4 animate-pulse">
            <div className="h-6 w-24 bg-[#E7E5E0] rounded-full" />
            <div className="h-6 w-28 bg-[#E7E5E0] rounded-full" />
            <div className="h-6 w-20 bg-[#E7E5E0] rounded-full" />
          </div>
        )}
        {people.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {people.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F0EC] px-3 py-1 text-xs text-[#6B6560]"
              >
                <span className="w-4 h-4 rounded-full bg-[#ECEAE5] flex items-center justify-center text-[9px] font-semibold text-[#6B6560]">
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                {p.name}
                {p.email ? <span className="text-[#9B9690]">· {p.email}</span> : null}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Status filter */}
      <div className="flex items-center gap-1.5 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === f
                ? "bg-[#1C1C1E] text-white"
                : "bg-white border border-[#E0DED8] text-[#6B6560] hover:border-[#1A1715] hover:text-[#1A1715]"
            }`}
          >
            {f} <span className={filter === f ? "text-white/60" : "text-[#9B9690]"}>{count(f)}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3 mb-10">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="p-5 flex flex-wrap items-start justify-between gap-4 animate-pulse">
                <div className="flex-1 min-w-[260px] space-y-2.5">
                  <div className="h-5 bg-[#E7E5E0] rounded w-3/4" />
                  <div className="h-4 bg-[#EFEFEA] rounded w-1/2" />
                  <div className="h-3 bg-[#EFEFEA] rounded w-2/3" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-20 bg-[#E7E5E0] rounded-lg" />
                  <div className="h-8 w-24 bg-[#E7E5E0] rounded-lg" />
                </div>
              </Card>
            ))}
          </div>
        )}
        {!loading && actions.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-[#9B9690]">No actions yet — confirm a debrief or meeting.</p>
          </Card>
        )}
        {!loading && actions.length > 0 && visible.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-[#9B9690]">No {filter} tasks.</p>
          </Card>
        )}
        {!loading &&
          visible.map((a) => (
          <Card key={a.id} className="p-5 flex flex-wrap items-start justify-between gap-4" hover>
            <div className="flex-1 min-w-[260px]">
              <div className="text-base font-semibold text-[#1A1715]">{a.title}</div>
              <div className="text-sm text-[#6B6560] mt-1.5">
                Owner:{" "}
                <select
                  value={ownerOf(a)}
                  onChange={(e) => {
                    const name = e.target.value;
                    const p = people.find((x) => x.name === name);
                    reassignOwner(a.id, name, p?.id ?? null);
                  }}
                  className="rounded-md border border-[#E0DED8] bg-white px-1.5 py-0.5 text-sm font-medium text-[#1A1715] focus:outline-none focus:border-[#9B9690]"
                >
                  <option value="" disabled>
                    Unassigned
                  </option>
                  {ownerOf(a) && !people.some((p) => p.name === ownerOf(a)) && (
                    <option value={ownerOf(a)}>{ownerOf(a)}</option>
                  )}
                  {people.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {a.due_date ? (
                  <>
                    {" · "}Due: <strong className="font-medium text-[#1A1715]">{formatIst(a.due_date)}</strong>
                    {duePhraseFrom(a.source_quote) && (
                      <span className="text-[#9B9690]"> (from &lsquo;{duePhraseFrom(a.source_quote)}&rsquo;)</span>
                    )}
                    {isOverdue(a) && (
                      <span className="ml-2 rounded-md bg-[#FBE9E7] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#C0392B]">
                        Overdue
                      </span>
                    )}
                  </>
                ) : (
                  " · No due date"
                )}
                {" · "}reminds {a.reminder_lead_min ?? 1440} min before
              </div>
              {a.source_quote && (
                <div className="text-[13px] text-[#9B9690] italic mt-2">&ldquo;{a.source_quote}&rdquo;</div>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {meetingTitle(a.meeting) && (
                  <span className="text-xs text-[#9B9690]">from {meetingTitle(a.meeting)}</span>
                )}
                {a.notion_page_id ? (
                  <a
                    href={notionPageUrl(a.notion_page_id) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-[#E6F3EC] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1C7A4A] hover:bg-[#d6ecdf] transition-colors"
                  >
                    ↗ open in Notion
                  </a>
                ) : (
                  <button
                    onClick={() => fileToNotion(a.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-[#E0DED8] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6B6560] hover:border-[#1A1715] hover:text-[#1A1715] transition-colors"
                  >
                    ↗ Send to Notion
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-1.5">
                {STATUS.map((s) => {
                  const selected = a.status === s;
                  const base = "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors";
                  const cls = selected
                    ? s === "done"
                      ? "bg-[#1C7A4A] text-white border-[#1C7A4A]"
                      : s === "blocked"
                      ? "bg-[#C0392B] text-white border-[#C0392B]"
                      : "bg-[#1C1C1E] text-white border-[#1C1C1E]"
                    : "bg-white text-[#6B6560] border-[#E0DED8] hover:bg-[#F1F0EC] hover:text-[#1A1715]";
                  return (
                    <button key={s} onClick={() => setStatus(a.id, s)} className={`${base} ${cls}`}>
                      {s}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => remindNow(a.id)}
                  className="rounded-lg border border-[#E0DED8] bg-white px-3 py-1.5 text-xs font-medium text-[#6B6560] hover:bg-[#F1F0EC] hover:text-[#1A1715] transition-colors"
                >
                  Remind now
                </button>
                {confirmDelete === a.id ? (
                  <span className="flex items-center gap-1.5" role="group" aria-label="Confirm remove">
                    <span className="text-xs text-[#C0392B]">Remove?</span>
                    <button
                      onClick={() => deleteTask(a.id)}
                      className="rounded-lg border border-[#C0392B] bg-[#C0392B] px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Yes, remove
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      autoFocus
                      className="rounded-lg border border-[#E0DED8] bg-white px-3 py-1.5 text-xs font-medium text-[#6B6560]"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(a.id)}
                    title="Remove this task"
                    className="rounded-lg border border-[#E0DED8] bg-white px-3 py-1.5 text-xs font-medium text-[#9B9690] hover:border-[#C0392B] hover:text-[#C0392B] transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Notion log */}
      <Card className="p-6">
        <div className="flex items-end justify-between mb-5">
          <SectionTitle>Notion Log</SectionTitle>
          <span className="text-sm text-[#9B9690] pb-1">
            {filed} filed · {failed} failed
          </span>
        </div>
        <div className="space-y-2 text-sm max-h-56 overflow-y-auto">
          {notionLog.length === 0 && <p className="text-[#9B9690] italic">No Notion filings yet.</p>}
          {notionLog.map((n) => (
            <div key={n.id} className="flex items-center gap-2.5">
              {n.status === "filed" ? (
                <Chip tone="green">filed</Chip>
              ) : (
                <Chip tone="accent">failed</Chip>
              )}
              <span className="text-[#9B9690]">{formatIst(n.created_at)}</span>
              {n.error && <span className="text-[#C0392B]">— {n.error}</span>}
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
