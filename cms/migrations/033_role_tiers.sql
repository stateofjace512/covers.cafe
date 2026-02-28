-- Migration 033: Add role tiers (helper, moderator, operator)
-- Operators retain full access. Moderators and helpers are groundwork
-- for future granular permission checks.

-- Extend the role check constraint to allow new tiers
alter table covers_cafe_operator_roles
  drop constraint if exists covers_cafe_operator_roles_role_check;

alter table covers_cafe_operator_roles
  add constraint covers_cafe_operator_roles_role_check
  check (role in ('operator', 'moderator', 'helper'));

-- Index to quickly look up a user's role (used by _auth.ts)
create index if not exists covers_cafe_operator_roles_user_id_idx
  on covers_cafe_operator_roles (user_id);
