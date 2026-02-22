-- Ensure notification writes never block primary actions (comment/favorite/like)
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

  begin
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
  exception when others then
    -- Notifications are best-effort; do not abort caller transaction.
    return;
  end;
end;
$$;
