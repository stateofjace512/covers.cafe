-- Migration 009: random public IDs for fan covers + official cover pages
--
-- 1. Replace sequential public_id on fan covers with random 8-digit numbers
-- 2. Add official_public_id to official_covers (also random 8-digit)
-- 3. Add covers_cafe_official_favorites table
-- 4. Rebuild page_slug values after ID re-assignment
-- 5. Fix cover_public_id references on official_covers after fan IDs change

-- ── 1. Random ID generator for fan covers ────────────────────────────────────
create or replace function covers_cafe_generate_random_public_id()
returns bigint
language plpgsql as $$
declare
  v_id bigint;
  v_exists boolean := true;
begin
  while v_exists loop
    -- 8-digit range: 10000000 – 99999999
    v_id := floor(random() * 90000000 + 10000000)::bigint;
    select exists (
      select 1 from covers_cafe_covers where public_id = v_id
    ) into v_exists;
  end loop;
  return v_id;
end;
$$;

-- Update the before-insert trigger to use the random generator instead of nextval
create or replace function covers_cafe_set_cover_page_slug()
returns trigger language plpgsql as $$
begin
  if new.public_id is null then
    new.public_id := covers_cafe_generate_random_public_id();
  end if;
  new.page_slug := covers_cafe_build_cover_page_slug(new.public_id, new.artist, new.title);
  return new;
end;
$$;
-- (trigger already exists from migration 005, function replacement is enough)

-- ── 2. Reassign existing fan cover public IDs to random-looking values ────────
-- Use a bijective multiplicative shuffle so every existing ID becomes unique.
-- golden-ratio prime: 2654435761 — coprime to 90000000, giving a full bijection
-- for up to 90 million rows. Adds offset 10000000 so all results are 8 digits.
do $$
begin
  update covers_cafe_covers c
  set public_id = subq.new_id
  from (
    select
      id,
      (((row_number() over (order by random())) * 2654435761) % 90000000 + 10000000)::bigint as new_id
    from covers_cafe_covers
  ) subq
  where c.id = subq.id;

  -- Rebuild page_slug for every row now that public_id has changed
  update covers_cafe_covers
  set page_slug = covers_cafe_build_cover_page_slug(public_id, artist, title);
end;
$$;

-- Sync official_covers.cover_public_id to match the new fan cover IDs
-- (cover_id is the FK UUID so we can re-derive the correct public_id)
update covers_cafe_official_covers oc
set cover_public_id = c.public_id
from covers_cafe_covers c
where oc.cover_id = c.id
  and oc.cover_id is not null;

-- ── 3. official_public_id on official covers ─────────────────────────────────
alter table covers_cafe_official_covers
  add column if not exists official_public_id bigint;

create unique index if not exists covers_cafe_official_covers_official_public_id_key
  on covers_cafe_official_covers (official_public_id);

-- Random generator for official cover IDs
create or replace function covers_cafe_generate_random_official_public_id()
returns bigint
language plpgsql as $$
declare
  v_id bigint;
  v_exists boolean := true;
begin
  while v_exists loop
    v_id := floor(random() * 90000000 + 10000000)::bigint;
    select exists (
      select 1 from covers_cafe_official_covers where official_public_id = v_id
    ) into v_exists;
  end loop;
  return v_id;
end;
$$;

-- Before-insert trigger for official covers
create or replace function covers_cafe_set_official_public_id()
returns trigger language plpgsql as $$
begin
  if new.official_public_id is null then
    new.official_public_id := covers_cafe_generate_random_official_public_id();
  end if;
  return new;
end;
$$;

drop trigger if exists covers_cafe_set_official_public_id_trg on covers_cafe_official_covers;
create trigger covers_cafe_set_official_public_id_trg
  before insert on covers_cafe_official_covers
  for each row execute function covers_cafe_set_official_public_id();

-- Backfill existing official covers using the same bijective shuffle
do $$
begin
  update covers_cafe_official_covers oc
  set official_public_id = subq.new_id
  from (
    select
      id,
      (((row_number() over (order by random())) * 2654435761) % 90000000 + 10000000)::bigint as new_id
    from covers_cafe_official_covers
  ) subq
  where oc.id = subq.id;
end;
$$;

-- Make official_public_id NOT NULL after backfill
alter table covers_cafe_official_covers
  alter column official_public_id set not null;

-- ── 4. Official favorites table ───────────────────────────────────────────────
create table if not exists public.covers_cafe_official_favorites (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  official_cover_id uuid not null references public.covers_cafe_official_covers(id) on delete cascade,
  created_at      timestamptz not null default now(),
  constraint covers_cafe_official_favorites_unique unique (user_id, official_cover_id)
);

create index if not exists covers_cafe_official_favorites_cover_idx
  on public.covers_cafe_official_favorites (official_cover_id);

create index if not exists covers_cafe_official_favorites_user_idx
  on public.covers_cafe_official_favorites (user_id);

alter table public.covers_cafe_official_favorites enable row level security;

drop policy if exists "official_favorites_select" on public.covers_cafe_official_favorites;
create policy "official_favorites_select"
  on public.covers_cafe_official_favorites for select using (true);

drop policy if exists "official_favorites_insert" on public.covers_cafe_official_favorites;
create policy "official_favorites_insert"
  on public.covers_cafe_official_favorites for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "official_favorites_delete" on public.covers_cafe_official_favorites;
create policy "official_favorites_delete"
  on public.covers_cafe_official_favorites for delete to authenticated
  using (auth.uid() = user_id);
