-- Told You So — Migration 006: Performance indexes & activity log
-- Run in Supabase SQL editor AFTER 004 and 005. Not applied automatically.
-- Adds covering indexes for high-frequency filters: project_id, user_id, meeting_date.

-- 1. Indexes on project_id ----------------------------------------------------
-- actions: queried on every ledger load by project_id and filtered by status
create index if not exists idx_actions_project on actions(project_id);
create index if not exists idx_actions_project_status on actions(project_id, status);
create index if not exists idx_actions_project_due on actions(project_id, due_date desc);

-- objections: queried when searching active conflicts and history
create index if not exists idx_objections_project on objections(project_id);

-- decisions: queried for active project decisions during extraction / timeline
create index if not exists idx_decisions_project_status on decisions(project_id, status);

-- meetings: project scoped lookups
create index if not exists idx_meetings_project_id on meetings(project_id);
create index if not exists idx_meetings_project_created on meetings(project_id, created_at desc);

-- 2. Indexes on user_id -------------------------------------------------------
-- projects: user ownership lookup during auth guard and project list
create index if not exists idx_projects_user on projects(user_id);

-- meetings: user ownership check
create index if not exists idx_meetings_user on meetings(user_id);

-- verdict_logs: per-user accuracy/verdict tracking
create index if not exists idx_verdict_logs_user on verdict_logs(user_id);

-- 3. Indexes on meeting_date --------------------------------------------------
-- meetings: timeline and date-range queries
create index if not exists idx_meetings_meeting_date on meetings(meeting_date);
create index if not exists idx_meetings_project_meeting_date on meetings(project_id, meeting_date desc);

-- 4. Unified Activity Log (GROKBOT-REVIEW F1) ---------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  kind text not null,
  summary text,
  data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_project on activity_log(project_id, created_at desc);
create index if not exists idx_activity_user on activity_log(user_id, created_at desc);

alter table activity_log enable row level security;
drop policy if exists "activity_log_owner_rw" on activity_log;
create policy "activity_log_owner_rw" on activity_log for all to authenticated
  using (owns_project(project_id) or user_id = auth.uid())
  with check (owns_project(project_id) or user_id = auth.uid());
