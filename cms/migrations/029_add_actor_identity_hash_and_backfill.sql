-- 029: Add missing actor_identity_hash column, update fn_insert_notification,
--      and backfill friend_request notifications for existing pending requests.
--
-- Root cause: the live DB was created from an older schema that did not include
-- actor_identity_hash.  Every call to the 12-param fn_insert_notification
-- (used by fn_notify_on_friend_request) failed with "column does not exist",
-- which was silently swallowed by the EXCEPTION block added in 027.

-- 1. Add the missing column (safe if already present)
alter table public.covers_cafe_notifications
  add column if not exists actor_identity_hash text;

-- 2. Replace fn_insert_notification with the 12-param version.
--    If only the old 11-param version exists this creates a new overload;
--    old triggers keep calling the 11-param one and still work.
create or replace function public.fn_insert_notification(
  p_user_id             uuid,
  p_actor_user_id       uuid,
  p_actor_identity_hash text,
  p_type                text,
  p_cover_id            uuid,
  p_target_comment_id   uuid,
  p_cover_title         text,
  p_cover_artist        text,
  p_actor_name          text,
  p_actor_username      text,
  p_content             text,
  p_created_at          timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.covers_cafe_notifications (
    user_id,
    actor_user_id,
    actor_identity_hash,
    type,
    cover_id,
    target_comment_id,
    cover_title,
    cover_artist,
    actor_name,
    actor_username,
    content,
    created_at
  )
  values (
    p_user_id,
    p_actor_user_id,
    p_actor_identity_hash,
    p_type,
    p_cover_id,
    p_target_comment_id,
    coalesce(p_cover_title, 'a cover'),
    coalesce(p_cover_artist, ''),
    coalesce(p_actor_name, 'someone'),
    p_actor_username,
    p_content,
    p_created_at
  );
end;
$$;

grant execute
  on function public.fn_insert_notification(uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, timestamptz)
  to authenticated, anon;

-- 3. Backfill friend_request notifications for all pending requests
--    that do not already have an undismissed one.
--    Omit actor_identity_hash (defaults to null — fine for friend requests).
insert into public.covers_cafe_notifications (
  user_id, actor_user_id, type,
  cover_id, target_comment_id, cover_title, cover_artist,
  actor_name, actor_username, content, created_at
)
select
  f.friend_id,
  f.user_id,
  'friend_request',
  null,
  null,
  '',
  '',
  coalesce(p.username, 'someone'),
  p.username,
  null,
  f.created_at
from public.covers_cafe_friends f
left join public.covers_cafe_profiles p on p.id = f.user_id
where f.status = 'pending'
  and not exists (
    select 1
    from public.covers_cafe_notifications n
    where n.user_id     = f.friend_id
      and n.actor_user_id = f.user_id
      and n.type          = 'friend_request'
      and n.dismissed_at is null
  );
