-- 024: Notifications overhaul
--   1. Add 'achievement' notification type
--   2. Re-apply friend_request trigger (idempotent — fixes installs where 022 wasn't run)
--   3. Switch friend_posted to notify accepted friends instead of followers
--   4. Add achievement trigger on covers_cafe_achievements INSERT
--   5. Backfill: pending friend requests → friend_request notifications
--   6. Backfill: existing achievements → achievement notifications
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend notification type constraint to include 'achievement'
--    (also ensures 'friend_request' is present for installs that skipped 022)

alter table public.covers_cafe_notifications
  drop constraint covers_cafe_notifications_type_check;

alter table public.covers_cafe_notifications
  add constraint covers_cafe_notifications_type_check
  check (type in (
    'favorite',
    'comment',
    'comment_like',
    'comment_reply',
    'cover_removed',
    'friend_posted',
    'new_follower',
    'friend_request',
    'achievement'
  ));

-- 2. Re-apply friend_request trigger (idempotent)

create or replace function public.fn_notify_on_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_username text;
begin
  -- Only fire on new pending requests, not on updates (accepts)
  if new.status <> 'pending' then
    return new;
  end if;

  select username into v_actor_username
  from covers_cafe_profiles
  where id = new.user_id
  limit 1;

  perform public.fn_insert_notification(
    new.friend_id,                           -- user_id (recipient)
    new.user_id,                             -- actor_user_id
    null,                                    -- actor_identity_hash
    'friend_request',                        -- type
    null,                                    -- cover_id
    null,                                    -- target_comment_id
    '',                                      -- cover_title (N/A)
    '',                                      -- cover_artist (N/A)
    coalesce(v_actor_username, 'someone'),   -- actor_name
    v_actor_username,                        -- actor_username
    null,                                    -- content
    now()                                    -- created_at
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_friend_request on public.covers_cafe_friends;
create trigger trg_notify_on_friend_request
  after insert on public.covers_cafe_friends
  for each row execute function public.fn_notify_on_friend_request();

-- 3. Switch friend_posted to notify accepted friends instead of followers
--    (removes dependency on covers_cafe_follows now that following is removed)

create or replace function public.fn_notify_on_friend_posted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_friend_id      uuid;
  v_actor_username text;
begin
  -- Only for public covers
  if not new.is_public then
    return new;
  end if;

  select username into v_actor_username
  from covers_cafe_profiles
  where id = new.user_id
  limit 1;

  -- Loop over accepted friends (either direction in the friends table)
  for v_friend_id in
    select case
      when user_id = new.user_id then friend_id
      else user_id
    end
    from covers_cafe_friends
    where (user_id = new.user_id or friend_id = new.user_id)
      and status = 'accepted'
  loop
    perform public.fn_insert_notification(
      v_friend_id,                             -- user_id (recipient)
      new.user_id,                             -- actor_user_id
      null,                                    -- actor_identity_hash
      'friend_posted',                         -- type
      new.id,                                  -- cover_id
      null,                                    -- target_comment_id
      coalesce(new.title, 'Untitled'),         -- cover_title
      coalesce(new.artist, ''),                -- cover_artist
      coalesce(v_actor_username, 'someone'),   -- actor_name
      v_actor_username,                        -- actor_username
      null,                                    -- content
      new.created_at                           -- created_at
    );
  end loop;

  return new;
end;
$$;

-- The trigger itself was already created in 016; CREATE OR REPLACE above is enough.
-- Re-create it to be safe (idempotent).
drop trigger if exists trg_notify_on_friend_posted on public.covers_cafe_covers;
create trigger trg_notify_on_friend_posted
  after insert on public.covers_cafe_covers
  for each row execute function public.fn_notify_on_friend_posted();

-- 4. Achievement trigger

create or replace function public.fn_notify_on_achievement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_insert_notification(
    new.user_id,      -- user_id (recipient — the achiever)
    null,             -- actor_user_id (system-generated)
    null,             -- actor_identity_hash
    'achievement',    -- type
    null,             -- cover_id
    null,             -- target_comment_id
    '',               -- cover_title (N/A)
    '',               -- cover_artist (N/A)
    'Covers Cafe',    -- actor_name
    null,             -- actor_username
    new.type,         -- content — stores the achievement type key (e.g. 'acotw')
    new.awarded_at    -- created_at
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_achievement on public.covers_cafe_achievements;
create trigger trg_notify_on_achievement
  after insert on public.covers_cafe_achievements
  for each row execute function public.fn_notify_on_achievement();

-- 5. Backfill: friend_request notifications for existing pending requests
--    Skip if a notification already exists for that pair to avoid duplicates.

insert into public.covers_cafe_notifications (
  user_id, actor_user_id, actor_identity_hash, type,
  cover_id, target_comment_id, cover_title, cover_artist,
  actor_name, actor_username, content, created_at
)
select
  f.friend_id,
  f.user_id,
  null,
  'friend_request',
  null,
  null,
  '',
  '',
  coalesce(p.username, 'someone'),
  p.username,
  null,
  f.created_at
from covers_cafe_friends f
left join covers_cafe_profiles p on p.id = f.user_id
where f.status = 'pending'
  and not exists (
    select 1
    from covers_cafe_notifications n
    where n.user_id = f.friend_id
      and n.actor_user_id = f.user_id
      and n.type = 'friend_request'
      and n.dismissed_at is null
  );

-- 6. Backfill: achievement notifications for existing achievements
--    Uses content = achievement type to detect duplicates.

insert into public.covers_cafe_notifications (
  user_id, actor_user_id, actor_identity_hash, type,
  cover_id, target_comment_id, cover_title, cover_artist,
  actor_name, actor_username, content, created_at
)
select
  a.user_id,
  null,
  null,
  'achievement',
  null,
  null,
  '',
  '',
  'Covers Cafe',
  null,
  a.type,
  a.awarded_at
from covers_cafe_achievements a
where not exists (
  select 1
  from covers_cafe_notifications n
  where n.user_id = a.user_id
    and n.type = 'achievement'
    and n.content = a.type
);
