-- ============================================================
-- Migration 006: Pin of Heuristics (POH) + Achievements
-- ============================================================

-- ── Pin of Heuristics: inducted comment starboard ────────────────────────────
create table if not exists covers_cafe_poh_pins (
  id                  uuid        primary key default gen_random_uuid(),
  -- link to the original comment (nullable — comment may be deleted but pin survives)
  comment_id          uuid        references comments(id) on delete set null,
  -- snapshots taken at pin time so the plaque endures forever
  comment_content     text        not null,
  author_username     text        not null,
  author_user_id      uuid        references auth.users(id) on delete set null,
  -- context: what cover/page the comment was on
  cover_id            uuid        references covers_cafe_covers(id) on delete set null,
  cover_title         text,
  cover_artist        text,
  cover_storage_path  text,
  cover_image_url     text,
  page_type           text,
  page_slug           text,
  -- induction metadata
  pinned_by           uuid        not null references auth.users(id) on delete cascade,
  pinned_at           timestamptz not null default now(),
  unique(comment_id)
);

alter table covers_cafe_poh_pins enable row level security;

create policy "poh_pins_public_read"
  on covers_cafe_poh_pins for select using (true);

create policy "poh_pins_operator_write"
  on covers_cafe_poh_pins for all
  using (covers_cafe_is_operator())
  with check (covers_cafe_is_operator());

-- ── Achievements ─────────────────────────────────────────────────────────────
create table if not exists covers_cafe_achievements (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  -- 'acotw' = Album Cover of the Week winner
  -- 'poh'   = Pin of Heuristics inductee
  type        text        not null check (type in ('acotw', 'poh')),
  -- poll_id for acotw, poh_pin_id for poh
  reference_id uuid,
  -- extra detail snapshot (cover title, week, etc.)
  metadata    jsonb,
  awarded_at  timestamptz not null default now(),
  unique(user_id, type, reference_id)
);

alter table covers_cafe_achievements enable row level security;

create policy "achievements_public_read"
  on covers_cafe_achievements for select using (true);

create policy "achievements_operator_write"
  on covers_cafe_achievements for all
  using (covers_cafe_is_operator())
  with check (covers_cafe_is_operator());

-- ── Backfill: award ACOTW achievements to all past poll winners ──────────────
insert into covers_cafe_achievements (user_id, type, reference_id, metadata, awarded_at)
select
  c.user_id,
  'acotw',
  p.id,
  jsonb_build_object(
    'cover_title',  c.title,
    'cover_artist', c.artist,
    'week_start',   p.week_start::text,
    'cover_id',     c.id::text
  ),
  coalesce(p.closed_at, p.created_at)
from covers_cafe_acotw_polls p
join covers_cafe_covers c on c.id = p.winner_cover_id
where p.winner_cover_id is not null
  and c.user_id is not null
on conflict (user_id, type, reference_id) do nothing;
