// Best-effort resolver from a descriptive due string to an absolute ISO time.
// Precise for the demo-critical relative case ("in N minutes"); approximate for
// natural dates (exact time doesn't matter there — those use a 24h reminder lead).

// Users are in India: wall-clock times ("11:59 PM", "tonight") mean IST.
// We do the calendar math on an IST-shifted clock, then shift back to UTC.
const IST_OFFSET_MS = 330 * 60000;
const fromIst = (d: Date) => new Date(d.getTime() - IST_OFFSET_MS).toISOString();

export function resolveDue(input?: string | null): string | null {
  if (!input) return null;
  const s = input.toLowerCase().trim();
  const now = new Date();

  // Absolute ISO timestamps. One with an explicit offset (+05:30, -04:00) is
  // trusted. A bare one ("2026-11-01T23:59") or one tagged IST is IST wall
  // clock. A trailing "Z" from the model is almost always IST wall clock
  // mislabelled as UTC (that turned 11:59 PM into 5:29 AM), so it's read as IST.
  const iso = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[t ](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?\s*(z|ist|[+-]\d{2}:?\d{2})?$/i);
  if (iso) {
    const [, y, mo, d, hh, mm, tz] = iso;
    if (tz && /^[+-]/.test(tz)) {
      const t = Date.parse(`${y}-${mo}-${d}T${(hh ?? "09").padStart(2, "0")}:${mm ?? "00"}:00${tz.length === 5 ? tz.slice(0, 3) + ":" + tz.slice(3) : tz}`);
      return isNaN(t) ? null : new Date(t).toISOString();
    }
    const wall = new Date(Date.UTC(+y, +mo - 1, +d, hh ? +hh : 9, mm ? +mm : 0));
    return isNaN(wall.getTime()) ? null : fromIst(wall);
  }

  // "in N minutes/hours" — exact, used for the demo reminder beat.
  const rel = s.match(/in\s+(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs)/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const ms = /h/.test(rel[2]) ? n * 3600000 : n * 60000;
    return new Date(now.getTime() + ms).toISOString();
  }

  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const wd = weekdays.findIndex((d) => s.includes(d));
  let dayOffset = 0;
  if (s.includes("tomorrow")) dayOffset = 1;
  else if (wd >= 0) {
    let diff = (wd - new Date(now.getTime() + IST_OFFSET_MS).getUTCDay() + 7) % 7;
    if (diff === 0) diff = 7; // next occurrence
    dayOffset = diff;
  }

  const base = new Date(now.getTime() + IST_OFFSET_MS); // IST wall clock in UTC fields
  const timeMatch = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);

  // Explicit calendar dates: "1 Nov", "Nov 1", "1st November 2026", "2026-11-01 11:59 pm".
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const mon = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
  const dm = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${mon}(?:,?\\s+(\\d{4}))?`));
  const md = dm ? null : s.match(new RegExp(`\\b${mon}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`));
  const ymd = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  let explicit: { y: number; m: number; d: number } | null = null;
  if (dm) explicit = { d: +dm[1], m: MONTHS.indexOf(dm[2]), y: dm[3] ? +dm[3] : base.getUTCFullYear() };
  else if (md) explicit = { m: MONTHS.indexOf(md[1]), d: +md[2], y: md[3] ? +md[3] : base.getUTCFullYear() };
  else if (ymd) explicit = { y: +ymd[1], m: +ymd[2] - 1, d: +ymd[3] };
  if (explicit && explicit.m >= 0 && explicit.d >= 1 && explicit.d <= 31) {
    let h = 9;
    let min = 0;
    if (timeMatch) {
      h = parseInt(timeMatch[1], 10);
      min = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      if (timeMatch[3] === "pm" && h < 12) h += 12;
      if (timeMatch[3] === "am" && h === 12) h = 0;
    } else if (s.includes("midnight") || s.includes("eod") || s.includes("end of day")) {
      h = 23;
      min = 59;
    }
    return fromIst(new Date(Date.UTC(explicit.y, explicit.m, explicit.d, h, min)));
  }

  if (s.includes("midnight")) {
    base.setUTCDate(base.getUTCDate() + dayOffset);
    base.setUTCHours(23, 59, 0, 0);
    return fromIst(base);
  }
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const min = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (timeMatch[3] === "pm" && h < 12) h += 12;
    if (timeMatch[3] === "am" && h === 12) h = 0;
    base.setUTCDate(base.getUTCDate() + dayOffset);
    base.setUTCHours(h, min, 0, 0);
    return fromIst(base);
  }
  if (s.includes("tonight")) {
    base.setUTCHours(22, 0, 0, 0);
    return fromIst(base);
  }
  if (s.includes("today")) {
    base.setUTCHours(23, 59, 0, 0);
    return fromIst(base);
  }
  if (dayOffset > 0) {
    base.setUTCDate(base.getUTCDate() + dayOffset);
    base.setUTCHours(9, 0, 0, 0);
    return fromIst(base);
  }
  return null;
}

/** Is this action part of the live demo (shorter reminder lead)? */
export function isDemoProject(projectName?: string): boolean {
  return (projectName || "").toLowerCase().includes("hackathon");
}

/** One display format everywhere: "1 Nov 2026, 11:59 pm IST" (no seconds). */
export function formatIst(value?: string | null, opts: { time?: boolean } = {}): string {
  if (!value) return "—";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(dateOnly ? `${value}T12:00:00+05:30` : value);
  if (isNaN(d.getTime())) return value;
  const date = d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
  if (dateOnly || opts.time === false) return date;
  const time = d
    .toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
  return `${date}, ${time} IST`;
}

const MONTH_OR_ISO = /\b(\d{4}-\d{2}-\d{2}|jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/i;

/**
 * How to show an extracted due date in the review tray. Relative phrases
 * ("by Wednesday") are resolved and marked as inferred:
 *   "Wed 4 Nov (from 'by Wednesday')". Explicit dates are just formatted.
 */
export function describeDue(raw?: string | null): { text: string; inferred: boolean } {
  const phrase = (raw || "").trim();
  if (!phrase) return { text: "no due date", inferred: false };
  const iso = resolveDue(phrase);
  if (!iso) return { text: phrase, inferred: false };
  if (MONTH_OR_ISO.test(phrase)) return { text: formatIst(iso), inferred: false };
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
  return { text: `${day.replace(",", "")} (from '${phrase}')`, inferred: true };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * A meeting date written in a file name or transcript header, as YYYY-MM-DD:
 * "28oct", "28 Oct", "4-nov", "Oct 28", "October 28th", or "2026-10-28".
 * Day-month without a year uses `year` (default: the current IST year).
 * Returns null when nothing date-like is found.
 */
export function parseMeetingDate(text?: string | null, year?: number): string | null {
  const s = (text || "").toLowerCase();
  if (!s) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${pad(m)}-${pad(d)}`;
  }
  const y = year ?? Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 4));
  const mon = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";
  const dm = s.match(new RegExp(`(?:^|[^0-9a-z])(\\d{1,2})(?:st|nd|rd|th)?[\\s._-]*${mon}(?![a-z])`));
  const md = s.match(new RegExp(`(?:^|[^a-z])${mon}[\\s._-]*(\\d{1,2})(?:st|nd|rd|th)?(?![0-9])`));
  let day: number | null = null;
  let month: number | null = null;
  if (dm) {
    day = Number(dm[1]);
    month = MONTHS.indexOf(dm[2]) + 1;
  } else if (md) {
    month = MONTHS.indexOf(md[1]) + 1;
    day = Number(md[2]);
  }
  if (!day || !month || day > 31) return null;
  return `${y}-${pad(month)}-${pad(day)}`;
}
