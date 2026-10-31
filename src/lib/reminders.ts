import { createServerClient } from "./supabase";
import { sendEmail } from "./email";

export interface ReminderRunResult {
  sent: number;
  checked: number;
  errors: string[];
}

interface ActionRow {
  id: string;
  title: string;
  owner: string | null;
  due_date: string | null;
  reminder_lead_min: number | null;
  source_quote: string | null;
}

// Email owners when now >= due - lead, exactly once (idempotent via the outbox).
// opts.force sends immediately (the per-action "Remind now" button).
export async function runReminders(opts?: {
  force?: boolean;
  actionId?: string;
}): Promise<ReminderRunResult> {
  const supabase = createServerClient();
  const now = Date.now();
  const result: ReminderRunResult = { sent: 0, checked: 0, errors: [] };

  let query = supabase
    .from("actions")
    .select("id, title, owner, due_date, reminder_lead_min, source_quote")
    .eq("status", "open")
    .not("due_date", "is", null);
  if (opts?.actionId) query = query.eq("id", opts.actionId);

  const { data: actions } = await query;
  result.checked = actions?.length ?? 0;

  for (const a of (actions ?? []) as ActionRow[]) {
    const due = a.due_date ? new Date(a.due_date).getTime() : null;
    if (due === null) continue;
    const lead = (a.reminder_lead_min ?? 1440) * 60000;
    const fireAt = due - lead;
    if (!opts?.force && now < fireAt) continue;

    // Idempotent: skip if a reminder for this action was already SENT.
    const { data: prior } = await supabase
      .from("outbox")
      .select("id, status")
      .eq("type", "reminder")
      .eq("action_id", a.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const existing = prior?.[0];
    if (existing?.status === "SENT") continue;

    const personName = a.owner || "Someone";
    const { data: person } = await supabase
      .from("people")
      .select("email")
      .eq("name", personName)
      .maybeSingle();

    const scheduledAt = new Date(fireAt).toISOString();
    let outboxId = existing?.id as string | undefined;
    if (!outboxId) {
      const { data: ob } = await supabase
        .from("outbox")
        .insert({
          type: "reminder",
          person_name: personName,
          person_email: person?.email ?? null,
          action_id: a.id,
          subject: `Reminder: ${a.title}`,
          scheduled_at: scheduledAt,
          status: "SCHEDULED",
        })
        .select("id")
        .single();
      outboxId = ob?.id;
    }

    const send = await sendEmail({
      toName: personName,
      subject: `Reminder: ${a.title}`,
      html: `<div style="font-family:system-ui">
        <p><b>${personName}</b>, a reminder from Told You So:</p>
        <h3>${a.title}</h3>
        ${a.source_quote ? `<blockquote style="color:#666">&ldquo;${a.source_quote}&rdquo;</blockquote>` : ""}
        <p>Due: ${a.due_date}</p>
      </div>`,
    });

    if (send.ok) {
      await supabase
        .from("outbox")
        .update({ status: "SENT", sent_at: new Date().toISOString(), resend_id: send.id ?? null, error: null })
        .eq("id", outboxId);
      result.sent += 1;
    } else {
      await supabase
        .from("outbox")
        .update({ status: "FAILED", error: send.error ?? "send failed" })
        .eq("id", outboxId);
      result.errors.push(send.error ?? "send failed");
    }
  }

  return result;
}
