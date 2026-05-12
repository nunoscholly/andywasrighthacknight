create table briefings (
  id uuid primary key default gen_random_uuid(),
  client_name text,
  submitted_at timestamptz default now(),
  raw_input jsonb,
  status text default 'analyzing',
  tldr text,
  created_at timestamptz default now()
);

create table findings (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid references briefings(id) on delete cascade,
  severity text,
  category text,
  title text,
  what_to_clarify text,
  why_it_matters text,
  priority int,
  created_at timestamptz default now()
);

alter table briefings disable row level security;
alter table findings disable row level security;
