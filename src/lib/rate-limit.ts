// Per-user sliding-window limiter for non-AI write routes. In-memory per
// Worker isolate: best-effort burst protection (a determined client spread
// across isolates can exceed it; AI routes are additionally capped in the DB
// via the usage table). For a hard global limit use Cloudflare Rate Limiting
// rules or a Durable Object — see stages/prod-ready-log.md.
const hits = new Map<string, number[]>();

export const WRITE_LIMIT = 60; // writes
export const WRITE_WINDOW_MS = 60_000; // per minute

export function checkRateLimit(
  key: string,
  limit = WRITE_LIMIT,
  windowMs = WRITE_WINDOW_MS,
  now = Date.now()
): { ok: boolean; retryAfterSec: number } {
  const since = now - windowMs;
  const arr = (hits.get(key) ?? []).filter((t) => t > since);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000)) };
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => t > since)) hits.delete(k);
  }
  return { ok: true, retryAfterSec: 0 };
}

export function _resetRateLimit() {
  hits.clear();
}
