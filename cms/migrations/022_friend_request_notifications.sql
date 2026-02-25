-- 022: friend_request notification type + trigger
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Extend notification type constraint to include 'friend_request'

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
    'friend_request'
  ));

-- 2. Trigger: notify recipient when someone sends them a friend request

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
