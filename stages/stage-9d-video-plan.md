# Stage 9d (plan): Demo video for Told You So, the senior engineer story
Written 31 Oct 2026, ~7:30 PM IST. Due 11:59 PM IST tonight. Aim to upload by 11:00 PM.

## 1. Verdict on Meta AI's advice
**Keep:** a hook rather than "Hi I'm Akash", one end-to-end story instead of a feature tour, roughly 20 s of architecture naming the model and why, the eval page as proof, recording a clean backup, and the senior engineer story (an architect re-opening settled decisions). This matches what Devpost and judges say (see the guides below).

**Fix:**
| Meta said | Correct |
|---|---|
| Next.js on **Vercel** | Next.js on **Cloudflare Workers via OpenNext**. Live at https://told-you-so.told-you-so.workers.dev |
| "Supabase **pgvector**" as a headline | The `decisions` table has a pgvector `embedding` column (stage 2), but it's only the **last fallback** in search_memory (stage 6). The main lookup is same project + topic key, newest first, then 14 days → 90 days → all time. Say "Supabase Postgres", and mention embeddings only as the fallback. Don't headline pgvector. |
| "Gemini Flash", "10 labelled snippets" | **Gemini 3.5 Flash Lite**. The eval page has **14 cases** (3 contradictions, 2 refinements that must not be flagged, 5 normal, 1 cross-project, 3 messy Wispr speech). Quote the real precision and recall numbers from /eval on the day. |
| Upload to **YouTube Unlisted** | **Google Drive, sharing set to "Anyone with the link: Viewer"** (kickoff rule). Test it in an incognito window before submitting. |
| Record with **OBS** | **Loom** (free up to 5 min, camera off, mic on) or QuickTime (⌘⇧5, choose your mic in Options). Either is fine. OBS works too but needs setup you don't have time for. |
| Make a WhatsApp group with only you and type "Ankit" messages from your own number | Don't. The export would show **your** name as the sender, so it looks faked, and the judges give negative marks for faked usage. Use a **typed demo .txt file in the real WhatsApp export format, clearly labelled DEMO DATA** (see section 5), and say so in the voiceover. |
| Mac text-to-speech played from a phone as "Ankit" | OK only if labelled on screen ("Ankit: demo voice, Mac TTS") and only as a backup. Better: use **Play demo clip** with a fintech meeting-4 script (see section 4), which goes through the same live-check path. |
| "Show filler words greyed out" | The app shows **self-corrections struck through** in the split view (stage 3/plan prompt 6). Say that instead. |
| Click "**New wins**" | For this story, click **Keep old** on both objections. That's the receipt moment. |
| Install mcp-video + opusclip + loom-mcp | Most of these aren't needed, and two need paid keys. See section 2. |

**What winning demo videos do (sources, all opened 31 Oct 2026):**
1. Devpost Help, *Video-making best practices*: https://help.devpost.com/article/84-video-making-best-practices: short elevator pitch first, then the working product, keep within the time limit, clear audio.
2. Devpost blog, *6 tips for making a winning hackathon demo video*: https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video: script it, show the real thing, and don't spend time on slides.
3. Devpost/Amazon Nova, *Level up your build: how to wow the judges*: https://amazon-nova.devpost.com/updates/42214-level-up-your-build-how-to-wow-the-judges: one "golden path" from real input to outcome, and say how you meet the hackathon's required tools (for you, that's Wispr).
4. AngelHack, *10 hackathon demo tips from behind the scenes*: https://angelhack.com/blog/10-tips-to-help-you-rock-your-next-hackathon-demo/: a specific user and their pain first, then the "aha" moment in the first minute, with pre-loaded data so nothing waits on the network.
5. Devpost, *Understanding judging criteria*: https://info.devpost.com/blog/understanding-hackathon-submission-and-judging-criteria: map what you show to the criteria. Here that's Wispr usage (20%), the must-builds, and deployment.

Rule of thumb: **0:15 pain, 0:15 what it is, ~1:30 one story, 0:20 how it works and how you checked it, 0:10 close.** Don't narrate what's on screen; say what they can't see.

## 2. Tool check (verified 31 Oct 2026)
| Tool Meta named | Real? | Correct source | Install | Free? | Verdict |
|---|---|---|---|---|---|
| kinocut / mcp-video | Yes. **Renamed to Kinocut** (by KyaniteLabs) | https://github.com/KyaniteLabs/kinocut · https://pypi.org/project/kinocut/ | `brew install ffmpeg` then `claude mcp add kinocut -- uvx --from kinocut kino --mcp` (Meta's command, `pip install … && mcp-video --mcp`, is wrong) | Free, Apache-2.0, local | Active (v1.16.5, 27 Oct). Optional, and the best MCP if you want one. 20 tools by default. |
| ffmpeg-mcp-lite | Yes | https://github.com/kevinwatt/ffmpeg-mcp-lite · https://pypi.org/project/ffmpeg-mcp-lite/ | `claude mcp add ffmpeg -- uvx ffmpeg-mcp-lite` | Free, MIT | Small one-person project (last release May 2026). Fine, but you don't need it if Claude runs ffmpeg itself. |
| loom-mcp (PyPI) | Exists | https://pypi.org/project/loom-mcp/ (m2ai-mcp-servers) | Needs a `LOOM_ACCESS_TOKEN` from Loom's developer OAuth. The README says public API access "may be limited" | Free code, but you're unlikely to get API access | **Skip.** Low trust, and editing goes through Loom's API. Just **download the MP4 from Loom** (Download button) and edit it locally. |
| ScreenKite | Yes (Mac app with an MCP server) | https://www.screenkite.com | Install the app, then ScreenKite → Install Command Line Tool, then the CLI / MCP button | Free export has a **watermark**. Pro is $79.99 (founder price ends today), then $99.99 | Polished, but a new app plus a watermark or payment. Skip tonight. |
| samuelgursky/davinci-resolve-mcp | Yes | https://github.com/samuelgursky/davinci-resolve-mcp | Needs DaVinci Resolve installed. Free Resolve only works on 21.0.x; 21.1 moved scripting to Studio (paid) | Mixed | **Skip.** Heavy install for a 2:30 cut. |
| elevenlabs/elevenlabs-mcp | Yes, but the **local repo is deprecated** | ElevenLabs hosted MCP: https://api.elevenlabs.io/v1/mcp (OAuth) | Connector, OAuth sign-in | Free 10k credits/month. Voice cloning is paid | **Skip.** No AI voice; you narrate. |
| opus-pro/opus-skills (OpusClip) | Yes, official | https://github.com/opus-pro/opus-skills | `/plugin marketplace add opus-pro/opus-skills` then `/plugin install opusclip@opus-skills` | **Needs an OpusClip Pro/Max/Enterprise API key (paid)**, beta | **Skip** for the submission. It can also post to social, which you don't want. |
| Remotion Superpowers | Yes (DojoCodingLabs) | https://github.com/dojocodinglabs/remotion-superpowers | `/plugin marketplace add DojoCodingLabs/remotion-superpowers` | Plugin is free, but setup **requires KIE and TwelveLabs API keys** and pulls stock or AI footage | **Skip.** Overkill. A title card is one ffmpeg command. |
| cut-video / clipify (Louise de Sadeleer) | Yes | https://github.com/louisedesadeleer/cut-video · https://github.com/louisedesadeleer/clipify | `git clone <repo> ~/.claude/skills/cut-video` (same for clipify), then restart Claude Code | Free, local | **Optional, and useful:** cut-video removes silences and filler words, and clipify makes 9:16 clips with captions. Read SKILL.md before use (it's a small repo). |
| TomGranot/tella-to-youtube | Yes | https://github.com/TomGranot/tella-to-youtube | `/plugin marketplace add TomGranot/tella-to-youtube` | Free, but it's for **Tella → YouTube** | **Not relevant.** You use Loom and Drive. |
| "video-edit skill" | Yes, from calesthio/OpenMontage | https://github.com/calesthio/OpenMontage (`.claude/skills/video-edit/SKILL.md`) | Copy that folder to `~/.claude/skills/video-edit` | Free | Just a list of ffmpeg commands. Claude already knows them. Optional. |
| "agentic-video-editing" / ve-video-edit-general | **No package by that name found.** Closest: poseljacob/agentic-video-editor (an ad-maker that uses Gemini). "Agentic Video Editing" is also a ScreenKite guide page | n/a | n/a | n/a | **Treat as invented.** Skip. |

**Recommended free stack (Claude Code on the Mac, nothing installed by me):**
```bash
brew install ffmpeg whisper-cpp            # ffmpeg for cuts and burning in captions, whisper.cpp for local captions
# model for whisper.cpp (~150 MB, English base):
curl -L -o ~/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
# optional, if you want MCP instead of raw shell:
claude mcp add kinocut -- uvx --from kinocut kino --mcp
# optional skill for removing silences:
git clone https://github.com/louisedesadeleer/cut-video ~/.claude/skills/cut-video
```
Run `brew info whisper-cpp` to check the binary name (`whisper-cli`). Captions: `ffmpeg -i in.mp4 -ar 16000 -ac 1 a.wav && whisper-cli -m ~/ggml-base.en.bin -f a.wav -osrt -of subs`. Burning in captions needs an ffmpeg with libass. Homebrew's ffmpeg has it; if the `subtitles=` filter is missing, use `brew install ffmpeg-full`.
**No AI voice anywhere.** The voice is you, recorded live in Loom.

## 3. Recording setup (one person, honest)
- One Mac, Chrome at full screen at 1920×1080, zoom 110–125% so text is readable, notifications off (Focus mode), and the bookmarks bar hidden.
- Loom: **Screen only**, camera off, mic = MacBook mic or earphones mic. Read the script while Claude (or you) clicks through `demo/run.md`.
- Record in **3 short takes** (hook + Wispr, objection + tray, Notion/outbox + architecture), not one long take. Claude joins them afterwards. If one take goes wrong, redo only that one.
- Loom → Download MP4 → `~/Movies/tys/take1.mp4`, `take2.mp4` and so on. Claude edits locally (section 7).
- Upload the final MP4 to Google Drive → Share → Anyone with the link → Viewer. Check it in an incognito window.
- **The one-person problem, solved honestly:** Meetings 1–3 are you (Wispr debriefs plus one Meet transcript import, already seeded). Ankit's contradiction comes in through (a) a **demo WhatsApp export .txt, labelled DEMO DATA**, and (b) optionally **Play demo clip** on /live with the meeting-4 lines. Say once in the voiceover: *"Ankit is demo data. I built this solo, and the second voice is a scripted clip."* Judges respect that more than bad acting. No second laptop.
- Wispr is the headline input. Show the Wispr Flow bar while you hold Fn, and take the Wispr usage screenshot in the same session.

## 4. Seed data changes (tell Claude, then check against the live app)
Feasibility checks against the stage files. Each one is a real risk:
1. **The current seed is hackathon-themed** (stage 5: "Hackathon submission" + "Client website" projects). The fintech story needs a **new project**. Add it; don't replace the existing projects, because /eval and stage 6/7 tests depend on them.
2. **Play demo clip is hard-coded to the hackathon meeting-2 script** (stage 7, plan §5c). Make it **per project**: the fintech project plays the meeting-4 Ankit clip.
3. **The live-check keyword pre-filter** (plan prompt 10b) skips chunks without words like deadline, team, submit, video, deploy, must, let's, decided, or numbers. *"Why are we on Postgres? Mongo is faster"* has **none of those, so it would be skipped silently.** Add architecture words: postgres, mongo, database, db, polling, webhook, auth, clerk, jwt, switch, use, go with, instead, why are we.
4. **Topic keys must match** between the seeded decisions and Ankit's lines, or search_memory won't find the old decision. Seed fixed keys: `ledger_database`, `settlement_updates_sync`, `auth_provider`, and make sure the extractor maps "Mongo/Postgres" → `ledger_database` and "polling/webhooks" → `settlement_updates_sync`. Add 2 eval cases for this (below).
5. **Pre-cache** the Gemini responses for the meeting-4 clip and the demo .txt (the cached JSON path in plan prompt 8), so recording never waits on Gemini or hits the daily cap.
6. **RLS:** seed the project under the judge user's `user_id` (and Akash's), or it won't show up after migration 002.

Claude prompt (paste as-is):
> Add a seed for a new project "Fintech recon dashboard" (client: Northwind Payments, demo data), safe to run twice, owned by both my user and the judge user, without touching the existing projects. People: Akash (me), Ankit (New architect, demo), Meera (PM, demo). Meetings with exact quotes, times in IST and status active:
> - #1 "Fintech recon #1, Architecture kickoff", 24 Oct 2026 11:00, source Wispr debrief, speaker Akash, 00:42: "We're going with Postgres for the ledger, not Mongo. Money movement needs ACID transactions, we can't risk eventual consistency here." Decision topic_key `ledger_database`, value "Postgres".
> - #2 "Fintech recon #2, Real-time sync", 27 Oct 2026 16:00, source Meet transcript import. Meera 03:10: "Client wants live status, can we just poll every 30 seconds?" Akash 03:25: "No, we'll use webhooks for settlement updates. Polling will kill us at scale." Decision `settlement_updates_sync` = "Webhooks", speaker Akash, quote from 03:25. Action: Akash, "Write webhook retry spec", due 30 Oct, done.
> - #3 "Fintech recon #3, Auth", 29 Oct 2026 12:00, source Wispr debrief, Akash 01:05: "Let's go with Clerk for auth to save time. Custom JWT is a rabbit hole, we need to ship." Decision `auth_provider` = "Clerk".
> Make Play demo clip per project. For this project, play meeting 4 "Fintech recon #4, Ankit joins", 31 Oct, lines: Akash "Welcome Ankit, quick sync on the dashboard." / Ankit "Why are we on Postgres? Mongo is faster for dashboards, let's switch." / Ankit "And let's just do polling, webhooks are overkill for an MVP." / Ankit "Clerk for auth is fine by me, maybe with Google login only." / Akash "Decided: Ankit owns the dashboard read-model spec, due Tuesday." Expected: objections on lines 2 and 3, line 4 is a refinement (grey chip, not flagged), line 5 is a new decision plus an action. Add postgres, mongo, database, polling, webhook, auth, clerk, jwt, switch, instead, go with to the live-check keyword pre-filter. Cache the Gemini responses for this clip and for demo/whatsapp-fintech-demo.txt. Add 2 eval cases: the Mongo line must contradict ledger_database, and "Clerk with Google login only" must be a refinement. Don't change existing labels. Show me the new /eval numbers, then deploy only after I say go.

## 5. Demo WhatsApp export (.txt, labelled demo data)
Parser formats (plan MB1 / prompt 4): iPhone `[31/10/26, 2:05 pm] Name: text` or Android `31/10/26, 14:05 - Name: text`. The sender is the speaker. System lines and "media omitted" are skipped. Save as `demo/whatsapp-fintech-demo.txt` (iPhone format) and import it through the paste/import tab. On screen, name the chat "Northwind recon (DEMO DATA)".
```
[31/10/26, 10:58 am] Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
[31/10/26, 11:02 am] Meera (PM, demo): DEMO DATA. Ankit has joined as architect for the Northwind dashboard 🎉
[31/10/26, 11:05 am] Ankit (Architect, demo): Hi all. Quick thought, why are we on Postgres? Mongo is faster for dashboards, let's switch the ledger to Mongo.
[31/10/26, 11:06 am] Ankit (Architect, demo): Also let's just do polling every 30 sec for settlement status, webhooks are overkill for MVP.
[31/10/26, 11:08 am] Meera (PM, demo): Sounds simpler. Akash?
[31/10/26, 11:10 am] Akash: Let me check what we decided
[31/10/26, 11:12 am] Ankit (Architect, demo): Clerk is fine, let's keep Clerk but only Google login for now.
[31/10/26, 11:13 am] Meera (PM, demo): <Media omitted>
```
Expected: objections on 11:05 (vs 24 Oct, Postgres/ACID) and 11:06 (vs 27 Oct, webhooks). 11:12 is a refinement, not flagged. 11:10 is not a decision. Before recording, test once that the parser accepts names containing brackets and commas; if not, use `Ankit` and `Meera` plain.

## 6. Voiceover script (2:30, read it naturally)
| Time | On screen | You say |
|---|---|---|
| 0:00–0:15 | Black title: "Oct 24: we picked Postgres." Then the WhatsApp line: "Why are we on Postgres? Let's switch to Mongo." | "I'm a senior engineer. Every time someone new joins, we re-argue decisions we already settled. Last week we picked Postgres for a payments ledger. Today, a new architect wants Mongo. And nobody can find where we decided it." |
| 0:15–0:28 | Told You So home, ledger masthead | "So I built Told You So. It's a meeting agent that remembers what your team decided, across calls, WhatsApp and voice notes, and it objects, with the receipt, when someone contradicts it." |
| 0:28–0:58 | Debrief box. Hold Fn, Wispr bar visible. Dictate: "Okay so after the client call, um, Meera owns the, no wait, I own the reconciliation report, by Friday-ish, actually Thursday. And the coffee machine is broken again." Then the split view and the tray. | "The main input is just me talking, through Wispr Flow. I ramble the way I really do after a call. On the left you see my self-corrections struck out. The agent got that I own the report, not Meera, that the deadline is Thursday, not Friday, and it dropped the coffee machine. Nothing is saved until I tick it in the tray." |
| 0:58–1:12 | Timeline of the fintech project: meetings 1–3 with quotes | "This project already has three meetings of memory. Postgres for the ledger on the 24th, webhooks over polling on the 27th, Clerk for auth on the 29th. Each one has the exact quote and the timestamp." |
| 1:12–1:40 | Import the WhatsApp .txt (DEMO DATA visible). Red OBJECTION cards pop. Optional: /live → Play demo clip shows the same thing live. | "Now Ankit joins. Ankit is demo data, I built this solo. He says in WhatsApp: switch to Mongo, and just poll. Told You So objects twice. On the 24th you decided Postgres, 'we can't risk eventual consistency here'. On the 27th, webhooks, 'polling will kill us at scale'. And it does not flag his Clerk message, because Google-login-only is a refinement, not a contradiction." |
| 1:40–2:00 | Confirm tray: Keep old ×2, Confirm. Notion task page, then the outbox with the reminder email, then the agent trace. | "I keep the old decisions. One click. The task lands in Notion, the reminder goes to the outbox, and every step the agent took is in the trace. I don't argue in the meeting. I show the quote and we move on." |
| 2:00–2:20 | Simple diagram: Wispr/WhatsApp/Meet → Next.js on Cloudflare Workers → Gemini 3.5 Flash Lite (extract → search memory → verify conflict) → Supabase Postgres → Notion and Resend. Then the /eval page with the numbers. | "Under the hood: Next.js on Cloudflare Workers, Supabase Postgres, Gemini 3.5 Flash Lite. I picked Flash Lite because it's fast and cheap enough to check a live call every few seconds, and it does structured tool calls. The agent searches same-topic decisions first, then a separate strict step checks contradiction versus refinement. The eval page has fourteen labelled cases, including messy speech, and here's the precision and recall." |
| 2:20–2:30 | Live URL on screen | "It's live at told-you-so dot workers dot dev. Talking is how we think, so that's how it should remember. Thank you." |

About 330 words, roughly 2:25 at a calm pace. If you run long, cut the agent-trace clause first, then the Clerk sentence.

## 7. Claude edit prompts (paste one at a time)
1. "In ~/Movies/tys there are take1.mp4, take2.mp4 and take3.mp4 from Loom. Using ffmpeg only, normalise all of them to 1920×1080, 30 fps, AAC 48 kHz, then join them in order into raw.mp4. Show me the commands first."
2. "Find silences longer than 0.7 s in raw.mp4 (`silencedetect=noise=-35dB:d=0.7`), and give me a cut list that keeps 0.2 s of padding. Don't cut during the Wispr dictation or the objection pop (I'll give you timestamps). Apply it after I say OK → tight.mp4. Tell me the new duration. It must be ≤ 2:55."
3. "Transcribe tight.mp4 locally with whisper.cpp (ggml-base.en) to subs.srt. Fix these words in the SRT: Wispr, Told You So, Gemini 3.5 Flash Lite, Supabase, Clerk, Postgres, Ankit, Meera. Burn the captions in at the bottom, white text with a dark box, font size readable on a laptop → captioned.mp4."
4. "Add a 2-second title card at the start (warm paper background #F4EEDF, serif text 'Told You So: the meeting agent that argues back', the subtitle 'Product Space × Wispr Agentic AI Hackathon' in stamp red), and a 3-second end card with the live URL. Use ffmpeg drawtext or a Pillow-made PNG. Export final.mp4 in H.264, CRF 20, faststart. Check the duration is between 2:00 and 3:00 and report it."
5. (Optional, for LinkedIn post 3, after submitting) "Make a 9:16 1080×1920 reel under 45 s from final.mp4: the hook, the Wispr dictation and the objection pop, with the screen scaled to fit width on a blurred background and the captions kept. → reel.mp4. Don't upload or post anything."
6. Akash uploads final.mp4 to Google Drive himself → Anyone with the link → Viewer → pastes the link in the form.
