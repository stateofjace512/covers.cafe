-- 016: Follows system + friend_posted / new_follower notification types
-- ─────────────────────────────────────────────────────────────────────

-- 1. follows table

create table if not exists public.covers_cafe_follows (
  follower_id  uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists idx_ccfol_following
  on public.covers_cafe_follows (following_id);

alter table public.covers_cafe_follows enable row level security;

drop policy if exists "follows_select_all"   on public.covers_cafe_follows;
drop policy if exists "follows_insert_own"   on public.covers_cafe_follows;
drop policy if exists "follows_delete_own"   on public.covers_cafe_follows;

create policy "follows_select_all"
  on public.covers_cafe_follows for select using (true);

create policy "follows_insert_own"
  on public.covers_cafe_follows for insert
  with check (auth.uid() = follower_id);

create policy "follows_delete_own"
  on public.covers_cafe_follows for delete
  using (auth.uid() = follower_id);

-- 2. Extend notification type constraint to include new types
--    (migration 015 added cover_removed; we extend further here)

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
    'new_follower'
  ));

-- 3. Trigger: notify when someone follows you

create or replace function public.fn_notify_on_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_username text;
begin
  select username into v_actor_username
  from covers_cafe_profiles
  where id = new.follower_id
  limit 1;

  perform public.fn_insert_notification(
    new.following_id,                        -- user_id (recipient)
    new.follower_id,                         -- actor_user_id
    null,                                    -- actor_identity_hash
    'new_follower',                          -- type
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

drop trigger if exists trg_notify_on_new_follower on public.covers_cafe_follows;
create trigger trg_notify_on_new_follower
  after insert on public.covers_cafe_follows
  for each row execute function public.fn_notify_on_new_follower();

-- 4. Trigger: notify followers when someone they follow posts a public cover

create or replace function public.fn_notify_on_friend_posted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follower_id    uuid;
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

  for v_follower_id in
    select follower_id
    from covers_cafe_follows
    where following_id = new.user_id
  loop
    perform public.fn_insert_notification(
      v_follower_id,                           -- user_id (recipient)
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

drop trigger if exists trg_notify_on_friend_posted on public.covers_cafe_covers;
create trigger trg_notify_on_friend_posted
  after insert on public.covers_cafe_covers
  for each row execute function public.fn_notify_on_friend_posted();
