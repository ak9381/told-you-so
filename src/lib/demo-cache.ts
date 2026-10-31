// Demo-response cache (stage-9d §4.5): pre-recorded Gemini extractions for the
// known demo inputs (the "Play demo clip" transcripts and demo/whatsapp-fintech-demo.txt),
// so a recording never waits on Gemini or burns the daily AI cap.
// Keyed by SHA-256 of the whitespace-normalised input + the "I" user name.
// Populate with `GEMINI_API_KEY=… npx tsx scripts/build-demo-cache.ts`.
import type { ExtractionResult } from "@/lib/extractor";
import cache from "@/lib/demo-cache.json";

const CACHE = cache as Record<string, ExtractionResult>;

export function normalizeForCache(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
}

export async function demoCacheKey(text: string, userName: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${normalizeForCache(text)}|${userName.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getCachedDemoExtraction(
  text: string,
  userName: string,
  store: Record<string, ExtractionResult> = CACHE
): Promise<ExtractionResult | null> {
  const hit = store[await demoCacheKey(text, userName)];
  return hit ? { ...structuredClone(hit), is_cached: true } : null;
}
