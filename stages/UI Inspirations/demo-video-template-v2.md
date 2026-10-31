# Demo video template v2: "Told You So" (Product Space x Wispr Flow)

Rubric focus: Wispr voice 20, UX 20, AI 20. Length 2:30-2:50, with a hard stop before 3:00 (judges may stop watching at 3:00).

## What winners do (with sources)
- **Jayu, Best Overall, Gemini API Developer Competition 2024.** Opens in about 10 seconds with who he is and the idea of "AI that's more than a chatbot". Within the first 30 seconds you see voice commands acting on the real screen ("Hey Jayu, look at my screen..."). His proof is live actions completing on screen, and he says one sentence on how it works and one on privacy. Fast cuts, no slides. Video: https://www.youtube.com/watch?v=G4RNny8s8Vw (transcript checked). Winners list: https://ai.google.dev/competition
- **Vite Vere, Most Impactful and People's Choice, same competition.** Judges praised a real user being guided step by step on a real task. https://developers.googleblog.com/en/announcing-the-winners-of-the-gemini-api-developer-competition/ (UNVERIFIED: I didn't watch the video.)
- **Prospera, Most Useful, same competition.** Live coaching during a sales call, which is the closest match to a meeting agent. https://ai.google.dev/competition (UNVERIFIED: I didn't watch the video.)
- **Gaze Link, Best Android, same competition.** One clear user and one clear moment of value. https://ai.google.dev/competition (UNVERIFIED: I didn't watch the video.)
- **Llama Navigator AI, 1st place at Meta's Llama Impact Hackathon on lablab.** Government-benefits access. https://lablab.ai/ai-hackathons/llama-impact-hackathon/live (UNVERIFIED: I didn't watch the demo.)
- **Judge advice.** Devpost says to put the elevator pitch in the first few seconds, use a screencast rather than a marketing video, write a script, edit out the messy parts, and not cram or speed up the audio: https://help.devpost.com/article/84-video-making-best-practices and https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video
- **Judges rely on the video.** Gemini 3 Hackathon judges "will depend heavily on your demo video" and may score only the first 3 minutes. They also asked how the model and tools were used, and for an architecture diagram: https://gemini3.devpost.com/updates/42889-judging-progress
- **Storytelling counts.** From Devpost's judges post: "Presentation and storytelling matters": https://info.devpost.com/blog/hackathon-judging-tips

## Changes from v1
1. Show the product within 15 seconds. v1 kept the real UI until 1:20, which is too late.
2. Cut the explanation part from 40 seconds to about 20, with one diagram. The demo becomes about 60% of the video.
3. Make voice the hero. The Wispr moment appears 3 times (debrief, objection and confirm), each with a "spoken via Wispr" badge, to score on the 20-point criterion.
4. Add a "wow" beat: the agent argues back with evidence from the meeting ("Told you so: on Oct 12 you said...").
5. Show the real error state and the confirmation tray once. That proves it's real and not mocked, and it earns UX points.
6. Replace the results table with on-screen proof from this build only: a timestamp quote, the extracted items, and the speed of the real run. No made-up metrics.
7. Use a calm voiceover at about 140 words per minute, with no sped-up audio. Captions stay on.

## Timeline (2:45)
| Time | Section | On screen |
|---|---|---|
| 0:00-0:12 | Hook + pitch | Pain line: "Meetings decide things, then everyone forgets." Then a card: "Told You So: the meeting agent that argues back." |
| 0:12-0:30 | Voice debrief (Wispr 1) | Speak the debrief through Wispr, and the text streams in. Badge: "Wispr Flow". |
| 0:30-1:10 | Extraction + split view | Real model extraction: decisions, owners and dates. Punch-in zooms on the split view. |
| 1:10-1:45 | The argue-back (wow) | A new claim contradicts a past decision, and the agent pushes back with a quote and date. Reply by voice (Wispr 2). |
| 1:45-2:10 | Confirmation tray (Wispr 3) | Confirm by voice. Show one real error banner that is handled cleanly. |
| 2:10-2:30 | How it works | One diagram: Wispr, then ingest, extractor model, ledger DB and argue-back. Name the model and tools used. |
| 2:30-2:45 | Close | 3-clip recap, the tagline, and the repo or live link. |

## Brief for Claude
"Build a 2:45 demo video for 'Told You So' using the timeline above. Use Remotion (or HTML with a headless render). Use the courtroom-ledger theme (Fraunces serif, stamp red, warm paper). Show the real UI within 12 seconds. Mark each of the 3 Wispr voice moments with a 'Wispr Flow' badge. Use punch-in zooms on my screen recordings in <folder>, and add word-by-word captions from my voiceover at <file>. Use one architecture diagram at 2:10. Use only real outputs from my recordings, with no invented numbers or fake success screens. Keep it under 2:50. Use subagents."
