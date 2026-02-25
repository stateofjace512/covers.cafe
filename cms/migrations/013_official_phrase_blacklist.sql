-- Migration 013: loose phrase blacklist for official gallery spam filtering

create table if not exists public.covers_cafe_official_phrase_blacklist (
  phrase     text primary key,
  reason     text,
  created_at timestamptz not null default now()
);

alter table public.covers_cafe_official_phrase_blacklist enable row level security;

drop policy if exists "official_phrase_blacklist_select" on public.covers_cafe_official_phrase_blacklist;
create policy "official_phrase_blacklist_select"
  on public.covers_cafe_official_phrase_blacklist
  for select
  using (true);

drop policy if exists "official_phrase_blacklist_insert" on public.covers_cafe_official_phrase_blacklist;
create policy "official_phrase_blacklist_insert"
  on public.covers_cafe_official_phrase_blacklist
  for insert
  to authenticated
  with check (true);

drop policy if exists "official_phrase_blacklist_update" on public.covers_cafe_official_phrase_blacklist;
create policy "official_phrase_blacklist_update"
  on public.covers_cafe_official_phrase_blacklist
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "official_phrase_blacklist_delete" on public.covers_cafe_official_phrase_blacklist;
create policy "official_phrase_blacklist_delete"
  on public.covers_cafe_official_phrase_blacklist
  for delete
  to authenticated
  using (true);

insert into public.covers_cafe_official_phrase_blacklist (phrase, reason)
values
  ('karaoke version', 'Low-value official spam variant'),
  ('tribute to', 'Often low-signal duplicate/compilation spam')
on conflict (phrase) do nothing;
