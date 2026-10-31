# Antigravity brief (branch prod-ready, already live)
Rules: work only on branch prod-ready. Never touch main or tag submitted-2026-10-31. Do NOT deploy or set secrets (Akash runs scripts/deploy.sh himself with Node 22). Do NOT run SQL; write migration files only. One fix per commit; after each, `npm test`, `npx tsc --noEmit`, `npx next lint`, `npm run build` must pass, otherwise revert. Push to origin prod-ready. Log everything in stages/prod-ready-log.md under "Round 4 (Antigravity)".
Speed (site feels slow, TTFB ~1s and pages fill in slowly):
1. Middleware: avoid a Supabase network round-trip on every request (use local JWT verification such as getClaims/getSession for routing; refresh only near expiry). API routes must still authorize properly.
2. Remove fetch waterfalls on home/tasks/ledger (Promise.all or one combined endpoint); cache the per-request user lookup.
3. Skeleton loading UI; make /welcome and /login static.
4. Select only the needed columns; write migration 006 with indexes on project_id, user_id and meeting_date.
Then do the open items in stages/prod-ready-log.md and GROKBOT-REVIEW.md that are safe and small. Finish with a summary of commits, impact, and the migrations to apply.
