import { formatSpokenTokens } from "../../src/lib/messySpeech";

const raw = "Um, like, Harsh, no wait, I take the video, by Tuesday. Anyway.";
const tokens = formatSpokenTokens(raw);
console.log("Tokens for:", raw);
tokens.forEach((t) => {
  const flags = [];
  if (t.isFiller) flags.push("FILLER");
  if (t.isStrikethrough) flags.push("STRIKE");
  console.log(`  "${t.text}": ${flags.join(", ") || "NORMAL"}`);
});

const harshToken = tokens.find((t) => t.text === "Harsh");
if (!harshToken?.isStrikethrough) throw new Error("Expected 'Harsh' to be struck through");

const umToken = tokens.find((t) => t.text.toLowerCase().includes("um"));
if (!umToken?.isFiller) throw new Error("Expected 'Um' to be marked as filler");

console.log("✅ Messy speech visual formatting test passed!");
