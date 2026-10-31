import { fetchWithRetry } from "@/lib/http";
// Resend email helper. With no verified domain, Resend only delivers to the
// account owner's address, so every demo email goes there with the intended
// person's name in the subject (per the plan).

function ownerEmail(): string {
  const allowed = (process.env.ALLOWED_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
  return process.env.RESEND_OWNER_EMAIL || allowed[0] || "akashkraju218@gmail.com";
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
