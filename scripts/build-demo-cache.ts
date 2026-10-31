/**
 * Regenerate src/lib/demo-cache.json from the real model (manual, needs a key):
 *   GEMINI_API_KEY=… DEMO_USER_NAME=Akash npx tsx --tsconfig tsconfig.json scripts/build-demo-cache.ts
 * Review the JSON diff, then commit it. Bypasses the usage table (no Supabase needed).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { extractMeetingItems } from "../src/lib/extractor";
import { demoCacheKey } from "../src/lib/demo-cache";
import { DEMO_CLIPS, clipTranscript } from "../src/lib/demo-clips";

const user = process.env.DEMO_USER_NAME || "Akash";
const inputs: [string, string][] = [
  ...Object.entries(DEMO_CLIPS).map(([k, v]) => [`clip:${k}`, clipTranscript(v)] as [string, string]),
  ["demo/whatsapp-fintech-demo.txt", readFileSync("demo/whatsapp-fintech-demo.txt", "utf8")],
];

const out: Record<string, unknown> = {};
for (const [label, text] of inputs) {
  const r = await extractMeetingItems(text, "demo-cache-script", user, { skipCache: true, skipUsage: true });
  out[await demoCacheKey(text, user)] = r;
  console.log(`${label}: ${r.decisions.length} decisions, ${r.actions.length} actions`);
}
writeFileSync("src/lib/demo-cache.json", JSON.stringify(out, null, 2) + "\n");
