-- 027: Harden friend_request notifications
-- 1. Grant EXECUTE on fn_insert_notification to anon/authenticated so the
--    application layer can call it via RPC without needing the service role key.
-- 2. Add EXCEPTION handling to the trigger so a notification failure never
--    rolls back the friends-row insert.
-- 3. Partial unique index to prevent duplicate undismissed friend_request
--    notifications from the trigger + app-layer both firing.

-- 1. Grant RPC access
grant execute
  on function public.fn_insert_notification(uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, timestamptz)
  to authenticated, anon;

-- 2. Rewrite trigger with EXCEPTION handling
create or replace function public.fn_notify_on_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_username text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select username into v_actor_username
  from covers_cafe_profiles
  where id = new.user_id
  limit 1;

  begin
    perform public.fn_insert_notification(
      new.friend_id,
      new.user_id,
      null,
      'friend_request',
      null,
      null,
      '',
      '',
      coalesce(v_actor_username, 'someone'),
      v_actor_username,
      null,
      now()
    );
  exception when others then
    -- swallow so a notification failure never rolls back the friendship
    null;
  end;

  return new;
end;
$$;

-- Recreate the trigger (idempotent)
drop trigger if exists trg_notify_on_friend_request on public.covers_cafe_friends;
create trigger trg_notify_on_friend_request
  after insert on public.covers_cafe_friends
  for each row execute function public.fn_notify_on_friend_request();

-- 3. Prevent duplicate undismissed friend_request notifications
create unique index if not exists uq_friend_request_notif_pending
  on public.covers_cafe_notifications (user_id, actor_user_id)
  where type = 'friend_request' and dismissed_at is null;
