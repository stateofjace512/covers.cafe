-- Store a perceptual hash for official covers and index it for upload guards.
-- Safe to run repeatedly.

alter table public.covers_cafe_official_covers
  add column if not exists official_phash text;

create index if not exists covers_cafe_official_covers_official_phash_idx
  on public.covers_cafe_official_covers (official_phash)
  where official_phash is not null;

