-- ============================================================
-- Migration 020: Friends system + expanded achievements
-- ============================================================

-- ── Friends table ─────────────────────────────────────────────────────────────
create table if not exists public.covers_cafe_friends (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  friend_id   uuid        not null references auth.users(id) on delete cascade,
  status      text        not null default 'pending'
    check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, friend_id)
);

alter table public.covers_cafe_friends enable row level security;

-- Users can read their own friend rows (both directions)
create policy "friends_read_own"
  on public.covers_cafe_friends for select
  using (user_id = auth.uid() or friend_id = auth.uid());

-- Users can insert a friend request (only as sender)
create policy "friends_insert_own"
  on public.covers_cafe_friends for insert
  with check (user_id = auth.uid());

-- Users can update rows where they are the recipient (to accept) or the sender (to cancel)
create policy "friends_update_own"
  on public.covers_cafe_friends for update
  using (user_id = auth.uid() or friend_id = auth.uid());

-- Users can delete their own friendship rows
create policy "friends_delete_own"
  on public.covers_cafe_friends for delete
  using (user_id = auth.uid() or friend_id = auth.uid());

-- ── Expand achievements type constraint ───────────────────────────────────────
-- Drop the old constraint and recreate with new types
alter table public.covers_cafe_achievements
  drop constraint if exists covers_cafe_achievements_type_check;

alter table public.covers_cafe_achievements
  add constraint covers_cafe_achievements_type_check
  check (type in (
    'acotw',
    'poh',
    'milestone_1',
    'milestone_50',
    'milestone_100',
    'certified_loner'
  ));

-- ── Backfill: milestone_1 — users with at least 1 public cover ────────────────
insert into public.covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select
  p.id,
  'milestone_1',
  null,
  jsonb_build_object('cover_count', cnt.n),
  now()
from public.covers_cafe_profiles p
join (
  select user_id, count(*) as n
  from public.covers_cafe_covers
  where is_public = true
  group by user_id
  having count(*) >= 1
) cnt on cnt.user_id = p.id
on conflict (user_id, type, reference_id) do nothing;

-- ── Backfill: milestone_50 — users with at least 50 public covers ─────────────
insert into public.covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select
  p.id,
  'milestone_50',
  null,
  jsonb_build_object('cover_count', cnt.n),
  now()
from public.covers_cafe_profiles p
join (
  select user_id, count(*) as n
  from public.covers_cafe_covers
  where is_public = true
  group by user_id
  having count(*) >= 50
) cnt on cnt.user_id = p.id
on conflict (user_id, type, reference_id) do nothing;

-- ── Backfill: milestone_100 — users with at least 100 public covers ───────────
insert into public.covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select
  p.id,
  'milestone_100',
  null,
  jsonb_build_object('cover_count', cnt.n),
  now()
from public.covers_cafe_profiles p
join (
  select user_id, count(*) as n
  from public.covers_cafe_covers
  where is_public = true
  group by user_id
  having count(*) >= 100
) cnt on cnt.user_id = p.id
on conflict (user_id, type, reference_id) do nothing;
