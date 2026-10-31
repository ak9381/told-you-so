/**
 * fetch with a timeout and one retry on network errors / 429 / 5xx.
 * Used for Gemini, Notion and Resend.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  { timeoutMs = 20_000, retries = 1, label = "fetch" }: { timeoutMs?: number; retries?: number; label?: string } = {}
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        console.warn(`${label}: HTTP ${res.status}, retrying`);
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      console.warn(`${label}: attempt ${attempt + 1} failed:`, e instanceof Error ? e.message : e);
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed`);
}
