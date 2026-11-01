# Demo v2: re-recording plan (written 1 Nov 2026, IST)
Builds on `stages/stage-9d-video-plan.md`, `plan.md` and `DemoScripts/`. The story is the fintech project ("Fintech recon dashboard", seeded by `src/lib/seed-fintech.ts`) with the demo persona **Ankit (Architect, demo)**.
Target length: **2:40** (must stay between 2:00 and 3:00 with voiceover, per the kickoff rules). Live app: https://told-you-so.told-you-so.workers.dev

## 1. The story in one line
Postgres was chosen on 24 Oct. On 31 Oct Ankit says "let's switch to Mongo". Told You So objects and shows the exact quote, who said it and when. That's the "told you so" moment.

## 2. Shot-by-shot script (~2:40)
| # | Time | On screen | Voiceover (Akash, own voice) |
|---|---|---|---|
| 1 | 0:00–0:12 | Title card (`DemoScripts/assets/title.png`), then a WhatsApp-style line: "Ankit: Why are we on Postgres? Let's switch to Mongo." | "We picked Postgres a week ago. Today someone wants Mongo. And nobody can find where we decided it." |
| 2 | 0:12–0:24 | Home page, the fintech project selected | "Told You So remembers what your team decided, from calls, chats and voice notes. When someone goes against a decision, it tells you, with the receipt." |
| 3 | 0:24–0:40 | Timeline of the fintech project: meetings #1–#3 (Postgres 24 Oct, webhooks 27 Oct, Clerk auth) | "This project already has three meetings of memory. Postgres for the ledger. Webhooks, not polling. Clerk for login." |
| 4 | 0:40–1:05 | Debrief box. Hold Fn, Wispr Flow bar visible. Dictate a messy debrief: "Okay so after the client call, um, Meera owns the, no wait, I own the reconciliation report, by Friday, actually Thursday." Click Process. | "After a call I just talk. I use Wispr Flow, so I can ramble, change my mind mid-sentence, and it still works." |
| 5 | 1:05–1:25 | Extraction tray: the task "Akash, reconciliation report, Thursday", the self-correction struck through, **confidence chips** (Verified / % score) on each item | "It pulls out the decisions and tasks. Then a second AI pass checks every item against the transcript. That's the confidence chip. If it can't find proof, it says so, instead of making things up." |
| 6 | 1:25–1:55 | Import `DemoScripts/` WhatsApp export (DEMO DATA label visible) or Live Meeting → **Play demo clip**. Red **OBJECTION** cards: Then (24 Oct, Akash: Postgres, ACID) vs Now (Ankit: Mongo). Second card: webhooks vs polling. Ankit's "keep Clerk, only Google login" shows as a refinement, not flagged. | "Now Ankit joins. He's demo data, I built this solo. He wants Mongo. Told You So finds the old decision, with who said it and when. Told you so. And notice: when he only narrows the Clerk decision, it doesn't cry wolf." |
| 7 | 1:55–2:10 | Click **Keep old** on both cards → Confirm. Ledger shows the new ones struck as superseded. | "I keep the old decisions. One click. The history stays honest." |
| 8 | 2:10–2:25 | **Per-person view** (`/digest/Akash` with the Thursday task) then **per-project** ledger and outbox (reminder email queued), Notion task page | "Each person gets their own list and a weekly digest. Tasks go to Notion, and reminders go out before the deadline." |
| 9 | 2:25–2:35 | Architecture card (`DemoScripts/assets/architecture.png`) | "Under the hood: Next.js on Cloudflare Workers, Supabase, and Gemini 3.5 Flash Lite. Extract, search memory, check the conflict, then ask before saving." |
| 10 | 2:35–2:40 | End card with the live URL | "It's live at told-you-so dot workers dot dev. Talking is how we think, so that's how it should remember." |

About 300 words. If long, cut the Notion clause in shot 8, then the Clerk refinement line in shot 6. Don't read what's on screen; say what the viewer can't see.

## 3. Before recording: seed and checklist
1. Log in as the judge account and as yours; check the fintech project shows meetings #1–#3 (dated 24, 27, 29 Oct) and nothing from earlier test runs. If test data is messy, review `supabase/manual/purge_dry_run_test_data.sql` first (dry run only, don't run it blind).
2. Do one full dry run of shots 4–7 off camera. Check: the chips render, both objections fire, the Clerk line is NOT flagged. Note how many AI calls are left today (the pill shows the 60/day cap); a full run uses about 4–6.
3. Ankit's demo lines must contain gate words (let's, switch, decide…) so the live-check doesn't skip them. "Why are we on Postgres? Let's switch to Mongo" passes because of "let's".
4. Have the WhatsApp export `.txt` (with "DEMO" in the names) in `~/Downloads` for a two-click upload.
5. Delete the dry-run meeting afterwards, or use a fresh copy of the project, so the recorded timeline starts clean.
6. Mac: Focus mode on (no notifications), Chrome full screen 1920×1080, zoom 110–125%, bookmarks bar hidden, other tabs closed, Wispr Flow running and its bar visible.
7. Sign out of anything showing personal email in the corner. Never show `.dev.vars` or `SUBMISSION.md` on screen.

## 4. How to record on the Mac
- **Option A, Loom (simplest):** Screen only, camera off, mic = earphones/MacBook mic. Free plan records up to 5 min per video, enough. Download the MP4.
- **Option B, QuickTime/Screenshot tool:** press ⌘⇧5 → "Record Entire Screen" → Options → Microphone: your mic → Record. Stop from the menu-bar icon. Saves a .mov to Desktop.
- Record in **3 takes**: (1) shots 1–5, (2) shots 6–7, (3) shots 8–10. Redo only the bad take.
- Join + trim with ffmpeg (already used in `DemoScripts/build_video.sh`): normalise to 1920×1080/30fps, concat, cut silences > 0.7 s, keep the Wispr dictation and the objection pop uncut.
- Upload to Google Drive → Share → "Anyone with the link: Viewer". Test in an incognito window before resubmitting.

## 5. Voice: recommendation
**Use your own voice. Don't buy one.** The hackathon is co-run by Wispr Flow, a voice tool, and Wispr usage is 20% of the score; a real person talking while Wispr runs is the authenticity signal. A synthetic narrator can read as faked. Tips: earphones mic, quiet room, read slowly, smile, 2–3 takes per section, pick the best.

**Free fallbacks (only if you truly can't record; label it on screen "Narration: AI voice"):**
| Option | Cost / limits (checked 1 Nov 2026) | Notes |
|---|---|---|
| macOS `say` | Free, built in | System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → download a **Premium/Enhanced** voice (e.g. an English (India) voice). Then `say -v "<Voice name>" -f vo.txt -o vo.aiff`. Siri voices may not be selectable by `say`; test with `say -v '?'`. |
| ElevenLabs free | $0, 10,000 credits/month (≈10k characters of TTS, no rollover) | Free plan is **non-commercial only** and published content must credit ElevenLabs ("elevenlabs.io" or "11.ai" in the title). Voice cloning is not on free. Source: elevenlabs.io/pricing and their help article "Can I publish the content I generate". |
| Google AI Studio / Gemini TTS | Using AI Studio is free; `gemini-2.5-flash-preview-tts` has a free tier within daily limits | Free-tier data may be used to improve Google's products. Pro TTS has no free tier. Source: aistudio.google.com/docs/pricing. |
Script is ~300 words ≈ 1,800 characters, so any of these fit easily. Paid voices aren't needed.

## 6. Addition: open with a live Google Meet (v2 opening, replaces shots 1–2)
**Honest fact:** the app can't pull from Google Meet directly. There's no Meet/Calendar/Drive integration in the code (`src/lib/parser.ts:8` only knows transcript / whatsapp / debrief / chat). So the video shows the real path: Meet call → Meet transcript (Google Doc in Drive) → copy → paste into Told You So as a transcript.

| # | Time | On screen | Voiceover |
|---|---|---|---|
| M1 | 0:00–0:10 | Google Calendar event "Fintech recon #4 · standup" → click **Join with Google Meet**. Captions on (CC) and **Transcript** started (Activities → Transcripts; needs a Workspace plan that has it, otherwise use captions + the Live Meeting mode below). | "Monday standup on our fintech dashboard. Ankit is joining." |
| M2 | 0:10–0:30 | In the Meet, Ankit (second device/browser, demo account, name "Ankit (demo)") says the clip lines (below). Captions show them. | "He's new, and he wants to change things we already decided." |
| M3 | 0:30–0:45 | End the call. Open the transcript Doc in Drive (Meet Recordings folder) → select all → copy. | "Meet saves a transcript. I copy it in. That's the only manual step today." |
| M4 | 0:45–… | Paste into Told You So (source: transcript) → Process → continue with shots 5–8 above (chips, OBJECTION cards, Keep old, per-person view). | — |
Trim shots 3–4 above (timeline and Wispr debrief) to ~20 s total to stay under 3:00, or move the Wispr dictation to after the conflict (Wispr still has to be shown: it's 20% of the score).
**No second person?** Instead of a two-device Meet, use Told You So's **Live Meeting → Play demo clip** for the Ankit lines, and say "Ankit is demo data". Don't fake a second human.

**Cheap features that would make Meet ingestion real (not built, ordered by cost):**
1. *Meet transcript paste cleaner* (~1 h): strip the Doc header, timestamps and "Transcript" title so a raw paste parses cleanly as `Name: text`. Add a "Google Meet" option to the source picker.
2. *Import from Drive link* (~half a day): paste a Meet transcript Doc URL; server fetches it with the Drive API (`files.export` as text/plain) using a Google OAuth token. Needs a Google sign-in scope.
3. *Calendar auto-pull* (1–2 days): after a Calendar event with Meet ends, look up its transcript (Meet REST API `conferenceRecords.transcripts`, Workspace only) and ingest automatically.

## 7. Conflict moment: how it works and whether the seed triggers it
**How it works (code):** `/api/ingest` extracts decisions (`src/lib/extractor.ts`), then `runAgent` (`src/lib/agent.ts`) does search_memory → verify_conflict → queue_action. **search_memory matches on the exact topic key in the same project** (`agent.ts:94–105`, `.eq("topic", topic)`, only `status=active`). The extractor prompt maps stack talk to fixed keys `ledger_database`, `settlement_updates_sync`, `auth_provider` (`extractor.ts:178`), matching the seed (`seed-fintech.ts` meetings #1–#3). The OBJECTION card shows the old quote, speaker, meeting # and meeting date (`meeting:meetings(meeting_date)`).

**Reliability verdict:**
- **Reliable** when the input text is *exactly* a known demo input: `extractor.ts:146–150` serves the pre-recorded cache (`demo-cache.ts`) for the "Play demo clip" transcript and `demo/whatsapp-fintech-demo.txt`. No Gemini wait, no daily cap risk.
- **Not guaranteed** for a real Meet paste: the text won't match the cache byte-for-byte (timestamps, names like "Ankit (demo)"), so it goes to live Gemini. It *should* still work because of the topic-key rules, but the topic key must come out exactly `ledger_database` etc. or no old decision is found. Dry-run it twice before recording.
- Seeded decisions must still be **active** (not superseded by an earlier dry run's "New wins"). If you clicked New wins in rehearsal, re-seed or reset those decisions to `active`.
- The objection compares within the **same project**: paste into "Fintech recon dashboard", not a new project.

**Exact lines Ankit should say in the Meet** (same as `src/lib/demo-clips.ts:11–16`, so the parser output is closest to the cache and Gemini sees the obvious words):
```
Akash: Welcome Ankit, quick sync on the dashboard.
Ankit: Why are we on Postgres? Mongo is faster for dashboards, let's switch.
Ankit: And let's just do polling, webhooks are overkill for an MVP.
Ankit: Clerk for auth is fine by me, maybe with Google login only.
Akash: Decided: Ankit owns the dashboard read-model spec, due Tuesday.
```
Expected: 2 OBJECTIONs (Mongo vs "Postgres for the ledger" #1, 24 Oct, Akash; polling vs "webhooks for settlement updates" #2, 27 Oct), Clerk line = refinement (not red), 1 new task for Ankit.
**Safest trick for the recording:** before pasting, tidy the Meet transcript to exactly those 5 `Name: text` lines (delete the timestamps and header; rename "Ankit (demo)" to "Ankit"). Then it hits the cache and the conflict fires every time. Say so honestly if asked: "I tidy the transcript before pasting."
