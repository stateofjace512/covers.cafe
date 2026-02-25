-- Migration 014: add permanent unpublish flag for DMCA/compliance takedowns

alter table public.covers_cafe_covers
  add column if not exists perma_unpublished boolean not null default false;

create index if not exists covers_cafe_covers_perma_unpublished_idx
  on public.covers_cafe_covers (perma_unpublished);
