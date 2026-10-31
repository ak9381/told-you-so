import { NextRequest, NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders";
import { runDigests, buildDigest, renderDigestHtml } from "@/lib/digest";
import { createServerClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";

// Authenticated UI endpoint for the "Send now" / "Remind now" buttons.
export async function POST(request: NextRequest) {
  const { kind, actionId, person } = await request.json();

  if (kind === "reminder") {
    const r = await runReminders({ force: true, actionId });
    return NextResponse.json({ ok: true, ...r });
  }

  if (kind === "digest-all") {
    const r = await runDigests();
    return NextResponse.json({ ok: true, ...r });
  }

  if (kind === "digest-one" && person) {
    const supabase = createServerClient();
    const digest = await buildDigest(supabase, person);
    const html = renderDigestHtml(digest);
    const { data: ob } = await supabase
      .from("outbox")
      .insert({
        type: "digest",
        person_name: person,
        subject: "Weekly digest",
        scheduled_at: new Date().toISOString(),
        status: "SCHEDULED",
      })
      .select("id")
      .single();
    const send = await sendEmail({ toName: person, subject: "Weekly digest", html });
    if (send.ok) {
      await supabase
        .from("outbox")
        .update({ status: "SENT", sent_at: new Date().toISOString(), resend_id: send.id ?? null, error: null })
        .eq("id", ob?.id);
    } else {
      await supabase.from("outbox").update({ status: "FAILED", error: send.error }).eq("id", ob?.id);
    }
    return NextResponse.json({ ok: send.ok, error: send.error });
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
