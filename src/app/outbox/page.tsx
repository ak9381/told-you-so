"use client";

import { useState, useEffect } from "react";
import Masthead from "@/components/Masthead";
import Nav from "@/components/Nav";

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

function statusColor(s: string) {
  if (s === "SENT") return "text-[#1C7A4A]";
  if (s === "FAILED") return "text-[#C0392B]";
  return "text-[#78716C]";
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
    <main className="max-w-6xl mx-auto px-6 py-8 min-h-screen">
      <Masthead />
      <Nav />

      <div className="flex items-center justify-between mb-5">
        <h2 className="font-serif text-2xl font-bold text-[#1C1917]">Outbox</h2>
        <span className="font-mono text-[10px] text-[#78716C] uppercase">auto-refreshes every 5s · {tick}</span>
      </div>

      <div className="overflow-x-auto border border-[#DDD3C1] bg-[#FAF7F2]">
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="border-b-2 border-[#1C1917] text-left text-[#78716C] uppercase">
              <th className="p-2">Type</th>
              <th className="p-2">Person</th>
              <th className="p-2">Subject</th>
              <th className="p-2">Scheduled</th>
              <th className="p-2">Sent</th>
              <th className="p-2">Channel</th>
              <th className="p-2">Status</th>
              <th className="p-2">Resend ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-[#78716C] italic text-center">
                  No reminders or digests yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#DDD3C1]">
                <td className="p-2 uppercase">{r.type}</td>
                <td className="p-2">{r.person_name || "—"}</td>
                <td className="p-2">{r.subject || "—"}</td>
                <td className="p-2">{fmt(r.scheduled_at)}</td>
                <td className="p-2">{fmt(r.sent_at)}</td>
                <td className="p-2">{r.channel}</td>
                <td className={`p-2 font-bold ${statusColor(r.status)}`}>
                  {r.status}
                  {r.error ? ` (${r.error})` : ""}
                </td>
                <td className="p-2 text-[#78716C]">{r.resend_id ? r.resend_id.slice(0, 10) + "…" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
