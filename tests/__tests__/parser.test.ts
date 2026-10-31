import { parseMeetingInput } from "../../src/lib/parser";

const KICKOFF_SAMPLE = `[00:15] Speaker 1: Welcome everyone to the Product Space Agentic AI Hackathon kickoff.
[00:42] Sakshi: Let me clarify the core rules. First, team size is maximum 2 people.
[01:10] Speaker 1: What about old projects?
[01:15] Sakshi: No old projects. Everything must be built brand new today.
[01:45] Sakshi: Submission deadline is tonight, 11:59 PM IST strictly.
[02:10] Sakshi: The project must be deployed with test credentials provided in the form.`;

const WHATSAPP_SAMPLE_IOS = `[31/10/26, 2:05:12 PM] Rohan: Bro I'm in for the hackathon, adding Neha too, we can be 3 na?
[31/10/26, 2:06:01 PM] Neha: Yes 3 is fine I think, they never said a limit
[31/10/26, 2:07:33 PM] Akash: Ok cool. When's the submission?`;

const WHATSAPP_SAMPLE_ANDROID = `31/10/26, 14:05 - Rohan: Deadline is tomorrow morning I heard, we have the whole night 😎
31/10/26, 14:06 - Neha: Also can we just submit my old expense-tracker project? old projects are fine right
31/10/26, 14:07 - Akash: Let's aim to submit by midnight then`;

const SLACK_SAMPLE = `Harsh: I will prepare the presentation slides by Monday.
Akash: I will take the video by Tuesday.`;

console.log("=== Testing Parsers ===");

// 1. Kickoff Transcript
const transRes = parseMeetingInput(KICKOFF_SAMPLE);
console.log(`\n1. Transcript: detected = ${transRes.detectedType}, count = ${transRes.utterances.length}`);
transRes.utterances.forEach((u) => console.log(`   [${u.said_at}] ${u.speaker}: "${u.content.slice(0, 40)}..."`));
if (transRes.utterances.length !== 6) throw new Error("Expected 6 utterances in transcript");
if (transRes.detectedType !== "transcript") throw new Error("Expected transcript type");

// 2. WhatsApp iOS
const waIosRes = parseMeetingInput(WHATSAPP_SAMPLE_IOS);
console.log(`\n2. WhatsApp iOS: detected = ${waIosRes.detectedType}, count = ${waIosRes.utterances.length}`);
waIosRes.utterances.forEach((u) => console.log(`   [${u.said_at}] ${u.speaker}: "${u.content.slice(0, 40)}..."`));
if (waIosRes.utterances.length !== 3) throw new Error("Expected 3 utterances in WhatsApp iOS");
if (waIosRes.detectedType !== "whatsapp") throw new Error("Expected whatsapp type");

// 3. WhatsApp Android
const waAndRes = parseMeetingInput(WHATSAPP_SAMPLE_ANDROID);
console.log(`\n3. WhatsApp Android: detected = ${waAndRes.detectedType}, count = ${waAndRes.utterances.length}`);
waAndRes.utterances.forEach((u) => console.log(`   [${u.said_at}] ${u.speaker}: "${u.content.slice(0, 40)}..."`));
if (waAndRes.utterances.length !== 3) throw new Error("Expected 3 utterances in WhatsApp Android");
if (waAndRes.detectedType !== "whatsapp") throw new Error("Expected whatsapp type");

// 4. Slack Generic
const slackRes = parseMeetingInput(SLACK_SAMPLE, "chat");
console.log(`\n4. Slack/Chat: detected = ${slackRes.detectedType}, count = ${slackRes.utterances.length}`);
slackRes.utterances.forEach((u) => console.log(`   ${u.speaker}: "${u.content}"`));
if (slackRes.utterances.length !== 2) throw new Error("Expected 2 utterances in Slack sample");

console.log("\n✅ All parser tests passed successfully!");
