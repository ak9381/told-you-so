-- Purge the DRY-RUN test data. MANUAL, NOT a migration — run by hand in the
-- Supabase SQL editor after reviewing the PREVIEW output. Never auto-applied.
-- Notion: the "DRY RUN" test tasks and the "TEST: Priya" page live in Notion,
-- not Postgres — archive them in the Notion UI (… → Delete) separately.

-- 1) PREVIEW — check these rows are really test data.
select id, name, user_id, created_at from projects where name ilike 'DRY RUN%delete me%';
select a.id, a.title, a.owner, a.notion_page_id
  from actions a join projects p on p.id = a.project_id
 where p.name ilike 'DRY RUN%delete me%';
select id, name, email, project_id from people where name ilike 'TEST:%';

-- 2) PURGE (one transaction). Uncomment to run.
-- begin;
--   -- rows that reference the project's actions/decisions without cascade
--   delete from notion_log where action_id in (
--     select a.id from actions a join projects p on p.id = a.project_id where p.name ilike 'DRY RUN%delete me%');
--   delete from outbox where action_id in (
--     select a.id from actions a join projects p on p.id = a.project_id where p.name ilike 'DRY RUN%delete me%');
--   delete from verdict_logs where old_decision_id in (
--     select d.id from decisions d join projects p on p.id = d.project_id where p.name ilike 'DRY RUN%delete me%');
--   -- break self-references so decisions can cascade
--   update decisions set superseded_by = null
--    where superseded_by in (select d.id from decisions d join projects p on p.id = d.project_id where p.name ilike 'DRY RUN%delete me%');
--   -- project delete cascades to meetings, utterances, decisions, actions, objections, agent_trace_steps
--   delete from projects where name ilike 'DRY RUN%delete me%';
--   -- "TEST:" team members (only if not referenced elsewhere)
--   update actions set owner_id = null where owner_id in (select id from people where name ilike 'TEST:%');
--   delete from outbox where person_id in (select id from people where name ilike 'TEST:%');
--   delete from people where name ilike 'TEST:%';
-- commit;
