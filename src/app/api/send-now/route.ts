import { log } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders";
import { runDigests, buildDigest, renderDigestHtml } from "@/lib/digest";
import { createServerClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { requireUser, readJson, canAccessAction, isUuid, jsonError, userProjectIds } from "@/lib/api-guard";

// Authenticated UI endpoint for the "Send now" / "Remind now" buttons.
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const parsed = await readJson(request, 10_000);
  if (parsed.error) return parsed.error;
  const { kind, actionId, person } = parsed.body as Record<string, unknown>;

  try {
  if (kind === "reminder") {
    if (actionId != null && (!isUuid(actionId) || !(await canAccessAction(createServerClient(), actionId, auth.user.id)))) {
      return jsonError("Task not found.", 404);
    }
    const r = await runReminders({ force: true, actionId: isUuid(actionId) ? actionId : undefined });
    return NextResponse.json({ ok: true, ...r });
  }

  if (kind === "digest-all") {
    // Only the caller's projects' teams — never every user's people.
    const r = await runDigests({ projectIds: await userProjectIds(createServerClient(), auth.user.id) });
    return NextResponse.json({ ok: true, ...r });
  }

  if (kind === "digest-one" && typeof person === "string" && person.trim()) {
    const supabase = createServerClient();
    const digest = await buildDigest(supabase, person, await userProjectIds(supabase, auth.user.id));
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

  } catch (e) {
    log.error("send-now error:", e);
    return jsonError("Could not send right now. Please try again in a minute.", 500);
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
