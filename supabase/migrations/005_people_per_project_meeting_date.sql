-- Told You So — prod-ready: (a) team members per project, (b) real meeting date.
-- Paste into the Supabase SQL editor AFTER 004. Not applied automatically.
-- Apply BEFORE deploying the prod-ready code (it reads people.project_id and
-- meetings.meeting_date).

-- (a) people.project_id --------------------------------------------------------
alter table people add column if not exists project_id uuid references projects(id) on delete cascade;
-- The app lets you add a member without an email; the original NOT NULL made that insert fail.
alter table people alter column email drop not null;
-- Email was globally unique, so the same person couldn't be on two projects.
alter table people drop constraint if exists people_email_key;
create unique index if not exists people_project_name_uniq on people(project_id, lower(name));
create index if not exists idx_people_project on people(project_id);

-- Backfill: existing members (project_id IS NULL) stay visible in every project
-- as "legacy shared" members until you assign them, e.g.:
--   update people set project_id = '<PROJECT_UUID>' where project_id is null and name in ('Akash','Priya');
-- Or copy every legacy member into every project:
--   insert into people (name, email, project_id)
--   select p.name, p.email, pr.id from people p cross join projects pr where p.project_id is null
--   on conflict do nothing;

-- RLS for the new column: owners can read their project's members.
drop policy if exists "people_auth_r" on people;
create policy "people_owner_r" on people for select to authenticated
  using (project_id is null or owns_project(project_id));

-- (b) meetings.meeting_date ------------------------------------------------------
alter table meetings add column if not exists meeting_date date;

-- Backfill from titles. Handles "… 2026-10-31 …" and "… 31 Oct 2026 …" / "Oct 31, 2026".
update meetings set meeting_date = to_date(substring(title from '(\d{4}-\d{2}-\d{2})'), 'YYYY-MM-DD')
  where meeting_date is null and title ~ '\d{4}-\d{2}-\d{2}';
update meetings set meeting_date = to_date(substring(title from '(\d{1,2} [A-Za-z]{3} \d{4})'), 'DD Mon YYYY')
  where meeting_date is null and title ~ '\d{1,2} [A-Za-z]{3} \d{4}';
update meetings set meeting_date = to_date(substring(title from '([A-Za-z]{3} \d{1,2}, \d{4})'), 'Mon DD, YYYY')
  where meeting_date is null and title ~ '[A-Za-z]{3} \d{1,2}, \d{4}';
-- Anything left: fall back to when it was recorded (IST).
update meetings set meeting_date = (created_at at time zone 'Asia/Kolkata')::date where meeting_date is null;

create index if not exists idx_meetings_date on meetings(project_id, meeting_date);
