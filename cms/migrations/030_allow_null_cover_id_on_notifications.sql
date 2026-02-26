-- 030: Drop NOT NULL constraint on cover_id in covers_cafe_notifications.
--
-- friend_request notifications have no associated cover, so cover_id must
-- be nullable.  The live DB was created with NOT NULL on this column.

alter table public.covers_cafe_notifications
  alter column cover_id drop not null;

-- Retry the backfill now that the constraint is gone.
-- (Safe to re-run: the exists() check prevents duplicates.)
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
    where n.user_id       = f.friend_id
      and n.actor_user_id = f.user_id
      and n.type          = 'friend_request'
      and n.dismissed_at is null
  );
