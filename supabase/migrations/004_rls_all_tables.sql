-- Told You So — prod-ready: row-level security on EVERY table.
-- Paste into the Supabase SQL editor (NOT applied automatically).
--
-- The app's server routes use the service-role key, which bypasses RLS, so this
-- does not change app behaviour. It closes the anon/authenticated key path: a
-- signed-in browser can only reach rows in projects it owns; everything else
-- is server-only. Safe to re-run.

-- helper: does the current auth user own this project? -----------------------
create or replace function public.owns_project(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.user_id = auth.uid());
$$;
revoke all on function public.owns_project(uuid) from public;
grant execute on function public.owns_project(uuid) to authenticated;

-- enable RLS everywhere --------------------------------------------------------
alter table people            enable row level security;
alter table projects          enable row level security;
alter table meetings          enable row level security;
alter table utterances        enable row level security;
alter table decisions         enable row level security;
alter table actions           enable row level security;
alter table objections        enable row level security;
alter table agent_trace_steps enable row level security;
alter table outbox            enable row level security;
alter table notion_log        enable row level security;
alter table usage             enable row level security;
alter table verdict_logs      enable row level security;

-- project-scoped tables ----------------------------------------------------------
drop policy if exists "decisions_owner_rw" on decisions;
create policy "decisions_owner_rw" on decisions for all to authenticated
  using (owns_project(project_id)) with check (owns_project(project_id));

drop policy if exists "actions_owner_rw" on actions;
create policy "actions_owner_rw" on actions for all to authenticated
  using (owns_project(project_id)) with check (owns_project(project_id));

drop policy if exists "objections_owner_rw" on objections;
create policy "objections_owner_rw" on objections for all to authenticated
  using (owns_project(project_id)) with check (owns_project(project_id));

-- meeting-scoped tables ----------------------------------------------------------
drop policy if exists "utterances_owner_r" on utterances;
create policy "utterances_owner_r" on utterances for select to authenticated
  using (exists (select 1 from meetings m where m.id = meeting_id and owns_project(m.project_id)));

drop policy if exists "trace_owner_r" on agent_trace_steps;
create policy "trace_owner_r" on agent_trace_steps for select to authenticated
  using (exists (select 1 from meetings m where m.id = meeting_id and owns_project(m.project_id)));

-- action-scoped tables (read-only to the owner) --------------------------------
drop policy if exists "outbox_owner_r" on outbox;
create policy "outbox_owner_r" on outbox for select to authenticated
  using (exists (select 1 from actions a where a.id = action_id and owns_project(a.project_id)));

drop policy if exists "notion_log_owner_r" on notion_log;
create policy "notion_log_owner_r" on notion_log for select to authenticated
  using (exists (select 1 from actions a where a.id = action_id and owns_project(a.project_id)));

-- per-user tables -----------------------------------------------------------------
drop policy if exists "usage_self_r" on usage;
create policy "usage_self_r" on usage for select to authenticated using (user_id = auth.uid());

drop policy if exists "verdict_logs_self_r" on verdict_logs;
create policy "verdict_logs_self_r" on verdict_logs for select to authenticated using (user_id = auth.uid());

-- people: shared team directory, read-only for signed-in users; writes server-side.
drop policy if exists "people_auth_r" on people;
create policy "people_auth_r" on people for select to authenticated using (true);

-- verdict_logs: index for per-user lookups
create index if not exists idx_verdict_logs_user on verdict_logs(user_id);
