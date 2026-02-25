-- Ensure cover upserts/updates are emitted by Supabase Realtime.
-- Safe to run multiple times.

-- 1) Make UPDATE payloads include full row data so listeners can react reliably.
alter table public.covers_cafe_covers
  replica identity full;

-- 2) Ensure the covers table is part of the realtime publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'covers_cafe_covers'
  ) then
    alter publication supabase_realtime
      add table public.covers_cafe_covers;
  end if;
end
$$;
