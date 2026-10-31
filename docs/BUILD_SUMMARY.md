# Told You So: what we built, what broke, how we fixed it

Solo build by Akash Kota Raju for the Product Space x Wispr Flow Agentic AI Hackathon (31 Oct 2026), dictated by voice with Wispr Flow into Claude Code. Submitted at 11:59 PM IST.

- Live app: https://told-you-so.told-you-so.workers.dev
- Landing page: https://told-you-so.told-you-so.workers.dev/welcome
- Detailed decision trail: [`stages/claude-build-log.md`](../stages/claude-build-log.md)

## What was built, stage by stage

| Stage | What shipped |
|---|---|
| 1 | Next.js scaffold on Cloudflare Workers through OpenNext |
| 2 | Supabase auth, a 5-user allowlist, the schema, and a Gemini cap of 60 calls per user per day |
| 3 | Wispr debrief box, a split view of the messy speech, the parser, and the confirmation tray |
| 5 | Seeded kickoff memory, the Client website project, and a 14-case eval suite |
| 6 | The conflict agent (search_memory, then verify_conflict, then queue_action), Objection cards, the reasoning trail, saved verdicts and the decision timeline |
| 7 | Live meeting mode: paste a Meet or Zoom link, listen through the browser mic, run live checks, plus a demo clip fallback |
| 8 | Notion task tracker, Resend reminders, an outbox, the Monday digest and cron jobs |
| 9 | Landing page at `/welcome`, a full reskin, per-user projects, Dictate card, team members, owner reassignment, and live Notion status sync |

### After v1 (tagged `v1-working`), each behind a feature flag that defaults to off
1. **Confidence threshold** (`FLAG_CONFIDENCE`): a score of 0.85 or more shows a red card; anything lower shows a grey "maybe a conflict" chip.
2. **Fintech demo project** (`FLAG_FINTECH`): Postgres, webhooks and Clerk decisions, plus a demo WhatsApp file.
3. **Polite "Heads up" cards** (`NEXT_PUBLIC_FLAG_POLITE_CARDS`).
4. **Verdict logging** (`FLAG_LOG_VERDICTS`): every click in the tray is saved as a labelled row, so it can be used for training.
5. **Eval set** grew to 18 cases, including tricky refinements, and passes 100%.

## Issues we hit and how we fixed them

| Issue | Why it hurt | Fix | Commit |
|---|---|---|---|
| `gemini-2.0-flash-lite` was retired and returned 404 | Every extraction failed | Switched to `gemini-3.5-flash-lite` | 54ff113 |
| A silent fallback and a fake "SIMULATED COMMIT SUCCESSFUL" message | Real failures were hidden | Show a red error banner and the real error | 54ff113 |
| Environment variable names didn't match | The service key wasn't found | Unified on `SUPABASE_SERVICE_ROLE_KEY` and added `.env.local` | 54ff113 |
| Cron routes were open | Anyone could trigger emails | Reject requests without `CRON_SECRET` | 54ff113 |
| No per-user data isolation | Users could see each other's data | `002_user_id_rls.sql` adds a user_id column and row-level security, and backfills existing rows | 54ff113 |
| The auth callback was blocked by middleware | Login hung on "ENTERING…" | Added `/api/auth/*` to PUBLIC_ROUTES | 54ff113 |
| Placeholder project IDs (`proj-hackathon`) | Inserts failed with "invalid uuid" | Real project and user UUIDs from `/api/projects` | 4a453e8 |
| Claude Code isn't allowed to deploy to production | Deploys were blocked | Added `scripts/deploy.sh`, which Akash runs himself | 7954916 |
| Sessions expired after 1 hour | Users got logged out mid-demo | `@supabase/ssr` refreshes the session on every request | 3dd8afe |
| Every small change was flagged as a conflict | Too many false alarms | Detect refinement vs reversal, add the confidence threshold and tricky eval cases | 45f1702, 300153c |
| ESLint failed the production build | Deploys broke | Style rules no longer fail the build | 7d9ca13 |
| Switching projects didn't stick | Tasks showed under the wrong project | The selected project is now global, and tasks and reminders are filtered by it | 8199aac |
| The Live mic depended on Wispr | Users without Wispr were blocked | The Dictate card uses the browser's built-in mic | a32dcba |
| No verified email domain | Emails couldn't be sent to anyone | All emails go to the Resend owner inbox, with the person's name in the subject | c1bcfdd |

## Known limitations
- Reminder and digest emails all go to ak9381@nyu.edu until a sending domain is verified.
- Google Calendar is marked "Coming soon".
- Demo AI responses aren't cached yet, so the demo relies on the 60-calls-per-day cap.

## How it was built
- Wispr Flow for voice prompts.
- Claude Code with Claude in Chrome to build and test.
- Antigravity work reviewed by Claude.
- A safety rule throughout: one change at a time, behind a flag, checked with `/eval`, and reverted if anything broke.
