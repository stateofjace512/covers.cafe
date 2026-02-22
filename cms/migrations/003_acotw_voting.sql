-- Weekly ACOTW polls
create table if not exists covers_cafe_acotw_polls (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,   -- always the Monday of the ISO week
  winner_cover_id uuid references covers_cafe_covers(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

-- The top-10 nominees for each poll (snapshot at poll-creation time)
create table if not exists covers_cafe_acotw_nominees (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references covers_cafe_acotw_polls(id) on delete cascade,
  cover_id uuid not null references covers_cafe_covers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(poll_id, cover_id)
);

-- One vote per user per poll; cover_id must be a nominee
create table if not exists covers_cafe_acotw_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references covers_cafe_acotw_polls(id) on delete cascade,
  cover_id uuid not null references covers_cafe_covers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(poll_id, user_id)   -- one vote per user per week; update cover_id to change vote
);

-- RLS: everyone can read polls and nominees (public feature)
alter table covers_cafe_acotw_polls enable row level security;
alter table covers_cafe_acotw_nominees enable row level security;
alter table covers_cafe_acotw_votes enable row level security;

create policy "acotw_polls_public_read"
  on covers_cafe_acotw_polls for select using (true);

create policy "acotw_nominees_public_read"
  on covers_cafe_acotw_nominees for select using (true);

create policy "acotw_votes_public_read"
  on covers_cafe_acotw_votes for select using (true);

-- Only the owner can insert/update their own vote
create policy "acotw_votes_own_write"
  on covers_cafe_acotw_votes for insert
  with check (user_id = auth.uid());

create policy "acotw_votes_own_update"
  on covers_cafe_acotw_votes for update
  using (user_id = auth.uid());
