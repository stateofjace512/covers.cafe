-- Official album cover cache table.
-- Stores client-fetched iTunes JSON in bulk so later reads come from Supabase.

create extension if not exists pgcrypto;

create table if not exists public.covers_cafe_official_covers (
  id uuid primary key default gen_random_uuid(),
  artist_name text,
  album_title text,
  release_year integer,
  album_cover_url text not null,
  pixel_dimensions text,
  country text not null default 'us',
  search_artist text not null,
  search_album text,
  tags text[] not null default array['official'],
  source_payload jsonb,
  cover_id uuid references public.covers_cafe_covers(id) on delete set null,
  cover_public_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint covers_cafe_official_covers_tag_official check ('official' = any(tags))
);


alter table public.covers_cafe_official_covers
  add column if not exists cover_id uuid references public.covers_cafe_covers(id) on delete set null;

alter table public.covers_cafe_official_covers
  add column if not exists cover_public_id bigint;

create unique index if not exists covers_cafe_official_covers_identity_idx
  on public.covers_cafe_official_covers (country, artist_name, album_title, album_cover_url);

create index if not exists covers_cafe_official_covers_search_artist_idx
  on public.covers_cafe_official_covers (search_artist);

create index if not exists covers_cafe_official_covers_search_album_idx
  on public.covers_cafe_official_covers (search_album);

create index if not exists covers_cafe_official_covers_cover_public_id_idx
  on public.covers_cafe_official_covers (cover_public_id);

create or replace function public.covers_cafe_official_covers_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_covers_cafe_official_covers_updated_at on public.covers_cafe_official_covers;
create trigger trg_covers_cafe_official_covers_updated_at
before update on public.covers_cafe_official_covers
for each row execute procedure public.covers_cafe_official_covers_set_updated_at();

alter table public.covers_cafe_official_covers enable row level security;

drop policy if exists "official_covers_select_public" on public.covers_cafe_official_covers;
create policy "official_covers_select_public"
  on public.covers_cafe_official_covers
  for select
  using (true);

drop policy if exists "official_covers_insert_auth" on public.covers_cafe_official_covers;
drop policy if exists "official_covers_insert_public" on public.covers_cafe_official_covers;
create policy "official_covers_insert_public"
  on public.covers_cafe_official_covers
  for insert
  to anon, authenticated
  with check (
    'official' = any(tags)
  );

drop policy if exists "official_covers_update_auth" on public.covers_cafe_official_covers;
drop policy if exists "official_covers_update_public" on public.covers_cafe_official_covers;
create policy "official_covers_update_public"
  on public.covers_cafe_official_covers
  for update
  to anon, authenticated
  using (true)
  with check (
    'official' = any(tags)
  );
