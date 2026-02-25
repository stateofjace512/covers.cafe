-- Migration 017: Replace unreliable trigger with a SECURITY DEFINER RPC
--
-- The previous trigger (covers_cafe_favorite_count_trigger) ran under the
-- caller's security context. Because authenticated users have no UPDATE policy
-- on covers_cafe_covers, the trigger's UPDATE silently failed, leaving
-- favorite_count permanently at 0.
--
-- This migration drops that trigger and replaces it with an atomic RPC that
-- runs as the function owner (SECURITY DEFINER), so it can always write to
-- covers_cafe_covers.favorite_count regardless of the caller's RLS policies.

-- Drop the old trigger and its function
drop trigger if exists covers_cafe_favorite_count_trigger on covers_cafe_favorites;
drop function if exists covers_cafe_update_favorite_count();

-- Atomic toggle: inserts or deletes a row in covers_cafe_favorites AND
-- increments/decrements covers_cafe_covers.favorite_count in one transaction.
-- Returns TRUE if the cover is now favorited, FALSE if it was just un-favorited.
create or replace function covers_cafe_toggle_favorite(p_cover_id uuid)
returns boolean language plpgsql security definer as $$
declare
  existing_id uuid;
  is_now_favorited boolean;
begin
  select id into existing_id
    from covers_cafe_favorites
    where user_id = auth.uid() and cover_id = p_cover_id;

  if existing_id is not null then
    delete from covers_cafe_favorites where id = existing_id;
    update covers_cafe_covers
      set favorite_count = greatest(favorite_count - 1, 0)
      where id = p_cover_id;
    is_now_favorited := false;
  else
    insert into covers_cafe_favorites (user_id, cover_id)
      values (auth.uid(), p_cover_id);
    update covers_cafe_covers
      set favorite_count = favorite_count + 1
      where id = p_cover_id;
    is_now_favorited := true;
  end if;

  return is_now_favorited;
end;
$$;
