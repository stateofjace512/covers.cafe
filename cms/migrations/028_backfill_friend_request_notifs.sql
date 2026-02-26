-- 028: Ensure friend_request type is in the constraint + backfill missing notifications
-- Needed for installs where 022/024 were not applied before 027.
-- Safe to run even if 022/024 were already applied (idempotent).

-- 1. Rebuild type constraint so 'friend_request' and 'achievement' are definitely present
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

-- 2. Backfill friend_request notifications for every pending request
--    that does not already have an undismissed notification.
--    Runs as postgres (service role) so RLS is not a barrier.

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
from public.covers_cafe_friends f
left join public.covers_cafe_profiles p on p.id = f.user_id
where f.status = 'pending'
  and not exists (
    select 1
    from public.covers_cafe_notifications n
    where n.user_id = f.friend_id
      and n.actor_user_id = f.user_id
      and n.type = 'friend_request'
      and n.dismissed_at is null
  );
