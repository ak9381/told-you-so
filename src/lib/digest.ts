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
  personName: string
): Promise<PersonDigest> {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: actions } = await supabase
    .from("actions")
    .select("title, due_date, status, source_quote")
    .eq("owner", personName)
    .order("due_date", { ascending: true });

  const { data: changed } = await supabase
    .from("decisions")
    .select("topic, exact_quote, status")
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: objections } = await supabase
    .from("objections")
    .select("old_quote, new_quote, verdict, old_speaker, new_speaker")
    .or(`old_speaker.eq.${personName},new_speaker.eq.${personName}`)
    .limit(10);

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

export function renderDigestHtml(d: PersonDigest): string {
  const items = (arr: string[]) =>
    arr.length ? `<ul>${arr.map((x) => `<li>${x}</li>`).join("")}</ul>` : "<p style='color:#888'>Nothing this week.</p>";
  return `<div style="font-family:system-ui;max-width:600px">
    <h2>Weekly digest — ${d.person}</h2>
    <h3>Your open tasks</h3>
    ${items(d.actions.filter((a) => a.status === "open").map((a) => `${a.title}${a.due_date ? ` — due ${a.due_date}` : ""}`))}
    <h3>What changed this week</h3>
    ${items(d.changed.map((c) => `[${c.topic}] &ldquo;${c.exact_quote}&rdquo;${c.status !== "active" ? ` (${c.status})` : ""}`))}
    <h3>Open objections involving you</h3>
    ${items(d.objections.map((o) => `&ldquo;${o.old_quote}&rdquo; vs &ldquo;${o.new_quote}&rdquo;${o.verdict ? ` → ${o.verdict}` : " (unresolved)"}`))}
  </div>`;
}

export async function runDigests(): Promise<{ sent: number; errors: string[] }> {
  const supabase = createServerClient();
  const { data: people } = await supabase.from("people").select("name, email");
  let sent = 0;
  const errors: string[] = [];

  for (const p of people ?? []) {
    const digest = await buildDigest(supabase, p.name);
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
