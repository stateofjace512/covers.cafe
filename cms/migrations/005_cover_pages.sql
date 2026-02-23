-- Migration 005: public cover pages (numeric id + slug)

create sequence if not exists covers_cafe_cover_public_id_seq;

alter table covers_cafe_covers
  add column if not exists public_id integer,
  add column if not exists page_slug text;

alter table covers_cafe_covers
  alter column public_id set default nextval('covers_cafe_cover_public_id_seq');

update covers_cafe_covers
set public_id = nextval('covers_cafe_cover_public_id_seq')
where public_id is null;

alter table covers_cafe_covers
  alter column public_id set not null;

create unique index if not exists covers_cafe_covers_public_id_key
  on covers_cafe_covers(public_id);

create or replace function covers_cafe_slugify(v text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(v, '')), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function covers_cafe_build_cover_page_slug(pid integer, artist text, title text)
returns text language sql immutable as $$
  select lpad(pid::text, 6, '0')
    || '-' || covers_cafe_slugify(artist)
    || '-' || left(covers_cafe_slugify(title), 20)
$$;

update covers_cafe_covers
set page_slug = covers_cafe_build_cover_page_slug(public_id, artist, title)
where page_slug is null;

alter table covers_cafe_covers
  alter column page_slug set not null;

create unique index if not exists covers_cafe_covers_page_slug_key
  on covers_cafe_covers(page_slug);

create or replace function covers_cafe_set_cover_page_slug()
returns trigger language plpgsql as $$
begin
  if new.public_id is null then
    new.public_id := nextval('covers_cafe_cover_public_id_seq');
  end if;
  new.page_slug := covers_cafe_build_cover_page_slug(new.public_id, new.artist, new.title);
  return new;
end;
$$;

drop trigger if exists covers_cafe_set_cover_page_slug_trg on covers_cafe_covers;
create trigger covers_cafe_set_cover_page_slug_trg
  before insert or update of artist, title on covers_cafe_covers
  for each row execute function covers_cafe_set_cover_page_slug();
