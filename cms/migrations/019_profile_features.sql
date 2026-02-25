-- 019: Profile features — banner, profile theme, pinned covers, brews
-- ──────────────────────────────────────────────────────────────────

-- 1. Add banner_url, profile_theme, and gradient colors to profiles

alter table public.covers_cafe_profiles
  add column if not exists banner_url             text,
  add column if not exists profile_theme          text
    check (profile_theme in ('light','dark','pureblack','crisp','gradient')),
  add column if not exists profile_gradient_start text,
  add column if not exists profile_gradient_end   text;

-- 2. Pinned covers table (up to 6 per user, ordered by position)

create table if not exists public.covers_cafe_pinned_covers (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  cover_id   uuid        not null references public.covers_cafe_covers(id) on delete cascade,
  position   int         not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, cover_id)
);

create index if not exists idx_ccpin_user
  on public.covers_cafe_pinned_covers (user_id, position);

alter table public.covers_cafe_pinned_covers enable row level security;

drop policy if exists "pinned_select_all"  on public.covers_cafe_pinned_covers;
drop policy if exists "pinned_insert_own"  on public.covers_cafe_pinned_covers;
drop policy if exists "pinned_delete_own"  on public.covers_cafe_pinned_covers;

create policy "pinned_select_all"
  on public.covers_cafe_pinned_covers for select using (true);

create policy "pinned_insert_own"
  on public.covers_cafe_pinned_covers for insert
  with check (auth.uid() = user_id);

create policy "pinned_delete_own"
  on public.covers_cafe_pinned_covers for delete
  using (auth.uid() = user_id);
