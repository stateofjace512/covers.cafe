-- Migration 004: Add is_private to covers, add can_be_removed to operator roles

-- ────────────────────────────────────────────────────────────────────────────
-- 1. covers_cafe_covers: is_private column
--    false (default) = publicly visible
--    true            = hidden from public; only the author can see it in their
--                      own profile ("mine" gallery).  Operators can still see
--                      and manage private covers via the CMS.
-- ────────────────────────────────────────────────────────────────────────────

alter table covers_cafe_covers
  add column if not exists is_private boolean not null default false;

-- Enforce the privacy rule at the RLS level with a RESTRICTIVE policy so that
-- it stacks on top of any existing permissive "select" policies.
-- A RESTRICTIVE policy uses AND logic: every row must pass this check
-- regardless of what permissive policies allow.
create policy "covers_cafe_private_covers_restriction"
  on covers_cafe_covers as restrictive
  for select
  using (
    is_private = false
    or user_id = auth.uid()
    or covers_cafe_is_operator()
  );

-- Allow cover owners to update is_private on their own rows.
-- (If a general "owner can update own covers" policy already exists this is
--  additive and harmless; the DB will just evaluate both.)
create policy if not exists "covers_cafe_owner_can_set_private"
  on covers_cafe_covers for update
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────────────────────
-- 2. covers_cafe_operator_roles: can_be_removed column
--    true  (default) = this operator can be demoted/removed by other operators
--    false           = this operator is permanently locked in; only a direct
--                      DB/service-role call can ever remove them
-- ────────────────────────────────────────────────────────────────────────────

alter table covers_cafe_operator_roles
  add column if not exists can_be_removed boolean not null default true;

-- Seed: make the founding operators permanently locked.
-- Adjust email list to match your superadmin accounts.
update covers_cafe_operator_roles
  set can_be_removed = false
  where user_id in (
    select id from auth.users
    where email in ('jakeryanrobison@icloud.com', 'clubsarah8@gmail.com')
  );
