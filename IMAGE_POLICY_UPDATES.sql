-- Allow uploads up to 5000px while preserving minimum 500px.
-- Run in Supabase SQL editor.

alter table covers_cafe_covers
  add column if not exists original_width integer,
  add column if not exists original_height integer;

-- Refresh dimension checks to permit up to 5000px.
alter table covers_cafe_covers
  drop constraint if exists covers_cafe_covers_image_width_check;
alter table covers_cafe_covers
  drop constraint if exists covers_cafe_covers_image_height_check;

alter table covers_cafe_covers
  add constraint covers_cafe_covers_image_width_check
  check (original_width is null or (original_width >= 500 and original_width <= 5000));
alter table covers_cafe_covers
  add constraint covers_cafe_covers_image_height_check
  check (original_height is null or (original_height >= 500 and original_height <= 5000));
