// Scripted "Play demo clip" meetings, shared by the UI and scripts/build-demo-cache.ts.
export const DEMO_CLIPS: Record<string, { speaker: string; text: string }[]> = {
  "Hackathon submission": [
    { speaker: "Akash", text: "Okay everyone, quick sync on the hackathon submission." },
    { speaker: "Rohan", text: "I think the demo video can be like five minutes, we have a lot to show." },
    { speaker: "Akash", text: "And the LinkedIn posts we can do by Monday, right?" },
    { speaker: "Neha", text: "Let's submit by 11 PM tonight to be safe." },
    { speaker: "Akash", text: "Decided: Priya owns the demo video, due 10:30 tonight." },
    { speaker: "Akash", text: "Okay, ending the meeting." },
  ],
  "Fintech recon dashboard": [
    { speaker: "Akash", text: "Welcome Ankit, quick sync on the dashboard." },
    { speaker: "Ankit", text: "Why are we on Postgres? Mongo is faster for dashboards, let's switch." },
    { speaker: "Ankit", text: "And let's just do polling, webhooks are overkill for an MVP." },
    { speaker: "Ankit", text: "Clerk for auth is fine by me, maybe with Google login only." },
    { speaker: "Akash", text: "Decided: Ankit owns the dashboard read-model spec, due Tuesday." },
  ],
};

/** The transcript text the UI sends to /api/ingest when a clip finishes. */
export const clipTranscript = (lines: { speaker: string; text: string }[]) =>
  lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");
