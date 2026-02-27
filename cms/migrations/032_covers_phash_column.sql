-- 032: Ensure phash column and index exist on covers_cafe_covers
--
-- The phash column was added to the initial table definition before migrations
-- were tracked here. This migration makes the schema explicit and adds an index
-- to make duplicate-detection queries fast.

alter table public.covers_cafe_covers
  add column if not exists phash text;

create index if not exists covers_cafe_covers_phash_idx
  on public.covers_cafe_covers (phash)
  where phash is not null;
