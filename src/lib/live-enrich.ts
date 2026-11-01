import type { MemoryDecision } from "@/lib/agent";

const norm = (s?: string | null) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export interface LiveCite {
  old_quote?: string;
  old_speaker?: string;
  old_meeting_seq?: number;
  old_meeting_title?: string | null;
  old_meeting_date?: string | null;
}

/**
 * Attach the real receipt (speaker, meeting title + date) to a live result by
 * matching its old_quote against project memory, so cards say
 * "Launch planning · 28 Oct 2026" instead of "Meeting #N".
 */
export function citeFromMemory<T extends LiveCite>(r: T, memory: MemoryDecision[]): T {
  const q = norm(r.old_quote);
  if (!q) return r;
  const m = memory.find((d) => {
    const t = norm(d.exact_quote);
    return t && (t === q || t.includes(q) || q.includes(t));
  });
  if (!m) return r;
  return {
    ...r,
    old_speaker: m.speaker || r.old_speaker,
    old_meeting_seq: m.meeting_seq,
    old_meeting_title: m.meeting_title ?? null,
    old_meeting_date: m.meeting_date ?? null,
  };
}
