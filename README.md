# Told You So — the meeting agent that argues back

Told You So remembers what your team decided — across calls, Google Meet, Zoom and
WhatsApp — and **objects, with the exact quote**, when someone contradicts it later.
Decision logs failed because writing them is a chore; this one writes itself from
your voice and chats, then objects when you drift.

**Live:** https://told-you-so.told-you-so.workers.dev · **Landing:** `/welcome` ·
**Built entirely by voice with Wispr Flow.**

Track 03 (Meeting-to-execution) — Product Space × Wispr Flow Agentic AI Hackathon, 2026.

## The seven must-builds → features

| # | Must-build | Where it lives |
|---|---|---|
| MB1 | Transcript ingestion + speaker attribution | `lib/parser.ts` — Zoom/Meet transcripts, WhatsApp exports (iOS + Android), Slack/Chat `Name: text`, and spoken debriefs. |
| MB2 | Decisions, actions, owners, deadlines | `lib/extractor.ts` — Gemini 3.5 Flash Lite, strict JSON; each item keeps the exact quote, speaker, time; self-corrections struck through; relative dates resolved. |
| MB3 | Conflicts with earlier decisions | `lib/agent.ts` — bounded agent: `search_memory` (same project + topic, newest first) → `verify_conflict` (strict, refinement-aware, with a confidence score) → `queue_action`, with a full **reasoning trail**. Deterministic fallback if Gemini errors. **Live** during a meeting via `/live` + `/api/live-check`. |
| MB4 | Tracker via integration | `lib/trackers.ts` — a `createTask()` adapter (Notion now). Confirmed actions file to the "Told You So Tasks" Notion DB, best-effort, with a visible Notion log; the Ledger (`/ledger`) is the in-app tracker. |
| MB5 | Reminders before deadlines | `lib/reminders.ts` + `/api/reminders` — emails the owner when `now ≥ due − lead`, once (idempotent via the outbox). Per-task lead time. Cloudflare cron `* * * * *`. |
| MB6 | Weekly digest per person | `lib/digest.ts` + `/digest/[person]` + `/api/digest` — owned tasks, what changed, open objections. Cloudflare cron `30 3 * * MON` (Mon 9 AM IST). |
| Proof | MB5/MB6 outbox | `/outbox` — every reminder/digest with scheduled/sent time, status, Resend id; auto-refreshes every 5s. |
| MB7 | Confirmation before posting | The Confirmation Tray on `/` — nothing is saved to the DB or sent to Notion until ticked and confirmed. |

## How the agent works (MB3)

Two stages, not one "find conflicts" prompt:

1. **Extract** (Gemini, JSON): pull out `{decision, exact_quote, topic, owner, date}`. No reasoning.
2. **Verify**: for each new decision, `search_memory` pulls the active decisions on the **same topic in the same project** (newest first; superseded ones ignored); `verify_conflict` does a separate strict check — **contradiction vs refinement** — against *all* of them and returns which one is contradicted, with a 0–1 confidence.

- **Refinement rule:** a narrower/more specific version inside the old decision is a *refinement*, not a contradiction ("by 11 PM" vs "by 11:59 PM"; "Postgres with read replicas" vs "Postgres"). Proven on `/eval`.
- **Confidence (flag):** red OBJECTION! card only at ≥ 0.85; below → a grey "maybe a conflict" chip.
- **Fallback:** on any Gemini error/timeout the agent runs a deterministic path and labels which path ran — so the demo never stalls.
- **Trust:** nothing is saved until you confirm, and every verdict click is logged as a label (`verdict_logs`) for future precision tuning.

## Live meeting mode

`/live` uses **Chrome's built-in Web Speech API** (not Wispr — it doesn't touch the Wispr
word count) to transcribe a call, tags speakers, and checks new lines against memory every
few seconds via `/api/live-check` (a cheap keyword gate runs before any Gemini call). A
**Play demo clip** button replays a scripted meeting through the same path when the mic
fails, and **End Meeting** hands the transcript to the confirmation tray.

## Architecture

Next.js 15 (App Router, TypeScript, Tailwind) on **Cloudflare Workers** via the OpenNext
adapter · **Supabase Postgres** (decisions carry a pgvector `embedding` column as the last
search fallback) · **Gemini 3.5 Flash Lite** · **Notion** · **Resend**. Crons run from a
`custom-worker.ts` `scheduled()` handler. Access is Supabase Auth email+password, limited to
5 allow-listed emails; the session refreshes on every request (`@supabase/ssr`).

**Usage limits:** 60 Gemini calls/user/day and 1 live-check / 15s per user, enforced
server-side; over the cap, a friendly banner shows.

## Run it locally

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in the secrets, then copy to .env.local
cp .dev.vars .env.local
npm run dev                      # http://localhost:3000
# seed the demo memory:
npx tsx src/lib/seed.ts
npx tsx src/lib/seed-fintech.ts  # optional: the fintech demo project
```

Deploy (human-run; the deploy script builds, deploys, and sets Worker secrets):

```bash
bash scripts/deploy.sh
```

## Built by voice

Every line of this was dictated with **Wispr Flow** into Claude Code — no typing. Speaking
the prompts forces you to explain *why*, and the agent builds what you meant. The product is
the same idea turned on the team: just talk, and it remembers what you decided — and tells
you so.
