// Structured JSON logging for server code (Workers logs / Logpush parse one
// JSON object per line). Usage: log.error("digest send failed", err, { person }).
type Level = "info" | "warn" | "error";

function serialize(v: unknown): unknown {
  if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack?.split("\n").slice(0, 5).join("\n") };
  return v;
}

function emit(level: Level, msg: string, args: unknown[]) {
  const entry: Record<string, unknown> = { level, msg: msg.replace(/:\s*$/, ""), ts: new Date().toISOString() };
  const extra: unknown[] = [];
  for (const a of args) {
    if (a && typeof a === "object" && !(a instanceof Error) && !Array.isArray(a)) Object.assign(entry, a);
    else extra.push(serialize(a));
  }
  if (extra.length === 1) entry.detail = extra[0];
  else if (extra.length > 1) entry.detail = extra;
  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    line = JSON.stringify({ level, msg: entry.msg, ts: entry.ts, detail: "[unserializable]" });
  }
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const log = {
  info: (msg: string, ...args: unknown[]) => emit("info", msg, args),
  warn: (msg: string, ...args: unknown[]) => emit("warn", msg, args),
  error: (msg: string, ...args: unknown[]) => emit("error", msg, args),
};
