import { fetchWithRetry } from "@/lib/http";
// Resend email helper. With no verified domain, Resend only delivers to the
// account owner's address, so every demo email goes there with the intended
// person's name in the subject (per the plan).

// Resend test mode only delivers to the account owner's verified address.
// Falling back to ALLOWED_EMAILS[0] sent to an unverified inbox and failed.
export const DEMO_INBOX = "ak9381@nyu.edu";
/** The one verified inbox every demo email is delivered to. */
export function reminderInbox(): string {
  return ownerEmail();
}
function ownerEmail(): string {
  return (process.env.RESEND_OWNER_EMAIL || "").trim() || DEMO_INBOX;
}

/** Map a raw Resend error to short, friendly copy (the raw text is logged, never shown). */
export function friendlyEmailError(raw?: string | null): string {
  const r = (raw || "").toLowerCase();
  if (!r) return "Not delivered.";
  if (r.includes("testing emails") || r.includes("verify a domain"))
    return "Not delivered: the free email plan can only send to the demo inbox.";
  if (r.includes("api_key") || r.includes("api key") || r.includes("missing")) return "Email isn't set up on the server.";
  if (r.includes("rate") || r.includes("429")) return "Email provider is rate-limiting — will retry later.";
  if (r.includes("timeout") || r.includes("abort")) return "Email provider timed out.";
  return "Not delivered — the email provider rejected it.";
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(opts: {
  toName: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY missing" };
  const from = process.env.RESEND_FROM || "Told You So <onboarding@resend.dev>";

  try {
    const res = await fetchWithRetry("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [ownerEmail()],
        subject: `[Told You So · ${opts.toName}] ${opts.subject}`,
        html: opts.html,
      }),
    }, { timeoutMs: 15_000, retries: 0, label: "resend" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.message || `HTTP ${res.status}` };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
