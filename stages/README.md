# Told You So: spoken build stages
Read each stage aloud with Wispr Flow into Antigravity, in order. Each one points back to plan.md, says what to build and why, lists checks the agent runs itself, and ends with commit and push. Core is done by the 7:00 PM IST freeze.

| Stage | Time (IST) | What |
|---|---|---|
| [1](stage-1.md) | 3:45–4:05 PM | New project, courtroom-ledger look, secrets in .dev.vars |
| [2](stage-2.md) | 4:05–4:30 PM | Supabase login, 5-user allowlist, schema, Gemini usage cap (60/user/day) |
| [3](stage-3.md) | 4:30–5:00 PM | **Dictate with Wispr** box first; messy speech → clean output (fillers, digressions, self-corrections); what you said vs what we understood; paste tab; tray |
| [4](stage-4.md) | 5:00–5:15 PM | First Cloudflare Workers deploy via OpenNext (Vercel if >20 min) |
| [5](stage-5.md) | 5:15–5:40 PM | Seed the real kickoff memory + Client website project, eval page (14 cases incl. 3 messy-speech) |
| [6](stage-6.md) | 5:40–6:15 PM | Agent loop, reasoning trail, OBJECTION! cards, decision timeline |
| [7](stage-7.md) | 6:15–6:40 PM | Live meeting mode on Google Meet, demo clip button (Meet test ~6:30) |
| [8](stage-8.md) | 6:40–7:00 PM | Notion "Told You So Tasks", reminders, outbox, Monday digest, crons → **freeze** |
| — | 7:00–7:30 PM | Dinner + LinkedIn post 2 |
| [9](stage-9.md) | 7:30–10:10 PM | Hardening, README, final deploy by 10:10 |
| [9b](stage-9b.md) | 7:30–9:30 PM (stretch) | **Connect Wispr Notetaker**: OAuth to Wispr MCP, auto-import meetings via cron every 5 min, behind `WISPR_ENABLED` |
| — | 10:30–11:30 PM | Record video, Wispr screenshot, submit |
| [10](stage-10.md) | after submitting | Optional extras |

Latest decisions applied: Gemini 3.5 Flash Lite (free tier 15 RPM / 500 RPD → live check every 15–20 s, 60 calls/user/day); Resend without a domain sends only to the account's own email, so demo mail goes there with the person's name in the subject; crons `* * * * *` and `30 3 * * MON`. plan.md still says "OBJECTION!" in places; the app name is Told You So.
