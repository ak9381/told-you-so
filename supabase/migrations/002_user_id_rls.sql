-- Told You So — add owner user_id + row-level security to projects and meetings
-- (Stage 2 review follow-up). Paste into the Supabase SQL editor.
--
-- NOTE: the app writes with the service-role key, which BYPASSES RLS, so the
-- existing server routes keep working. These policies protect the data if it is
-- ever read with the anon/authenticated key from the browser. Backfill user_id
-- for the seeded rows once the owner's auth user exists (see bottom).

-- 1. Owner column (nullable so existing seeded rows remain valid) ------------
alter table projects add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table meetings add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_projects_user on projects(user_id);
create index if not exists idx_meetings_user on meetings(user_id);

-- 2. Enable RLS --------------------------------------------------------------
alter table projects enable row level security;
alter table meetings enable row level security;

-- 3. Policies: a signed-in user sees and writes only their own rows ----------
--    (service_role bypasses RLS entirely, so cron jobs/seed are unaffected.)
drop policy if exists "projects_owner_rw" on projects;
create policy "projects_owner_rw" on projects
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "meetings_owner_rw" on meetings;
create policy "meetings_owner_rw" on meetings
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4. Backfill (run after the owner's auth user exists) -----------------------
--    update projects set user_id = '<AUTH_USER_UUID>' where user_id is null;
--    update meetings set user_id = '<AUTH_USER_UUID>' where user_id is null;
