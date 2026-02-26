-- ============================================================
-- Migration 025: Expanded achievements
-- ============================================================
-- New achievement types:
--   milestone_250, milestone_500, milestone_1000  — upload count milestones
--   first_friend   — first accepted friendship
--   friends_5      — 5+ accepted friends
--   friends_25     — 25+ accepted friends
--   first_collection — created first collection
--   contributor    — did any action on the site
--   og             — operator-granted: founding/OG member
--   staff          — operator-granted: staff / moderator
--   verified       — operator-granted: verified identity

-- ── 1. Expand the type check constraint ──────────────────────────────────────
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
    'milestone_250',
    'milestone_500',
    'milestone_1000',
    'certified_loner',
    'first_friend',
    'friends_5',
    'friends_25',
    'first_collection',
    'contributor',
    'og',
    'staff',
    'verified'
  ));

-- ── 2. Backfill milestone_250 ─────────────────────────────────────────────────
insert into public.covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select
  p.id,
  'milestone_250',
  null,
  jsonb_build_object('cover_count', cnt.n),
  now()
from public.covers_cafe_profiles p
join (
  select user_id, count(*) as n
  from public.covers_cafe_covers
  where is_public = true
  group by user_id
  having count(*) >= 250
) cnt on cnt.user_id = p.id
on conflict do nothing;

-- ── 3. Backfill milestone_500 ─────────────────────────────────────────────────
insert into public.covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select
  p.id,
  'milestone_500',
  null,
  jsonb_build_object('cover_count', cnt.n),
  now()
from public.covers_cafe_profiles p
join (
  select user_id, count(*) as n
  from public.covers_cafe_covers
  where is_public = true
  group by user_id
  having count(*) >= 500
) cnt on cnt.user_id = p.id
on conflict do nothing;

-- ── 4. Backfill milestone_1000 ────────────────────────────────────────────────
insert into public.covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select
  p.id,
  'milestone_1000',
  null,
  jsonb_build_object('cover_count', cnt.n),
  now()
from public.covers_cafe_profiles p
join (
  select user_id, count(*) as n
  from public.covers_cafe_covers
  where is_public = true
  group by user_id
  having count(*) >= 1000
) cnt on cnt.user_id = p.id
on conflict do nothing;

-- ── 5. Backfill first_friend ──────────────────────────────────────────────────
-- Award to anyone who has at least 1 accepted friendship (either direction).
insert into public.covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select distinct
  u.id,
  'first_friend',
  null,
  '{}'::jsonb,
  now()
from auth.users u
where exists (
  select 1 from public.covers_cafe_friends f
  where f.status = 'accepted'
    and (f.user_id = u.id or f.friend_id = u.id)
)
on conflict do nothing;

-- ── 6. Backfill friends_5 ─────────────────────────────────────────────────────
insert into public.covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select
  u.id,
  'friends_5',
  null,
  jsonb_build_object('friend_count', cnt.n),
  now()
from auth.users u
join (
  select uid, count(*) as n
  from (
    select user_id as uid from public.covers_cafe_friends where status = 'accepted'
    union all
    select friend_id as uid from public.covers_cafe_friends where status = 'accepted'
  ) all_friends
  group by uid
  having count(*) >= 5
) cnt on cnt.uid = u.id
on conflict do nothing;

-- ── 7. Backfill friends_25 ────────────────────────────────────────────────────
insert into public.covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select
  u.id,
  'friends_25',
  null,
  jsonb_build_object('friend_count', cnt.n),
  now()
from auth.users u
join (
  select uid, count(*) as n
  from (
    select user_id as uid from public.covers_cafe_friends where status = 'accepted'
    union all
    select friend_id as uid from public.covers_cafe_friends where status = 'accepted'
  ) all_friends
  group by uid
  having count(*) >= 25
) cnt on cnt.uid = u.id
on conflict do nothing;

-- ── 8. Backfill first_collection ─────────────────────────────────────────────
insert into public.covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select distinct
  c.owner_id,
  'first_collection',
  null,
  '{}'::jsonb,
  now()
from public.covers_cafe_collections c
where c.owner_id is not null
on conflict do nothing;

-- ── 9. Backfill contributor ───────────────────────────────────────────────────
-- Award to anyone who has any public cover, any friend, or any collection.
insert into public.covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select distinct
  u.id,
  'contributor',
  null,
  '{}'::jsonb,
  now()
from auth.users u
where
  exists (select 1 from public.covers_cafe_covers cv where cv.user_id = u.id and cv.is_public = true)
  or exists (select 1 from public.covers_cafe_friends f where f.user_id = u.id or f.friend_id = u.id)
  or exists (select 1 from public.covers_cafe_collections col where col.owner_id = u.id)
on conflict do nothing;
