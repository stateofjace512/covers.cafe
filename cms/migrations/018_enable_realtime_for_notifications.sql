-- 018: Enable Supabase Realtime on covers_cafe_notifications
-- Allows the frontend to subscribe to INSERT events filtered by user_id
-- so notification badges update instantly without polling.
--
-- RLS (ccn_select_own: auth.uid() = user_id) already ensures each
-- authenticated client only receives their own rows via postgres_changes.

-- 1) Full row payload so the realtime listener gets all columns.
alter table public.covers_cafe_notifications
  replica identity full;

-- 2) Add to the supabase_realtime publication (idempotent).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname    = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'covers_cafe_notifications'
  ) then
    alter publication supabase_realtime
      add table public.covers_cafe_notifications;
  end if;
end
$$;
