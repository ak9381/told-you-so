"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { Card, PageTitle, Chip } from "@/components/ui";
import { log } from "@/lib/log";
import { formatIst } from "@/lib/dates";

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
const STATUS_LABEL: Record<string, string> = {
  SENT: "Sent to demo inbox",
  FAILED: "Not delivered",
  SCHEDULED: "Scheduled",
};
const fmt = (t: string | null) => formatIst(t);

export default function OutboxPage() {
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const load = () => {
      let pid: string | null = null;
      try {
        pid =
          new URLSearchParams(window.location.search).get("project") ||
          localStorage.getItem("tys_project");
      } catch {
        // storage/URL/scroll unavailable (e.g. private mode) — safe to use defaults
      }
      fetch(pid ? `/api/outbox?projectId=${pid}` : "/api/outbox")
        .then((r) => r.json())
        .then((d) => {
          setRows(d.outbox ?? []);
          setLoadError("");
        })
        .catch((e) => {
          log.error("outbox request failed", e);
          setLoadError("Couldn't load reminders. Retrying…");
        })
        .finally(() => setLoading(false));
    };
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
        Reminders
      </PageTitle>
      {loadError && (
        <p role="alert" className="text-sm text-[#B4532A] mb-4">
          {loadError}
        </p>
      )}

      <p className="text-[#6B6560] -mt-4 mb-8 max-w-2xl">
        Every reminder &amp; weekly-digest email we&rsquo;ve scheduled or sent, with delivery status.
        For the demo these all land in one verified demo inbox (the intended person&rsquo;s name is
        in the subject) — a verified sending domain would send to each owner directly. WhatsApp
        reminders aren&rsquo;t supported yet; WhatsApp is an input (chat export) only.
      </p>

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
              {loading &&
                [1, 2, 3, 4].map((n) => (
                  <tr key={n} className="border-t border-[#EFEEEA] animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-[#E7E5E0] rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-[#E7E5E0] rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-[#E7E5E0] rounded w-48" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-[#EFEFEA] rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-[#EFEFEA] rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-[#EFEFEA] rounded w-12" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-[#E7E5E0] rounded-full w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-[#EFEFEA] rounded w-24" /></td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-[#9B9690] italic text-center">
                    No reminders or digests yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#EFEEEA]">
                  <td className="px-4 py-3 text-[#6B6560] uppercase text-xs tracking-wide">{r.type}</td>
                  <td className="px-4 py-3 text-[#1A1715]">
                    {r.person_name && r.person_name.toLowerCase() !== "unassigned" ? r.person_name : "Unassigned"}
                  </td>
                  <td className="px-4 py-3 text-[#1A1715]">{r.subject || "—"}</td>
                  <td className="px-4 py-3 text-[#6B6560]">{fmt(r.scheduled_at)}</td>
                  <td className="px-4 py-3 text-[#6B6560]">{fmt(r.sent_at)}</td>
                  <td className="px-4 py-3 text-[#6B6560]">{r.channel}</td>
                  <td className="px-4 py-3">
                    <Chip tone={statusTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Chip>
                    {r.error ? <div className="mt-1 text-xs text-[#C0392B]">{r.error}</div> : null}
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
