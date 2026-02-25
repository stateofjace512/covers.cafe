-- ============================================================
-- Migration 021: Fix achievement deduplication + fresh backfill
-- ============================================================

-- ── Partial unique index for NULL reference_id ────────────────────────────────
-- The existing UNIQUE(user_id, type, reference_id) constraint does NOT prevent
-- duplicates when reference_id IS NULL (NULLs are not considered equal in SQL).
-- This partial index enforces uniqueness when reference_id is absent.
create unique index if not exists covers_cafe_achievements_user_type_null_ref_idx
  on public.covers_cafe_achievements(user_id, type)
  where reference_id is null;

-- ── Clean up any duplicate certified_loner achievements ──────────────────────
-- Keep only the earliest row per user; remove extras.
delete from public.covers_cafe_achievements
where type = 'certified_loner'
  and id not in (
    select id from (
      select distinct on (user_id) id
      from public.covers_cafe_achievements
      where type = 'certified_loner'
      order by user_id, awarded_at asc
    ) earliest
  );

-- ── Full reset + backfill of all milestone achievements ──────────────────────
-- Remove all existing milestone records (they will be re-inserted fresh).
delete from public.covers_cafe_achievements
where type in ('milestone_1', 'milestone_50', 'milestone_100');

-- Backfill milestone_1: at least 1 public cover
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
) cnt on cnt.user_id = p.id;

-- Backfill milestone_50: at least 50 public covers
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
) cnt on cnt.user_id = p.id;

-- Backfill milestone_100: at least 100 public covers
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
) cnt on cnt.user_id = p.id;
