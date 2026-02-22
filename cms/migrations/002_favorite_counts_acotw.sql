-- Add favorite_count to covers for fast Top Rated queries
alter table covers_cafe_covers
  add column if not exists favorite_count integer not null default 0;

-- Backfill from existing favorites
update covers_cafe_covers c
set favorite_count = (
  select count(*) from covers_cafe_favorites f where f.cover_id = c.id
);

-- Function to keep favorite_count in sync with the favorites table
create or replace function covers_cafe_update_favorite_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update covers_cafe_covers
    set favorite_count = favorite_count + 1
    where id = new.cover_id;
  elsif TG_OP = 'DELETE' then
    update covers_cafe_covers
    set favorite_count = greatest(favorite_count - 1, 0)
    where id = old.cover_id;
  end if;
  return null;
end;
$$;

drop trigger if exists covers_cafe_favorite_count_trigger on covers_cafe_favorites;
create trigger covers_cafe_favorite_count_trigger
  after insert or delete on covers_cafe_favorites
  for each row execute function covers_cafe_update_favorite_count();

-- Album Cover Of The Week flag (operators set this)
alter table covers_cafe_covers
  add column if not exists is_acotw boolean not null default false;

-- Optional: record the week it was featured
alter table covers_cafe_covers
  add column if not exists acotw_since date;
