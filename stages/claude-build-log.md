# Claude build log — Told You So

A running trail of decisions made while building the app end-to-end (Claude Code + Claude in Chrome). Newest at the bottom of each section.

## Live
- **Deployed URL:** https://told-you-so.told-you-so.workers.dev
- **Local dev:** `npm run dev` → http://localhost:3000 (uses `.env.local`)
- **Login:** `akashkraju218@gmail.com` (in `ALLOWED_EMAILS`); judge alias reserved: `akashkraju218+judge@gmail.com`

## Stages 1–5 — fixes applied (verified live in Chrome)
- **Gemini model**: `gemini-2.0-flash-lite` was retired (404) → switched to `gemini-3.5-flash-lite`.
- **AI errors surfaced**: extractor throws `ExtractionError`; UI shows a red banner instead of silently using the hardcoded fallback (which hid the dead model). `extractWithFallback` reserved for the "Play demo clip" path only.
- **Fake success removed**: commit no longer prints "SIMULATED COMMIT SUCCESSFUL"; shows the real failure.
- **Env**: unified on `SUPABASE_SERVICE_ROLE_KEY`; added `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `ALLOWED_EMAILS`, `CRON_SECRET`, `GEMINI_DAILY_CAP=60`; created git-ignored `.env.local`.
- **Cron auth**: `/api/reminders` + `/api/digest` now reject when `CRON_SECRET` is unset (were open).
- **RLS**: migration `002_user_id_rls.sql` — `user_id` + row-level security on `projects`/`meetings`; backfilled all seeded rows to the owner's UUID.
- **Login callback bug**: `/api/auth/*` was not in `PUBLIC_ROUTES`, so middleware redirected the cookie-setting callback → login hung on "ENTERING…". Fixed.
- **Real UUIDs**: home page loaded placeholder project ids (`proj-hackathon`) → meeting insert rejected (`invalid uuid`). Added `GET /api/projects`; ingest + commit resolve the signed-in user's real UUID (usage cap now per-user; new meetings owned under RLS).
- **Deploy**: `scripts/deploy.sh` (human-run; Claude Code blocks prod deploys in its classifier). First deploy succeeded; all 10 secrets set.

## Design decisions for stages 6–9
- Agent (MB3) is a deterministic orchestration (search_memory → verify_conflict → queue_action) using Gemini for the verify step, with a deterministic fallback — chosen over LLM-driven function-calling for demo reliability. verify_conflict checks the new decision against ALL prior decisions on the topic in one call and returns which is contradicted.
- Live mode: regex gate before any Gemini call; demo clip exempt from the 15s cooldown; conservative prompt so a task's due-time isn't a deadline contradiction.
- Reminders/digest email the Resend account owner (ak9381@nyu.edu) with the person in the subject (no verified domain). Date resolver is exact for "in N minutes".
- Cron via custom-worker.ts (scheduled handler) → self-fetches /api/reminders and /api/digest with CRON_SECRET.

## Post-v1 enhancements (baseline tag: `v1-working`) — each behind a default-off flag
Flags live in `src/lib/flags.ts`; enable by setting the env var to `true` in `.dev.vars`/`.env.local` (and as a Worker secret). Cadence per item: build → /eval → debrief → commit; revert if it regresses.
- **#1 Confidence threshold** (`FLAG_CONFIDENCE`): verify_conflict returns a 0–1 confidence; with the flag on, ≥0.85 → red OBJECTION card (shows "% sure"), below → grey "maybe a conflict" chip. Flag off = identical to v1-working (no confidence field, no maybes). Verified: clear WhatsApp contradictions score 1.0; /eval stays 14/14.
- **#2 Fintech recon project** (`FLAG_FINTECH`): new "Fintech recon dashboard" project seeded (`src/lib/seed-fintech.ts`) with 3 meetings (Postgres/ACID 24 Oct, webhooks>polling 27 Oct, Clerk 29 Oct) using topics `ledger_database`/`settlement_updates_sync`/`auth_provider`; existing projects untouched. Extractor maps Mongo/Postgres→ledger_database, polling/webhooks→settlement_updates_sync, Clerk/JWT→auth_provider. live-check keyword gate gains architecture words. Per-project demo clips on /live (fintech = Ankit meeting-4). `demo/whatsapp-fintech-demo.txt` added. Flag off hides the project from /api/projects (= v1-working). Verified via direct run: Mongo contradicts Postgres, polling contradicts webhooks, "Clerk + Google login only" is a refinement. TODO: pre-cache Gemini responses for the clip/.txt (stage-9d §4.5) — deferred to hardening.
- **#3 Polite cards** (`NEXT_PUBLIC_FLAG_POLITE_CARDS`): with the flag on, objection cards lead with "Heads up" + "On <Mon DD> you decided <topic>, and this now conflicts — here's the receipt:" (date from the decision's meeting). "Told You So" stays the brand/masthead. Flag off = the red "OBJECTION!" card unchanged. Agent now carries the decision date (decidedAt). Verified: decidedAt resolves to Oct 24 for the fintech Postgres decision. Visual pending browser re-login.

## ⚠️ Known issues to harden (stage 9)
- **Session expiry:** the 1-hour Supabase access token lapses and the middleware refresh did not recover it (redirected to /login). Judges/users get logged out after ~1h. Fix the refresh flow (or lengthen the session) before submission.

## Landing page — parked until backend is done (user request)
Build order: **all backend/core (stages 6–9) first, then the landing page.**
- [ ] One SEO-friendly, Bento-style landing page; uniform-ish palette preferred.
- [ ] Reference motion: Pinterest `https://pin.it/7rDSf2l1Y` — study via Chrome (Pinterest gates content).
- [ ] Color theme image (Meta AI generated) under `stages/UI Inspirations/` — **user to re-share the exact path/image** (an `[Image #4]` was referenced but not attached).
- [ ] Palette source: `stages/UI Inspirations/Told+You+So+App+Flow.tar.gz` — extract and take the color theme (animation itself is not to be copied).
