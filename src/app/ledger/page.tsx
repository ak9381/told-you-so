"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
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
    <AppShell>
      <PageTitle
        aside={
          msg ? <span className="text-sm text-[#6B6560]">{msg}</span> : undefined
        }
      >
        The Ledger
      </PageTitle>

      <div className="space-y-3 mb-10">
        {actions.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-[#9B9690]">No actions yet — confirm a debrief or meeting.</p>
          </Card>
        )}
        {actions.map((a) => (
          <Card key={a.id} className="p-5 flex flex-wrap items-start justify-between gap-4" hover>
            <div className="flex-1 min-w-[260px]">
              <div className="text-base font-semibold text-[#1A1715]">{a.title}</div>
              <div className="text-sm text-[#6B6560] mt-1.5">
                Owner: <strong className="font-medium text-[#1A1715]">{a.owner || "—"}</strong>
                {a.due_date ? (
                  <> · Due: <strong className="font-medium text-[#1A1715]">{new Date(a.due_date).toLocaleString()}</strong></>
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
                  <Chip tone="green">filed in Notion</Chip>
                ) : (
                  <Chip tone="neutral">not in Notion</Chip>
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
              <button
                onClick={() => remindNow(a.id)}
                className="rounded-lg border border-[#E0DED8] bg-white px-3 py-1.5 text-xs font-medium text-[#6B6560] hover:bg-[#F1F0EC] hover:text-[#1A1715] transition-colors"
              >
                Remind now
              </button>
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
              <span className="text-[#9B9690]">{new Date(n.created_at).toLocaleTimeString()}</span>
              {n.error && <span className="text-[#C0392B]">— {n.error}</span>}
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
