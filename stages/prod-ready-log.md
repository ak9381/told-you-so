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

## Round 2 (1 Nov 2026, 00:00–00:50 IST)
| Commit | Fix |
|---|---|
| 447bc69 | Usage limiter **fails closed** when the usage table can't be read or written. |
| 2f0372e | **Extractor under-capture (8 rules → ~4 saved).** Probable root cause: a null speaker or quote made the whole NOT NULL `decisions` insert fail. Fixes: `normalizeExtraction()` keeps every item (unknown topic → `other`, missing speaker → "Organizer", dedupes exact duplicates only); maxOutputTokens raised to 8192 with a clear truncation message; the prompt now says "capture every distinct rule/decision as its own item, never merge"; commit fills in a missing speaker. Offline 8-rule test added. |
| e78c604 | `npm test` (vitest) runs `tests/**` offline. Tests cover the IST dates, the verification scorer, 8-rule normalize and usage fail-closed. |
| 28c8c45 | **`meetings.meeting_date`** (migration 005, backfilled by parsing titles, else created_at in IST). Written on commit and shown in decision history ("M#3 · Oct 31") and polite cards ("On Oct 31 you decided"). |
| 16d6aa4 | **Team members per project** (`people.project_id`, migration 005). Add, list and assign are scoped to the project; digests, send-now and `/digest/[person]` are scoped to the caller's projects; reminders look people up by project. Digest email is HTML-escaped, and the PostgREST `.or()` filter no longer interpolates names. |
| bea4705 | Removed silent catches. Fetch failures are logged, and the Tasks and Reminders pages show an error. |
| 4a9ee7b | The verification tray lists **every** "possibly missed" item. |
| 5515099 | Per-user **write rate limit** (60/min, 429 + Retry-After) on every authenticated non-GET route. It's in-memory per isolate, so best-effort. |
| 5631fe7 | **Demo-response cache** (stage-9d §4.5): hash-keyed `src/lib/demo-cache.json`, served before the usage cap. Turn it off with `FLAG_DEMO_CACHE=off`. Generator: `scripts/build-demo-cache.ts`. |
| 21d245f | **Structured JSON logging** (`src/lib/log.ts`) across the API routes, server libs and the cron worker. |

Checks: `tsc`, `next lint`, `npm test` (24/24) and `npm run build` all pass.

## Round 3 (1 Nov 2026, 01:06–01:15 IST), from GROKBOT-REVIEW.md
| Item | Fix |
|---|---|
| B4 | The deterministic fallback is conservative. It returns at most a grey "maybe" (confidence ≤0.5) and never a red card, and it doesn't flag neutral same-topic statements. Tested. |
| B2 | **All** decisions are conflict-checked now (it used to stop at 8). Memory is fetched once per topic. Gemini verify calls are budgeted by `AGENT_MAX_AI_VERIFY_CALLS` (default 12); decisions past the budget get the offline check, and the tray tells the user how many. |
| B3 | Commit maps each verdict to its new decision by a stable item index (agent `itemIndex` → position among committed rows), not by `exact_quote`. |
| /api/projects | Already per-user since round 1 (no user → 401). Removed the stale "falls back to all" comment. |
| B5 | Reassigning an owner also PATCHes the Notion `Owner`. Failures are logged to notion_log. |
| B6 | Notion filing is idempotent and retries: before each create (up to 3 attempts with backoff), it looks up an existing page by `Decision ID` (= our action id). |
| B7 | Inline "Remove? Yes / Cancel" before deleting a task. If the delete fails, the row is restored with an error. |
| Purge | `supabase/manual/purge_dry_run_test_data.sql` has a preview plus a commented-out purge transaction. It's **not a migration and has not been run**. The Notion test pages need to be archived by hand. |
| Part 2 | Blended confidence (`src/lib/confidence.ts`, `FLAG_CONFIDENCE_BLEND`): self-consistency over `CONF_SAMPLES` (default 3, max 5, each counted against the cap, stops at the cap), optional embedding cosine (`CONF_USE_EMBEDDINGS`, `GEMINI_EMBED_MODEL`), and a rule signal. Weights, `CONF_THRESHOLD` and `CONF_MAYBE_FLOOR` are configurable; output has three tiers (red, maybe, suppressed); the reasoning shows the signals. **TODO: Platt/isotonic calibration on verdict_logs** (not done). |

**No new migrations in round 3.** Only 004 and 005 must run before deploy.

## Future work (Part 3, not started)
- F1: `activity_log` table + per-project Activity tab.
- F2: per-user Notion OAuth.
- F3: WhatsApp/Slack/Gmail source connectors; Gmail send also fixes B8 (one inbox).
- F4: a real Eval (offline labelled set + live precision from verdict_logs).
- B9: speaker diarization.
- Confidence calibration.
- Storing `decisions.embedding` at commit time so the cosine signal can use pgvector instead of on-the-fly embedding.

## Still open
- **Migrations 004 and 005 are NOT applied.** Until 005 runs, the people and meeting_date code will error against the live DB (missing column). **Apply 004 and then 005 before deploying this branch.**
- **The demo cache is empty** (`{}`) because generating it needs the Gemini key. See manual step 3.
- **The rate limit is per Worker isolate.** For a hard global limit, add a Cloudflare Rate Limiting rule on `/api/*` POST.
- **Legacy rows with `user_id IS NULL`** (projects) and **`project_id IS NULL`** (people) are still visible to every allowlisted user. Backfill them, then tighten `canAccessProject` and the people `project_id.is.null` fallback.
- No live evidence was available for the 8-rule loss. Re-test with the real briefing after deploy; if anything is still missing, it should appear in the verifier's "possibly missed" list.
- Emails still go only to the verified inbox (no sending domain).
- Client-side `console.error` in pages is plain text, not JSON (only server logs are structured).

## Manual steps for Akash
1. **Apply migrations in order** (Supabase → SQL editor): `004_rls_all_tables.sql`, then `005_people_per_project_meeting_date.sql`. After 005, check `select title, meeting_date from meetings;` and fix any wrong dates by hand.
2. **Backfill people.project_id**: existing team members have `project_id = NULL`, so every project sees them. Assign each one: `update people set project_id='<project uuid>' where name in (...);`. Optionally backfill owners too: `update projects set user_id='<your auth uuid>' where user_id is null;`.
3. **Fill the demo cache** (optional, before recording): `GEMINI_API_KEY=… npx tsx --tsconfig tsconfig.json scripts/build-demo-cache.ts`, review `src/lib/demo-cache.json`, then commit it.
4. **Optional**: to turn on the new confidence blend, set `FLAG_CONFIDENCE_BLEND=true` and optionally `CONF_SAMPLES`, `CONF_THRESHOLD`, `CONF_MAYBE_FLOOR`, `CONF_USE_EMBEDDINGS` and `AGENT_MAX_AI_VERIFY_CALLS` (see `.dev.vars.example`). With the blend on and `CONF_SAMPLES=3`, each conflict check uses up to 3 of the 60 daily AI calls (4 if embeddings are on).
4b. **Purge the test data** with `supabase/manual/purge_dry_run_test_data.sql`: run the preview first, then the purge. Delete the Notion "DRY RUN" and "TEST: Priya" pages by hand.
4c. **Set the flags**: `FLAG_VERIFY_EXTRACTION=true` as a Worker var. `FLAG_DEMO_CACHE` is on by default; set it to `off` to disable.
5. **Check env names**: `SUPABASE_SERVICE_ROLE_KEY` and `NOTION_DATABASE_ID` (see `.dev.vars.example`).
6. **Review, merge and deploy**: review `prod-ready`, merge after judging, then deploy with `scripts/deploy.sh`. Afterwards, hit `/api/health`.
7. **Resend**: verify a sending domain and set `RESEND_FROM`.
8. **Smoke test after deploy**: sign in, switch projects, add a team member (it should appear only in that project), paste the 8-rule briefing and check that 8 items appear, confirm, check the decision history shows dates, use Send now, and check `/api/health`.
