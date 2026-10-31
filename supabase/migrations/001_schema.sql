-- Told You So — Full schema migration
-- Paste this into the Supabase SQL editor to create all tables.
-- Requires pgvector extension (enable in Supabase dashboard first).

create extension if not exists vector with schema public;

-- ============================================================
-- People (team members with emails for reminders/digest)
-- ============================================================
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Projects (workstreams that scope all decisions)
-- ============================================================
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tracker text not null default 'notion', -- 'notion' | 'github'
  created_at timestamptz not null default now()
);

-- ============================================================
-- Meetings (belong to a project, numbered per-project)
-- ============================================================
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  seq int not null, -- per-project number (1, 2, 3…)
  title text not null,
  source_type text not null default 'transcript', -- 'transcript' | 'whatsapp' | 'debrief' | 'live'
  raw_text text,
  created_at timestamptz not null default now(),
  unique (project_id, seq)
);

-- ============================================================
-- Utterances (individual lines from a meeting)
-- ============================================================
create table if not exists utterances (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  speaker text not null,
  said_at text, -- timestamp within the meeting (mm:ss or datetime string)
  content text not null,
  seq int not null, -- order within the meeting
  created_at timestamptz not null default now()
);

-- ============================================================
-- Decisions (extracted from meetings, scoped to project)
-- ============================================================
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  meeting_id uuid not null references meetings(id) on delete cascade,
  meeting_seq int not null,
  topic text not null, -- topic key for conflict search
  exact_quote text not null,
  speaker text not null,
  said_at text, -- timestamp within the meeting
  status text not null default 'active', -- 'active' | 'superseded' | 'overruled'
  superseded_by uuid references decisions(id),
  embedding vector(768), -- for semantic search fallback
  created_at timestamptz not null default now()
);

create index if not exists idx_decisions_project on decisions(project_id);
create index if not exists idx_decisions_topic on decisions(project_id, topic);

-- ============================================================
-- Actions (tasks extracted from decisions)
-- ============================================================
create table if not exists actions (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid references decisions(id) on delete set null,
  project_id uuid not null references projects(id) on delete cascade,
  meeting_id uuid not null references meetings(id) on delete cascade,
  title text not null,
  owner text, -- person name
  owner_id uuid references people(id),
  due_date timestamptz,
  status text not null default 'open', -- 'open' | 'done' | 'blocked'
  source_quote text,
  reminder_lead_min int not null default 1440, -- 24h default; 2 for demo
  notion_page_id text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Objections (conflicts found by the agent)
-- ============================================================
create table if not exists objections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  old_decision_id uuid not null references decisions(id) on delete cascade,
  new_decision_id uuid not null references decisions(id) on delete cascade,
  old_quote text not null,
  new_quote text not null,
  old_speaker text,
  new_speaker text,
  old_meeting_ref text, -- e.g. "Meeting 1, 30:41"
  new_meeting_ref text,
  verdict text, -- 'overrule' | 'pivot' | 'keep_old' | 'flag' | null (pending)
  verdict_reason text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Agent trace steps (reasoning trail)
-- ============================================================
create table if not exists agent_trace_steps (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  step_number int not null,
  tool_name text not null, -- 'search_memory' | 'verify_conflict' | 'ask_clarifying_question' | 'queue_action'
  input jsonb,
  output jsonb,
  reasoning text,
  duration_ms int,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Outbox (reminders and digests — idempotent sends)
-- ============================================================
create table if not exists outbox (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- 'reminder' | 'digest'
  person_id uuid references people(id),
  person_name text,
  person_email text,
  action_id uuid references actions(id) on delete set null,
  subject text,
  body text,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  channel text not null default 'email',
  status text not null default 'SCHEDULED', -- 'SCHEDULED' | 'SENT' | 'FAILED'
  error text,
  resend_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_outbox_status on outbox(status);

-- ============================================================
-- Notion log (best-effort single-DB append)
-- ============================================================
create table if not exists notion_log (
  id uuid primary key default gen_random_uuid(),
  action_id uuid references actions(id) on delete set null,
  notion_page_id text,
  status text not null default 'pending', -- 'pending' | 'filed' | 'failed'
  error text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Usage table (per-user Gemini rate limiting)
-- ============================================================
create table if not exists usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, -- Supabase Auth user id
  day date not null default (current_date at time zone 'Asia/Kolkata'),
  gemini_calls int not null default 0,
  last_live_check_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

-- ============================================================
-- Vector similarity search function for decisions
-- ============================================================
create or replace function match_decisions(
  query_embedding vector(768),
  match_project_id uuid,
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  topic text,
  exact_quote text,
  speaker text,
  said_at text,
  meeting_seq int,
  status text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.topic,
    d.exact_quote,
    d.speaker,
    d.said_at,
    d.meeting_seq,
    d.status,
    1 - (d.embedding <=> query_embedding) as similarity
  from decisions d
  where d.project_id = match_project_id
    and d.status = 'active'
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;

