# Told You So — Engineering Review & Fix Spec (for Grokbot)

Context: Next.js 15 (App Router, TS, Tailwind v4) on Cloudflare Workers (OpenNext + wrangler).
Supabase Postgres (+pgvector) & Auth (@supabase/ssr middleware). Gemini 3.5 Flash Lite.
Notion API, Resend, cron via Worker `scheduled()`. Deploy: `bash scripts/deploy.sh`.
**No DDL access from the shell** (no psql/CLI/DATABASE_URL) — all schema changes below must be run
in the Supabase SQL editor and committed as a migration in `supabase/migrations/`.

---

## PART 1 — BUGS & CORRECTNESS ISSUES (fix these)

### B1. Extractor under-captures dense rule-lists  *(highest priority)*
- **Symptom:** ingesting a briefing with many rules (e.g. a hackathon kickoff with ~8 rules) sometimes
  saves only ~4 decisions. "What we understood" can show fewer than were actually said.
- **Root cause:** the extraction prompt in `src/lib/extractor.ts` doesn't force one-decision-per-rule;
  the model merges/collapses items in a dense list. (There is NO unique constraint deduping — verified.)
- **Fix:** add to the extractor prompt (after the "IMPORTANT: capture statements…" bullet):
  > "CAPTURE EVERY DISTINCT RULE/DECISION SEPARATELY: when a speaker lists several rules, requirements,
  > or decisions (e.g. a kickoff briefing), output EACH one as its own decision object — never merge,
  > summarize into one, or skip items in a list. Multiple decisions may share the same topic key (e.g.
  > two different `deadline` decisions, or several `scope` rules); that is expected and correct."
- Consider raising the JSON `maxOutputTokens` and verifying the response isn't truncated.

### B2. `MAX_DECISIONS = 8` silently drops conflict-checking for decisions 9+
- `src/lib/agent.ts:13,232` → `decisions.slice(0, MAX_DECISIONS)`. Any decision past the 8th is **never
  checked for conflicts**. A dense ingest that produces >8 decisions will miss objections on the tail.
- **Fix:** either raise the cap, batch the verify calls (one Gemini call per topic group instead of per
  decision), or at minimum surface a "N more not checked" note. Prefer grouping by topic: one
  `verify_conflict` call per (topic, new-items) pair so cost scales with topics, not decisions.

### B3. Commit maps objection verdicts by `exact_quote` → collides on duplicate quotes
- `src/app/api/commit/route.ts:82-99` builds `quoteToDecisionId[exact_quote] = id`. If two decisions
  share the same `exact_quote`, only one id survives, so an objection verdict can supersede the wrong row.
- **Fix:** key the mapping by array index (carry the decision's index from the client), or by a stable
  temp id assigned at extraction time, not by quote text.

### B4. `deterministicVerify` over-flags when Gemini is down
- `src/lib/agent.ts:143-149`: for any non-time topic it returns `contradicts` at 0.7 confidence with no
  real check. If Gemini is rate-limited/unavailable, every same-topic decision becomes a (false) objection.
- **Fix:** make the fallback conservative — default to `unrelated`/`maybe` unless there's a clear signal
  (e.g. embedding cosine over a threshold, or a keyword antonym match). Never emit a hard red card from
  the deterministic path.

### B5. Notion owner is not synced on reassign
- Status syncs to Notion (`updateNotionTaskStatus`), but reassigning a task's owner only updates Postgres
  (`/api/ledger` POST owner branch). The Notion page keeps the old owner.
- **Fix:** add `updateNotionTaskOwner(pageId, owner)` (PATCH the `Owner` rich_text) and call it on reassign.

### B6. Notion filing is best-effort with no retry
- On failure it logs to `notion_log` and moves on. There's no retry and no UI "retry filing" beyond the
  manual "Send to Notion" button. Consider a small retry (2x backoff) + a cron sweep that retries `failed`
  `notion_log` rows.

### B7. Delete-task has no confirmation
- `/api/ledger` DELETE + the "Remove" button delete immediately. Add a confirm step (inline "Remove? ✓/✕")
  to avoid accidental loss, and consider a soft-delete (`status='deleted'`) instead of a hard delete.

### B8. Reminders only reach one inbox *(limitation → fix with Gmail/domain, see F3)*
- All Resend emails route to `ak9381@nyu.edu` because there's no verified sending domain. Real per-owner
  delivery needs a verified domain OR the Gmail-send integration (F3).

### B9. Live-check speaker tagging is manual; no diarization
- `/` Live Meeting uses Web Speech on one mic; speakers are tagged by hand. Acceptable, but note it.

### Smaller / housekeeping
- `people` table is **global** (no `project_id`) → team members are shared across all projects. Add
  `project_id` (nullable) + scope team lists per project. (Needs migration — see Data model below.)
- `meeting_date` is **not a column** — only embedded in the meeting title. Add `meetings.meeting_date date`
  and store the value the UI already collects (the date field on the cards).
- `/api/projects` GET falls back to "return all projects" if the user can't be resolved — a mild leak;
  tighten to return empty on no-user.
- Test data to purge: the `DRY RUN — delete me` project, its Notion test tasks, and the `TEST: Priya`
  Notion page.
- Google Calendar card is "Coming soon" (not built) — see F4 (Calendar) if you want it real.

---

## PART 2 — CONFIDENCE SCORE (how it works & how to make it rigorous)

### How it works today (`src/lib/agent.ts` `verifyConflict`)
1. For each new decision, `search_memory` finds active same-topic prior decisions.
2. `verify_conflict` asks Gemini (temperature 0, JSON) to return
   `{verdict, match, confidence: 0..1, reasoning}`. `confidence` is **the model's self-reported
   probability** that this is a real contradiction; it's clamped to [0,1] (default 0.9 if missing).
3. If Gemini is unavailable, `deterministicVerify` returns a **hardcoded** 0.7/0.9 (see B4).
4. Gating (`flags.confidence`, `CONFIDENCE_THRESHOLD = 0.85` in `flags.ts`):
   `confidence >= 0.85` → **red objection**; below → grey **"maybe a conflict"**. Flag off → always red.
5. UI shows "X% sure" on the card.

### Why it's weak
- A single temperature-0 self-report is **poorly calibrated** — the number isn't a true probability, and
  it's constant per input. The deterministic fallback numbers are arbitrary.

### How to give a *real* confidence score (recommended design)
Compute a blended score from independent signals, then calibrate it against real outcomes:

1. **Semantic signal (pgvector):** you already store `decisions.embedding vector(768)`. Embed the new
   statement, take cosine similarity to the matched prior decision. High similarity on the same topic +
   an opposing verdict = stronger contradiction signal.
2. **Model signal (self-consistency, not a single call):** sample the `verify_conflict` verdict **N=3–5
   times** (temperature ~0.4) and set `agreement = fraction that said CONTRADICTS`. Self-consistency is
   far better calibrated than one self-reported number. (Cost: N small calls — batch by topic, cache.)
3. **Rule signal:** deterministic checks for the topic class (e.g. for time topics, does the new value
   move *later* vs *tighter*? antonym/negation detection for scope/stack topics).
4. **Blend:** `confidence = w1*agreement + w2*cosine_norm + w3*rule_signal` (start w = 0.6/0.25/0.15).
5. **Calibrate with real data:** log `(confidence, final_user_verdict)` to `verdict_logs` (already exists,
   `003_verdict_logs.sql`). Periodically fit **Platt scaling or isotonic regression** so the displayed %
   matches observed precision (e.g. "cards shown at 85% are confirmed ~85% of the time"). Expose the
   threshold in settings instead of hardcoding 0.85.
6. **UX:** keep the three-tier output — red (≥ hi), grey "maybe" (mid), suppressed (low) — and show the
   reasoning + the two contributing signals on hover so the score is explainable.

---

## PART 3 — NEW FEATURES TO DESIGN

### F1. Logs (activity / audit log)
- **Today:** fragmented — `notion_log`, `outbox`, `verdict_logs`. No unified activity view.
- **Design:** one `activity_log` table:
  `id uuid pk, user_id uuid, project_id uuid, kind text, summary text, data jsonb, created_at timestamptz`.
  `kind` ∈ {`ingested`, `decision_saved`, `objection_raised`, `verdict`, `task_created`, `task_status`,
  `task_reassigned`, `task_removed`, `notion_filed`, `notion_failed`, `reminder_sent`, `project_created`,
  `member_added`}.
- Write one row at each of those events (centralize via a `logActivity()` helper used by the API routes).
- **UI:** a per-project **Activity** tab (timeline, newest first, filterable by `kind`) — reuse the
  reasoning-trail styling. Also fold the existing Notion log + Outbox into this view (or link out).
- Add RLS (scope to `user_id`) like `002_user_id_rls.sql`.

### F2. Notion connection (per-user OAuth) — replaces the single shared integration
- **Today:** one global `NOTION_TOKEN` + `NOTION_DATABASE_ID` (the owner's). A judge can't connect theirs.
- **Design:**
  1. Register a **public Notion OAuth integration** (client_id/secret, redirect URI
     `/api/notion/callback`). Scopes: insert/update content.
  2. New table `notion_connections`: `user_id pk, access_token (encrypted at rest), workspace_name,
     bot_id, database_id, created_at`. Encrypt the token (libsodium / KMS) — never store plaintext.
  3. Flow: "Connect Notion" → `/api/notion/authorize` (redirect to Notion consent) → `/api/notion/callback`
     exchanges the code for a token → let the user **pick or create** a target database → store it.
  4. On create/update, map our fields to the chosen DB's columns (Name/Owner/Due/Status/Project/Source
     quote/Decision ID/Meeting/Objection link). Handle missing columns gracefully (create or skip).
  5. `createTask` / `updateNotionTaskStatus` / `updateNotionTaskOwner` use the **current user's** token +
     database, falling back to the shared demo integration if not connected.
  6. UI: a real "Connect Notion" state (Not connected → Connect → Connected to <workspace/db> → Disconnect).
- **Safety note:** until this ships, do NOT add a fake "Connect" button; the "Open in Notion" link is safe
  (Notion enforces per-page access — nobody reaches the owner's account).

### F3. WhatsApp / Slack / Gmail integration
Design one **source-connector interface**: `fetchMessages() -> normalized transcript -> existing ingest`.
- **WhatsApp:** no clean API for personal chats. Two honest options: (a) keep **export → upload .txt**
  (already works; add a dedicated WhatsApp parser that strips the `[date, time] Name:` prefixes and merges
  multi-line messages), or (b) **WhatsApp Business Cloud API** (Meta) with a webhook to receive messages
  for a business number. Document that (a) is the realistic path for group decisions.
- **Slack:** build a **Slack app** (OAuth, scopes `channels:history`, `groups:history`). Either
  (a) a `/toldyouso` **slash command** that ingests the last N messages of the channel, or
  (b) **Events API** webhook that streams new messages into a channel-linked project. Store the Slack
  token per workspace in a `slack_connections` table. Map channel → project.
- **Gmail:** **Gmail API** (OAuth, `gmail.readonly` to ingest meeting-note threads, and/or `gmail.send`).
  `gmail.send` is the clean fix for **B8** — send reminders **from the user's own Gmail** to the real
  owners, removing the "everything goes to one inbox" demo limitation. Store tokens in `google_connections`.
- Reuse a shared `oauth_connections` pattern (provider, user_id, encrypted tokens, scopes, expiry + refresh).

### F4. Bring back Eval — but a *real* one (two modes)
The old eval was deleted because it was a deterministic keyword-match that always scored 100% — useless.
Replace with:
- **Mode A — offline regression (real agent):** a fixed labeled set (`EVAL_CASES`) but run through the
  **actual** extraction + `runAgent` pipeline (live Gemini) against seeded project memory → compute true
  **precision** (of flagged, how many were real) and **recall** (of real conflicts, how many caught).
  Run on-demand from a `/eval` page (and optionally in CI). Store each run's results + timestamp. Exempt
  from the per-user rate limit; cache the last run so the demo doesn't re-spend Gemini. Label it honestly:
  "offline test set — N cases, real agent, last run <ts>".
- **Mode B — live accuracy (from real usage):** compute **precision from `verdict_logs`** — of the
  objections the agent raised on real meetings, what fraction the user confirmed (overrule/pivot) vs
  dismissed (keep_old / not-a-conflict). This scales with real data and is the honest "it actually works"
  number. Recall on real data needs labeled misses — add a "we missed a conflict" report action to collect
  them, or leave recall to Mode A.
- **UI:** `/eval` (rename "Accuracy") shows both: the offline benchmark (real numbers, not mocked) and the
  live precision from verdicts, each clearly labeled.

---

## DATA MODEL CHANGES (run in Supabase SQL editor, then add as a migration)
```sql
-- meeting date (collected by the UI, currently only in the title)
alter table meetings add column if not exists meeting_date date;

-- per-project team members
alter table people add column if not exists project_id uuid references projects(id) on delete cascade;

-- unified activity log (F1)
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  project_id uuid references projects(id) on delete cascade,
  kind text not null,
  summary text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_project on activity_log(project_id, created_at desc);

-- oauth connections (F2/F3) — store tokens ENCRYPTED, never plaintext
create table if not exists oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,          -- 'notion' | 'slack' | 'google'
  access_token text not null,      -- encrypted
  refresh_token text,              -- encrypted
  scopes text,
  external_id text,                -- workspace/bot/database id
  metadata jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider, external_id)
);
```
Add RLS policies scoping each new table to `user_id`, matching `002_user_id_rls.sql`.

---

## SUGGESTED PRIORITY ORDER
1. B1 (extractor under-capture) + B2 (MAX_DECISIONS) — core correctness of the main feature.
2. B4 (fallback over-flagging) + Part 2 (real confidence score).
3. F1 (logs) — cheap, high value, de-risks everything else.
4. B3, B5, B6, B7 — commit/Notion correctness.
5. F4 (real eval) — credibility.
6. F2 (Notion OAuth) + F3 (Gmail send first — fixes B8 — then Slack, then WhatsApp parser).
7. Data-model migrations as each feature needs them; purge test data.
