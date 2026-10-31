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
