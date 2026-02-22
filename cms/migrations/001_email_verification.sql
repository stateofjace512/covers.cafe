-- Migration 001: Email verification system
-- Run this in the Supabase SQL editor

-- 1. Add email_verified column to profiles (defaults to false for all rows)
alter table covers_cafe_profiles
  add column if not exists email_verified boolean not null default false;

-- 2. Mark ALL existing users as unverified so they re-verify on next login
update covers_cafe_profiles set email_verified = false;

-- 3. Verification codes table for OTP flow
create table if not exists covers_cafe_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used boolean not null default false
);

-- Index so lookups by email are fast
create index if not exists covers_cafe_verification_codes_email_idx
  on covers_cafe_verification_codes(email, used, expires_at);

-- Only the service role (server) should touch this table — no client access
alter table covers_cafe_verification_codes enable row level security;
-- No policies: service role bypasses RLS; anon/authenticated cannot access directly

-- 4. Ensure operators can SELECT from reports (needed for CMS dashboard)
--    (Skip if your reports table has no RLS; this is a safe no-op if RLS is disabled)
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname = 'covers_cafe_reports'
      and n.nspname = 'public'
      and c.relrowsecurity = true
  ) then
    -- RLS is enabled on reports: add operator read policy if missing
    if not exists (
      select 1 from pg_policies
      where tablename = 'covers_cafe_reports'
        and policyname = 'operators_can_read_reports'
    ) then
      execute 'create policy operators_can_read_reports
        on covers_cafe_reports for select
        using (covers_cafe_is_operator())';
    end if;
  end if;
end $$;

-- 5. Operator SELECT on bans is already handled by the ALL policy,
--    but if using an authenticated client (user JWT), auth.uid() must match
--    an operator — the existing policy covers this correctly already.

-- 6. Cleanup: remove expired/used codes periodically (run manually or via pg_cron)
-- delete from covers_cafe_verification_codes
-- where used = true or expires_at < now();
