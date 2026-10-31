import { test } from "vitest";
import { extractWithFallback } from "../../src/lib/extractor";

console.log("=== Testing Extraction Fallback ===");

const raw = "Um, Harsh, no wait, I take the video, by Tuesday. The coffee machine is broken.";
const result = extractWithFallback(raw, "Akash");

console.log("Self corrections:", result.self_corrections);
console.log("Actions:", result.actions);
console.log("Decisions:", result.decisions);

// Check self correction
if (result.self_corrections.length === 0) throw new Error("Expected at least 1 self-correction");
if (result.self_corrections[0].original !== "Harsh") throw new Error("Expected original to be Harsh");
if (result.self_corrections[0].corrected_to !== "Akash") throw new Error("Expected corrected_to to be Akash");

// Check action owner
if (result.actions.length === 0) throw new Error("Expected at least 1 action item");
if (result.actions[0].owner !== "Akash") throw new Error(`Expected owner to be Akash, got ${result.actions[0].owner}`);
if (!result.actions[0].due_date.toLowerCase().includes("tuesday")) throw new Error("Expected due date to be Tuesday");

console.log("✅ Extraction fallback test passed!");

test("extractor script assertions passed at import", () => {});
