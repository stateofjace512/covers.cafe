-- Artist alias mappings for official cover art.
-- Populated when users merge official artist names (e.g. "テイラー・スウィフト" → "Taylor Swift").
-- Allows compound artist_name strings like "テイラー・スウィフト & ILLENIUM" to be split and
-- each token resolved to a canonical name without incorrectly merging co-artists together.

create table if not exists public.covers_cafe_artist_aliases (
  alias text primary key,
  canonical text not null,
  created_at timestamptz not null default now()
);

create index if not exists covers_cafe_artist_aliases_canonical_idx
  on public.covers_cafe_artist_aliases (canonical);

alter table public.covers_cafe_artist_aliases enable row level security;

drop policy if exists "artist_aliases_select_public" on public.covers_cafe_artist_aliases;
create policy "artist_aliases_select_public"
  on public.covers_cafe_artist_aliases
  for select
  using (true);

-- Allow anon as well as authenticated so the server-side Supabase client works even when
-- only the anon key is configured (no service-role key set).
drop policy if exists "artist_aliases_insert_auth" on public.covers_cafe_artist_aliases;
create policy "artist_aliases_insert_auth"
  on public.covers_cafe_artist_aliases
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "artist_aliases_update_auth" on public.covers_cafe_artist_aliases;
create policy "artist_aliases_update_auth"
  on public.covers_cafe_artist_aliases
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "artist_aliases_delete_auth" on public.covers_cafe_artist_aliases;
create policy "artist_aliases_delete_auth"
  on public.covers_cafe_artist_aliases
  for delete
  to anon, authenticated
  using (true);
