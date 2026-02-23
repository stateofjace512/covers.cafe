-- Migration 007: add artists[] column for multi-artist support
--
-- The `artist` text field is kept as the canonical display string
-- (e.g. "Taylor Swift & Lana Del Rey").  The new `artists` array
-- stores each individual name and is maintained automatically by the
-- trigger below, so the application only ever needs to write `artist`.

alter table covers_cafe_covers
  add column if not exists artists text[] not null default '{}';

-- Backfill existing rows
update covers_cafe_covers
set artists = array(
  select trim(p)
  from unnest(regexp_split_to_array(artist, '\s*(?:&|feat\.?|ft\.?|with|,)\s*', 'i')) as p
  where trim(p) <> ''
)
where artists = '{}';

-- GIN index so array-contains queries are fast
create index if not exists covers_cafe_covers_artists_gin
  on covers_cafe_covers using gin(artists);

-- Keep artists[] in sync whenever the artist string changes
create or replace function covers_cafe_sync_artists_array()
returns trigger language plpgsql as $$
begin
  new.artists := array(
    select trim(p)
    from unnest(regexp_split_to_array(new.artist, '\s*(?:&|feat\.?|ft\.?|with|,)\s*', 'i')) as p
    where trim(p) <> ''
  );
  return new;
end;
$$;

drop trigger if exists covers_cafe_sync_artists_array_trg on covers_cafe_covers;
create trigger covers_cafe_sync_artists_array_trg
  before insert or update of artist on covers_cafe_covers
  for each row execute function covers_cafe_sync_artists_array();
