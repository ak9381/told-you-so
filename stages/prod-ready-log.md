# Prod-ready pass — log (branch `prod-ready`, 1 Nov 2026, 00:31–00:45 IST)

`main` and tag `submitted-2026-10-31` were not touched. Nothing was deployed and no migration was applied.
Checks: `npx tsc --noEmit` passes, `next lint` is clean, and `npm run build` passes (built with dummy env values).
Not run: the tests in `tests/__tests__` (the repo has no test runner installed) and any live Supabase, Gemini, Notion or Resend calls (none are reachable from the build box).

## Issues found → status

| # | Sev | File(s) | Issue | Status |
|---|-----|---------|-------|--------|
| 1 | High | api/ingest, commit, timeline, ledger, outbox, live-check, send-now | Any signed-in user could read or modify any project's data by passing its `projectId` or `actionId`. There was no ownership check. | **Fixed**: `canAccessProject` / `canAccessAction` in `src/lib/api-guard.ts` |
| 2 | High | api/ledger GET, api/outbox GET | With no `projectId`, these returned every user's tasks and emails. | **Fixed**: scoped to the caller's projects |
| 3 | High | all API routes | Auth was enforced only by middleware, and unauthenticated API calls got an HTML redirect instead of JSON. | **Fixed**: `requireUser()` checks login + allowlist in each route; middleware returns 401/403 JSON for `/api/*` |
| 4 | High | supabase/migrations | RLS covered only projects and meetings. utterances, decisions, actions, objections, agent_trace_steps, outbox, notion_log, usage, verdict_logs and people had none. | **Fixed**: `004_rls_all_tables.sql` (**not applied**) |
| 5 | High | api/commit | Objection verdict updates changed decisions by id with no project filter. | **Fixed**: added `.eq("project_id", …)` |
| 6 | Med | api/* | No body-size limits or type validation. Raw `request.json()` threw a 500 on bad JSON. | **Fixed**: `readJson()` caps the body (1–2 MB), ingest text is capped at 200k characters, plus id/enum/email validation |
| 7 | Med | api/live-check | The demo clip bypassed the daily AI cap entirely. `JSON.parse` of Gemini output could throw. | **Fixed**: the demo clip skips only the 15s spacing; parsing is safe |
| 8 | Med | lib/agent.ts | `verify_conflict` Gemini calls didn't count toward the 60/day cap. | **Fixed**: each call counts; over the cap it falls back to the deterministic check |
| 9 | Med | lib/dates.ts | "11:59 PM", "tonight" and weekdays were resolved in UTC, so due dates and reminders landed 5h30m late for IST users. | **Fixed**: math runs in IST (verified with a script) |
| 10 | Med | lib/agent, extractor, trackers, email, live-check | No timeouts or retries on outside calls, so a hung Gemini call could stall a request. | **Fixed**: `fetchWithRetry` (timeout + 1 retry for Gemini and Notion updates; timeout only, no retry, for Resend and Notion create, to avoid duplicates) |
| 11 | Med | api/reminders, api/digest, custom-worker.ts | Cron errors became unhandled rejections, and failures weren't logged. | **Fixed** |
| 12 | Med | api/commit, people, log-verdict, outbox | Insert/update errors were silently ignored. | **Fixed**: errors are logged, with friendly messages |
| 13 | Low | api/auth/callback | Read `SUPABASE_ANON_KEY` only, so login failed if only the `NEXT_PUBLIC_` names were set. | **Fixed**: falls back to the `NEXT_PUBLIC_` names |
| 14 | Low | .dev.vars.example | Wrong env names (`SUPABASE_SERVICE_KEY`, `NOTION_DB_ID`); flags were missing. | **Fixed** |
| 15 | Low | — | No health check. | **Fixed**: public `GET /api/health` (shows only true/false for whether each integration is configured, never a value) |
| 16 | Low | AppShell | Lint error (`<a>` used for an internal link). On mobile, the fixed 240px sidebar squeezed the content. | **Fixed**: `next/link`; the sidebar stacks on screens narrower than the `md` breakpoint |
| 17 | Low | page.tsx | Inputs had no labels. Errors weren't announced to screen readers. A failed project load was silently swallowed. | **Fixed** |
| 18 | Info | middleware/auth | Open-redirect check: login redirects only to the fixed `/` path, and the callback returns JSON. | OK, no change needed |
| 19 | Info | lib/supabase.ts | The service-role key is read only in server code (no `NEXT_PUBLIC_` name). | OK |

## New feature: extraction verification (#5, flag `FLAG_VERIFY_EXTRACTION`)
After extraction, a second Gemini call (same model, counted toward the per-user daily cap) checks each extracted decision and action against the source text. It asks whether the quote is present and whether the speaker, owner and due date are faithful, and it lists items that were missed. It returns a 0–1 confidence and a reason per item, plus an overall score, as strict JSON. A literal substring check also caps confidence at 0.4 when the quote is absent.
In the tray, each item shows a chip such as "92% matches transcript". Items below 70% are highlighted red with the reason, and an overall line sits at the top of the list.
The call has a 12s timeout and 1 retry. If it fails or the daily limit is hit, items show "not verified" and confirming is never blocked. The verification runs in parallel with the conflict agent.
The flag is on in `.dev.vars.example`. **For prod, set `FLAG_VERIFY_EXTRACTION=true` as a Worker var.** Files: `src/lib/verifier.ts`, `api/ingest`, `page.tsx`.

## Still open
- **Usage limiter fails open** when the Supabase usage query errors (`lib/usage.ts`). It should probably fail closed in prod.
- **`people` is a shared directory** with no owner column, so all 5 allowlisted users see the same team list. `/digest/[person]` and `send-now` "digest-all" also work across users. A schema change is needed if real multi-tenancy is ever wanted.
- **Legacy seeded rows with `user_id IS NULL`** are still treated as accessible by the API so the demo isn't broken. Backfill them (see below) and then tighten `canAccessProject`.
- **No rate limit on non-AI routes** (only Gemini paths are capped). Consider Cloudflare rate-limiting rules.
- **The ledger and outbox pages still have some silent `.catch(() => {})` calls** on background refreshes.
- **Unit tests can't run**: `tests/__tests__` has no runner (no jest/vitest in devDependencies).
- **Demo-response caching** (stage-9d §4.5) and structured logging were not done.
- **Emails still all go to the verified inbox** (no verified sending domain).

## Manual steps for Akash
1. **Apply the migration**: in Supabase → SQL editor, run `supabase/migrations/004_rls_all_tables.sql`. Optionally backfill the owner first: `update projects set user_id='<your auth uuid>' where user_id is null;` (same for `meetings`).
2. **Set the flag**: add `FLAG_VERIFY_EXTRACTION=true` to the Worker vars/secrets (and to `.dev.vars` locally).
3. **Check env names**: `SUPABASE_SERVICE_ROLE_KEY` and `NOTION_DATABASE_ID` (see `.dev.vars.example`).
4. **Review, merge and deploy**: review the `prod-ready` branch, merge after judging, then deploy with `scripts/deploy.sh`. Afterwards, hit `/api/health` and run one test ingest to see the verification chips.
5. **Resend**: verify a sending domain and set `RESEND_FROM` so reminders go to real recipients.
6. **Smoke test after deploy**: sign in, switch projects, ingest text, confirm, check that tasks reach Notion, use Send now, and check `/api/health`.
