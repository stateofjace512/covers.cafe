-- Migration 008: official covers scraped from iTunes/Apple Music
--
-- Stores official album artwork fetched client-side via the iTunes Search API.
-- artist_slug is the slugified artist name (matches /artists/:slug URL pattern)
-- so every official cover is automatically linked to the existing artist system.

create table if not exists covers_cafe_official_covers (
  id            uuid        primary key default gen_random_uuid(),
  artist_name   text        not null,
  artist_slug   text        not null,
  album_title   text        not null,
  release_year  text,
  album_cover_url text      not null,
  pixel_dimensions text,
  country       text        not null default 'us',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- prevent duplicate albums per artist
  unique (artist_slug, album_title)
);

-- index for fast artist lookup
create index if not exists covers_cafe_official_covers_artist_slug_idx
  on covers_cafe_official_covers (artist_slug);

-- index for listing all covers sorted by release year
create index if not exists covers_cafe_official_covers_created_at_idx
  on covers_cafe_official_covers (created_at desc);

-- keep updated_at current
create or replace function covers_cafe_touch_official_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists covers_cafe_official_covers_updated_at_trg
  on covers_cafe_official_covers;
create trigger covers_cafe_official_covers_updated_at_trg
  before update on covers_cafe_official_covers
  for each row execute function covers_cafe_touch_official_updated_at();

-- ── Row-level security ──────────────────────────────────────────────────────

alter table covers_cafe_official_covers enable row level security;

-- anyone can read official covers
create policy "Official covers are publicly readable"
  on covers_cafe_official_covers for select
  using (true);

-- only operators can insert / update / delete
create policy "Operators can manage official covers"
  on covers_cafe_official_covers for all
  using (
    exists (
      select 1 from covers_cafe_operator_roles
      where user_id = auth.uid() and role = 'operator'
    )
  )
  with check (
    exists (
      select 1 from covers_cafe_operator_roles
      where user_id = auth.uid() and role = 'operator'
    )
  );
