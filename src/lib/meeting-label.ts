import { formatIst } from "./dates";

/**
 * "Pricing sync · 24 Oct 2026" — the meeting's name plus its date, falling
 * back to "Meeting #N" only when no title was saved.
 */
export function meetingLabel(seq: number | null | undefined, title?: string | null, date?: string | null): string {
  const name = (title || "").split(" · ")[0].trim() || (seq ? `Meeting #${seq}` : "Earlier meeting");
  const d = date ? formatIst(date, { time: false }) : "";
  return d && d !== "—" && !name.includes(d) ? `${name} · ${d}` : name;
}
