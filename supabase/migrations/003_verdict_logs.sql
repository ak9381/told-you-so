-- #4: log every tray verdict click (Keep old / overrule / pivot / flag) as a
-- labelled example for future precision tuning. Logging only — no training yet.
create table if not exists verdict_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  old_decision_id uuid,
  new_quote text,
  topic text,
  verdict text not null,
  confidence float,
  created_at timestamptz not null default now()
);

create index if not exists idx_verdict_logs_created on verdict_logs(created_at desc);
