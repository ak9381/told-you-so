"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { Card, PageTitle, Chip } from "@/components/ui";

interface OutboxRow {
  id: string;
  type: string;
  person_name: string | null;
  subject: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  channel: string;
  status: string;
  error: string | null;
  resend_id: string | null;
}

function statusTone(s: string): "neutral" | "accent" | "green" {
  if (s === "SENT") return "green";
  if (s === "FAILED") return "accent";
  return "neutral";
}
const fmt = (t: string | null) => (t ? new Date(t).toLocaleTimeString() : "—");

export default function OutboxPage() {
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch("/api/outbox")
        .then((r) => r.json())
        .then((d) => setRows(d.outbox ?? []))
        .catch(() => {});
    load();
    const t = setInterval(() => {
      load();
      setTick((x) => x + 1);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <AppShell>
      <PageTitle
        aside={
          <span className="text-xs text-[#9B9690]">auto-refreshes every 5s · {tick}</span>
        }
      >
        Outbox
      </PageTitle>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F6F3] text-left text-[#9B9690] text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Scheduled</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Resend ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-[#9B9690] italic text-center">
                    No reminders or digests yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#EFEEEA]">
                  <td className="px-4 py-3 text-[#6B6560] uppercase text-xs tracking-wide">{r.type}</td>
                  <td className="px-4 py-3 text-[#1A1715]">{r.person_name || "—"}</td>
                  <td className="px-4 py-3 text-[#1A1715]">{r.subject || "—"}</td>
                  <td className="px-4 py-3 text-[#6B6560]">{fmt(r.scheduled_at)}</td>
                  <td className="px-4 py-3 text-[#6B6560]">{fmt(r.sent_at)}</td>
                  <td className="px-4 py-3 text-[#6B6560]">{r.channel}</td>
                  <td className="px-4 py-3">
                    <Chip tone={statusTone(r.status)}>{r.status}</Chip>
                    {r.error ? <span className="ml-2 text-xs text-[#C0392B]">{r.error}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-[#9B9690]">{r.resend_id ? r.resend_id.slice(0, 10) + "…" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
