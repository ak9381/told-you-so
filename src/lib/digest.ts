import { formatEmailDue } from "@/lib/dates";
import { log } from "@/lib/log";
import { createServerClient } from "./supabase";
import { sendEmail } from "./email";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PersonDigest {
  person: string;
  actions: { title: string; due_date: string | null; status: string; source_quote: string | null }[];
  changed: { topic: string; exact_quote: string; status: string }[];
  objections: { old_quote: string; new_quote: string; verdict: string | null }[];
}

export async function buildDigest(
  supabase: SupabaseClient,
  personName: string,
  projectIds?: string[] // scope to these projects (per-project teams)
): Promise<PersonDigest> {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  // undefined = unscoped (cron, per-person project). [] = caller has no projects → match nothing.
  const scope = projectIds ? (projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]) : null;

  let aq = supabase
    .from("actions")
    .select("title, due_date, status, source_quote")
    .eq("owner", personName)
    .order("due_date", { ascending: true });
  if (scope) aq = aq.in("project_id", scope);
  const { data: actions, error: aErr } = await aq;
  if (aErr) log.error("digest actions query failed:", aErr.message);

  let dq = supabase
    .from("decisions")
    .select("topic, exact_quote, status")
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false })
    .limit(10);
  if (scope) dq = dq.in("project_id", scope);
  const { data: changed } = await dq;

  // Two eq() queries instead of an interpolated .or() filter, so a name with
  // commas/parentheses can't break or widen the PostgREST filter.
  const objSel = "old_quote, new_quote, verdict, old_speaker, new_speaker";
  let o1 = supabase.from("objections").select(objSel).eq("old_speaker", personName).limit(10);
  let o2 = supabase.from("objections").select(objSel).eq("new_speaker", personName).limit(10);
  if (scope) {
    o1 = o1.in("project_id", scope);
    o2 = o2.in("project_id", scope);
  }
  const [{ data: ob1 }, { data: ob2 }] = await Promise.all([o1, o2]);
  const objections = [...(ob1 ?? []), ...(ob2 ?? [])].slice(0, 10);

  return {
    person: personName,
    actions: actions ?? [],
    changed: changed ?? [],
    objections: (objections ?? []).map((o) => ({
      old_quote: o.old_quote,
      new_quote: o.new_quote,
      verdict: o.verdict,
    })),
  };
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderDigestHtml(d: PersonDigest): string {
  const items = (arr: string[]) =>
    arr.length ? `<ul>${arr.map((x) => `<li>${x}</li>`).join("")}</ul>` : "<p style='color:#888'>Nothing this week.</p>";
  return `<div style="font-family:system-ui;max-width:600px">
    <h2>Weekly digest — ${esc(d.person)}</h2>
    <h3>Your open tasks</h3>
    ${items(d.actions.filter((a) => a.status === "open").map((a) => `${esc(a.title)}${a.due_date ? ` — due ${esc(formatEmailDue(a.due_date))}` : ""}`))}
    <h3>What changed this week</h3>
    ${items(d.changed.map((c) => `[${esc(c.topic)}] &ldquo;${esc(c.exact_quote)}&rdquo;${c.status !== "active" ? ` (${esc(c.status)})` : ""}`))}
    <h3>Open objections involving you</h3>
    ${items(d.objections.map((o) => `&ldquo;${esc(o.old_quote)}&rdquo; vs &ldquo;${esc(o.new_quote)}&rdquo;${o.verdict ? ` → ${esc(o.verdict)}` : " (unresolved)"}`))}
  </div>`;
}

export async function runDigests(
  opts: { projectIds?: string[] } = {}
): Promise<{ sent: number; errors: string[] }> {
  const supabase = createServerClient();
  let pq = supabase.from("people").select("name, email, project_id");
  if (opts.projectIds) {
    if (opts.projectIds.length === 0) return { sent: 0, errors: [] };
    pq = pq.in("project_id", opts.projectIds);
  }
  const { data: people, error: pErr } = await pq;
  if (pErr) throw new Error(`digest people query failed: ${pErr.message}`);
  let sent = 0;
  const errors: string[] = [];

  for (const p of people ?? []) {
    const digest = await buildDigest(supabase, p.name, p.project_id ? [p.project_id] : undefined);
    const html = renderDigestHtml(digest);
    const { data: ob } = await supabase
      .from("outbox")
      .insert({
        type: "digest",
        person_name: p.name,
        person_email: p.email,
        subject: "Weekly digest",
        scheduled_at: new Date().toISOString(),
        status: "SCHEDULED",
      })
      .select("id")
      .single();

    const send = await sendEmail({ toName: p.name, subject: "Weekly digest", html });
    if (send.ok) {
      await supabase
        .from("outbox")
        .update({ status: "SENT", sent_at: new Date().toISOString(), resend_id: send.id ?? null, error: null })
        .eq("id", ob?.id);
      sent += 1;
    } else {
      await supabase
        .from("outbox")
        .update({ status: "FAILED", error: send.error ?? "send failed" })
        .eq("id", ob?.id);
      errors.push(send.error ?? "send failed");
    }
  }
  return { sent, errors };
}
