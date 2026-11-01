// Scripted "Play demo clip" meetings, shared by the UI and scripts/build-demo-cache.ts.
export const DEMO_CLIPS: Record<string, { speaker: string; text: string }[]> = {
  // The launch story (default clip): Neerja pushes back on the 28 Oct decisions.
  "Launch sync": [
    { speaker: "Akash", text: "Okay, quick launch sync. Neerja, where are we?" },
    { speaker: "Neerja", text: "Neerja here. Honestly, let's push the launch to November 14th, there's no rush." },
    { speaker: "Neerja", text: "And let's move hosting to Vercel instead of Cloudflare, it's easier to deploy." },
    { speaker: "Neerja", text: "Also let's add a free tier at launch so people can try it." },
    { speaker: "Akash", text: "Okay, Neerja owns the landing page copy, due Thursday." },
  ],
  "Hackathon submission": [
    { speaker: "Akash", text: "Okay everyone, quick sync on the hackathon submission." },
    { speaker: "Neerja", text: "I think the demo video can be like five minutes, we have a lot to show." },
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
