-- Run this in your Supabase SQL editor
-- =============================================================
-- 1. Add phash column to covers (for duplicate detection)
-- =============================================================
alter table covers_cafe_covers
  add column if not exists phash text;

-- =============================================================
-- 2. Reports table
-- =============================================================
create table if not exists covers_cafe_reports (
  id          uuid primary key default gen_random_uuid(),
  cover_id    uuid references covers_cafe_covers(id) on delete cascade not null,
  reporter_id uuid references auth.users(id) on delete set null,
  reason      text not null check (reason in ('inappropriate','copyright','spam','other')),
  details     text,
  created_at  timestamptz default now() not null
);

-- RLS
alter table covers_cafe_reports enable row level security;

-- Anyone authenticated can insert a report
create policy "authenticated_can_report"
  on covers_cafe_reports for insert
  with check (auth.role() = 'authenticated');

-- Only admins (service role) can read reports — users cannot see other reports
create policy "service_role_reads_reports"
  on covers_cafe_reports for select
  using (false);

-- =============================================================
-- 3. Index to speed up phash lookups
-- =============================================================
create index if not exists covers_cafe_covers_phash_idx
  on covers_cafe_covers (phash)
  where phash is not null;
