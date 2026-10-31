"use client";

import { useState, useEffect, useCallback } from "react";
import Masthead from "@/components/Masthead";
import Nav from "@/components/Nav";

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

export default function LedgerPage() {
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [notionLog, setNotionLog] = useState<NotionLogRow[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    fetch("/api/ledger")
      .then((r) => r.json())
      .then((d) => {
        setActions(d.actions ?? []);
        setNotionLog(d.notionLog ?? []);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: string) {
    await fetch("/api/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: id, status }),
    });
    load();
  }

  async function remindNow(id: string) {
    setMsg("Sending reminder…");
    const r = await fetch("/api/send-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "reminder", actionId: id }),
    });
    const d = await r.json();
    setMsg(d.sent ? `Reminder sent (${d.sent}). Check the Outbox.` : `No email sent — ${d.errors?.join(", ") || "see Outbox"}.`);
    load();
  }

  const filed = notionLog.filter((n) => n.status === "filed").length;
  const failed = notionLog.filter((n) => n.status === "failed").length;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 min-h-screen">
      <Masthead />
      <Nav />

      <div className="flex items-center justify-between mb-5">
        <h2 className="font-serif text-2xl font-bold text-[#1C1917]">The Ledger</h2>
        {msg && <span className="font-mono text-xs text-[#C0392B]">{msg}</span>}
      </div>

      <div className="space-y-3 mb-10">
        {actions.length === 0 && (
          <p className="font-mono text-sm text-[#78716C] italic">No actions yet — confirm a debrief or meeting.</p>
        )}
        {actions.map((a) => (
          <div key={a.id} className="border border-[#DDD3C1] bg-[#FAF7F2] p-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-[260px]">
              <div className="font-mono text-sm font-bold text-[#1C1917]">{a.title}</div>
              <div className="font-mono text-xs text-[#44403C] mt-1">
                Owner: <strong>{a.owner || "—"}</strong>
                {a.due_date ? <> · Due: <strong>{new Date(a.due_date).toLocaleString()}</strong></> : " · No due date"}
                {" · "}reminds {a.reminder_lead_min ?? 1440} min before
              </div>
              {a.source_quote && (
                <div className="font-mono text-[11px] text-[#78716C] italic mt-1">&ldquo;{a.source_quote}&rdquo;</div>
              )}
              <div className="font-mono text-[10px] text-[#78716C] mt-1">
                {meetingTitle(a.meeting) && <>from {meetingTitle(a.meeting)} · </>}
                {a.notion_page_id ? (
                  <span className="text-[#1C7A4A]">✓ filed in Notion</span>
                ) : (
                  <span className="text-[#C0392B]">not in Notion</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-1">
                {STATUS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(a.id, s)}
                    className={`font-mono text-[10px] uppercase px-2 py-1 border ${
                      a.status === s
                        ? s === "done"
                          ? "bg-[#1C7A4A] text-white border-[#1C7A4A]"
                          : s === "blocked"
                          ? "bg-[#C0392B] text-white border-[#C0392B]"
                          : "bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]"
                        : "bg-[#F4EFE6] text-[#44403C] border-[#DDD3C1] hover:border-[#1C1917]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={() => remindNow(a.id)}
                className="font-mono text-[10px] uppercase px-2 py-1 border border-[#C0392B] text-[#C0392B] hover:bg-[#C0392B] hover:text-white"
              >
                Remind now
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Notion log */}
      <section className="border border-[#DDD3C1] bg-[#FAF7F2] p-5">
        <h3 className="font-serif text-lg font-bold text-[#1C1917] border-b border-[#DDD3C1] pb-2 mb-3">
          Notion Log <span className="font-mono text-xs text-[#78716C]">({filed} filed · {failed} failed)</span>
        </h3>
        <div className="space-y-1 font-mono text-xs max-h-56 overflow-y-auto">
          {notionLog.length === 0 && <p className="text-[#78716C] italic">No Notion filings yet.</p>}
          {notionLog.map((n) => (
            <div key={n.id} className="flex items-center gap-2">
              <span className={n.status === "filed" ? "text-[#1C7A4A]" : "text-[#C0392B]"}>
                {n.status === "filed" ? "✓ filed" : "✗ failed"}
              </span>
              <span className="text-[#78716C]">{new Date(n.created_at).toLocaleTimeString()}</span>
              {n.error && <span className="text-[#962D22]">— {n.error}</span>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
