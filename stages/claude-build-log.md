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
- (to be filled as built)

## Landing page — parked until backend is done (user request)
Build order: **all backend/core (stages 6–9) first, then the landing page.**
- [ ] One SEO-friendly, Bento-style landing page; uniform-ish palette preferred.
- [ ] Reference motion: Pinterest `https://pin.it/7rDSf2l1Y` — study via Chrome (Pinterest gates content).
- [ ] Color theme image (Meta AI generated) under `stages/UI Inspirations/` — **user to re-share the exact path/image** (an `[Image #4]` was referenced but not attached).
- [ ] Palette source: `stages/UI Inspirations/Told+You+So+App+Flow.tar.gz` — extract and take the color theme (animation itself is not to be copied).
