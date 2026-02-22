-- covers_cafe_notifications schema + trigger pipeline
-- Supports notification types:
--   - favorite
--   - comment
--   - comment_like
--   - comment_reply

create extension if not exists pgcrypto;

create table if not exists public.covers_cafe_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_identity_hash text,
  type text not null check (type in ('favorite', 'comment', 'comment_like', 'comment_reply')),
  cover_id uuid references public.covers_cafe_covers(id) on delete cascade,
  target_comment_id uuid references public.comments(id) on delete cascade,
  cover_title text not null,
  cover_artist text not null default '',
  actor_name text not null,
  actor_username text,
  content text,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ccn_user_created
  on public.covers_cafe_notifications (user_id, created_at desc);

create index if not exists idx_ccn_user_visible
  on public.covers_cafe_notifications (user_id, created_at desc)
  where dismissed_at is null;

create index if not exists idx_ccn_user_unread
  on public.covers_cafe_notifications (user_id, created_at desc)
  where read_at is null and dismissed_at is null;

create index if not exists idx_ccn_cover
  on public.covers_cafe_notifications (cover_id);

create index if not exists idx_ccn_target_comment
  on public.covers_cafe_notifications (target_comment_id);

alter table public.covers_cafe_notifications enable row level security;

drop policy if exists "ccn_select_own" on public.covers_cafe_notifications;
create policy "ccn_select_own"
  on public.covers_cafe_notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "ccn_update_own" on public.covers_cafe_notifications;
create policy "ccn_update_own"
  on public.covers_cafe_notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Internal helper to insert notification rows
create or replace function public.fn_insert_notification(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_actor_identity_hash text,
  p_type text,
  p_cover_id uuid,
  p_target_comment_id uuid,
  p_cover_title text,
  p_cover_artist text,
  p_actor_name text,
  p_actor_username text,
  p_content text,
  p_created_at timestamptz default now()
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

-- Favorite -> cover owner
create or replace function public.fn_notify_on_cover_favorite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_title text;
  v_artist text;
  v_actor_username text;
begin
  select c.user_id, c.title, c.artist
    into v_owner_id, v_title, v_artist
  from public.covers_cafe_covers c
  where c.id = new.cover_id
  limit 1;

  if v_owner_id is null or v_owner_id = new.user_id then
    return new;
  end if;

  select p.username into v_actor_username
  from public.covers_cafe_profiles p
  where p.id = new.user_id
  limit 1;

  perform public.fn_insert_notification(
    v_owner_id,
    new.user_id,
    null,
    'favorite',
    new.cover_id,
    null,
    v_title,
    v_artist,
    coalesce(v_actor_username, 'someone'),
    v_actor_username,
    null,
    new.created_at
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_cover_favorite on public.covers_cafe_favorites;
create trigger trg_notify_on_cover_favorite
after insert on public.covers_cafe_favorites
for each row
execute function public.fn_notify_on_cover_favorite();

-- Comment on cover -> cover owner
create or replace function public.fn_notify_on_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cover_id uuid;
  v_owner_id uuid;
  v_title text;
  v_artist text;
  v_actor_user_id uuid;
begin
  begin
    v_cover_id := new.page_slug::uuid;
  exception when others then
    return new;
  end;

  select c.user_id, c.title, c.artist
    into v_owner_id, v_title, v_artist
  from public.covers_cafe_covers c
  where c.id = v_cover_id
  limit 1;

  select p.id into v_actor_user_id
  from public.covers_cafe_profiles p
  where p.username = new.author_username
  limit 1;

  if v_owner_id is null or (v_actor_user_id is not null and v_owner_id = v_actor_user_id) then
    return new;
  end if;

  perform public.fn_insert_notification(
    v_owner_id,
    v_actor_user_id,
    new.identity_hash,
    'comment',
    v_cover_id,
    new.id,
    v_title,
    v_artist,
    coalesce(new.author_username, 'someone'),
    new.author_username,
    left(coalesce(new.content, ''), 100),
    new.created_at
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_comment_insert on public.comments;
create trigger trg_notify_on_comment_insert
after insert on public.comments
for each row
execute function public.fn_notify_on_comment_insert();

-- Reply to comment -> parent comment author
create or replace function public.fn_notify_on_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent record;
  v_cover_id uuid;
  v_title text;
  v_artist text;
  v_recipient_user_id uuid;
  v_actor_user_id uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select id, page_slug, author_username, identity_hash, content
    into v_parent
  from public.comments
  where id = new.parent_comment_id
  limit 1;

  if v_parent.id is null then
    return new;
  end if;

  if v_parent.identity_hash = new.identity_hash then
    return new;
  end if;

  begin
    v_cover_id := v_parent.page_slug::uuid;
  exception when others then
    return new;
  end;

  select c.title, c.artist
    into v_title, v_artist
  from public.covers_cafe_covers c
  where c.id = v_cover_id
  limit 1;

  select p.id
    into v_recipient_user_id
  from public.covers_cafe_profiles p
  where p.username = v_parent.author_username
  limit 1;

  select p.id
    into v_actor_user_id
  from public.covers_cafe_profiles p
  where p.username = new.author_username
  limit 1;

  if v_recipient_user_id is null then
    return new;
  end if;

  perform public.fn_insert_notification(
    v_recipient_user_id,
    v_actor_user_id,
    new.identity_hash,
    'comment_reply',
    v_cover_id,
    v_parent.id,
    v_title,
    v_artist,
    coalesce(new.author_username, 'someone'),
    new.author_username,
    left(coalesce(new.content, ''), 100),
    new.created_at
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_comment_reply on public.comments;
create trigger trg_notify_on_comment_reply
after insert on public.comments
for each row
execute function public.fn_notify_on_comment_reply();

-- Like on comment -> comment author
create or replace function public.fn_notify_on_comment_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment record;
  v_cover_id uuid;
  v_title text;
  v_artist text;
  v_recipient_user_id uuid;
  v_actor_username text;
begin
  select id, page_slug, author_username, identity_hash, content
    into v_comment
  from public.comments
  where id = new.comment_id
  limit 1;

  if v_comment.id is null then
    return new;
  end if;

  if v_comment.identity_hash = new.identity_hash then
    return new;
  end if;

  begin
    v_cover_id := v_comment.page_slug::uuid;
  exception when others then
    return new;
  end;

  select c.title, c.artist
    into v_title, v_artist
  from public.covers_cafe_covers c
  where c.id = v_cover_id
  limit 1;

  select p.id
    into v_recipient_user_id
  from public.covers_cafe_profiles p
  where p.username = v_comment.author_username
  limit 1;

  -- best-effort actor username lookup from existing comments by same identity
  select c.author_username
    into v_actor_username
  from public.comments c
  where c.identity_hash = new.identity_hash
  order by c.created_at desc
  limit 1;

  if v_recipient_user_id is null then
    return new;
  end if;

  perform public.fn_insert_notification(
    v_recipient_user_id,
    null,
    new.identity_hash,
    'comment_like',
    v_cover_id,
    v_comment.id,
    v_title,
    v_artist,
    coalesce(v_actor_username, 'someone'),
    v_actor_username,
    left(coalesce(v_comment.content, ''), 100),
    new.created_at
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_comment_like on public.comment_likes;
create trigger trg_notify_on_comment_like
after insert on public.comment_likes
for each row
execute function public.fn_notify_on_comment_like();
