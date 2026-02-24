-- Migration 008: blacklist table for official artists (e.g. "Various Artists", compilations)

create table if not exists public.covers_cafe_official_artist_blacklist (
  artist_name text primary key,
  reason      text,
  created_at  timestamptz not null default now()
);

alter table public.covers_cafe_official_artist_blacklist enable row level security;

-- Operators and admins can read the full blacklist
drop policy if exists "official_artist_blacklist_select" on public.covers_cafe_official_artist_blacklist;
create policy "official_artist_blacklist_select"
  on public.covers_cafe_official_artist_blacklist
  for select
  using (true);

-- Only authenticated users (operators) may insert/update/delete
drop policy if exists "official_artist_blacklist_insert" on public.covers_cafe_official_artist_blacklist;
create policy "official_artist_blacklist_insert"
  on public.covers_cafe_official_artist_blacklist
  for insert
  to authenticated
  with check (true);

drop policy if exists "official_artist_blacklist_update" on public.covers_cafe_official_artist_blacklist;
create policy "official_artist_blacklist_update"
  on public.covers_cafe_official_artist_blacklist
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "official_artist_blacklist_delete" on public.covers_cafe_official_artist_blacklist;
create policy "official_artist_blacklist_delete"
  on public.covers_cafe_official_artist_blacklist
  for delete
  to authenticated
  using (true);

-- Seed common noise entries
insert into public.covers_cafe_official_artist_blacklist (artist_name, reason)
values
  ('Various Artists', 'Generic compilation credit — not a real artist'),
  ('Various',         'Generic compilation credit — not a real artist')
on conflict (artist_name) do nothing;
