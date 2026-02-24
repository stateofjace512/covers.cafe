-- Migration 010: fix covers_cafe_build_cover_page_slug() signatures
--
-- Some clients invoke the function with TEXT for public_id, while
-- newer schema paths use BIGINT random public IDs.
-- Add a BIGINT primary signature and TEXT/INTEGER compatibility wrappers.

create or replace function covers_cafe_build_cover_page_slug(pid bigint, artist text, title text)
returns text
language sql
immutable
as $$
  select lpad(pid::text, 6, '0')
    || '-' || covers_cafe_slugify(artist)
    || '-' || left(covers_cafe_slugify(title), 20)
$$;

create or replace function covers_cafe_build_cover_page_slug(pid integer, artist text, title text)
returns text
language sql
immutable
as $$
  select covers_cafe_build_cover_page_slug(pid::bigint, artist, title)
$$;

create or replace function covers_cafe_build_cover_page_slug(pid text, artist text, title text)
returns text
language sql
immutable
as $$
  select covers_cafe_build_cover_page_slug(nullif(trim(pid), '')::bigint, artist, title)
$$;
