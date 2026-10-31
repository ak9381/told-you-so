import { log } from "@/lib/log";
/**
 * Check if an email is in the allowlist.
 * ALLOWED_EMAILS is a comma-separated secret with at most 5 entries.
 */
export function isEmailAllowed(email: string): boolean {
  const raw = process.env.ALLOWED_EMAILS || "";
  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Safety: refuse to check if more than 5 are listed
  if (list.length > 5) {
    log.error("ALLOWED_EMAILS has more than 5 entries — refusing access");
    return false;
  }

  return list.includes(email.toLowerCase());
}

