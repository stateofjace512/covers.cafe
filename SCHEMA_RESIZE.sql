-- Run this in your Supabase SQL editor
-- =============================================================
-- Image resize / thumbnail support
-- =============================================================

-- 1. Allow covers up to 5000px (validation is now client-side; this just
--    documents the new policy — no DB column tracks raw dimensions).

-- 2. Add thumbnail_path column — stores the 500px display copy.
--    The full-res original stays in storage_path (used for downloads).
ALTER TABLE covers_cafe_covers
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;

-- Index helps the backfill script quickly find rows still needing thumbnails.
CREATE INDEX IF NOT EXISTS covers_cafe_covers_no_thumb_idx
  ON covers_cafe_covers (id)
  WHERE thumbnail_path IS NULL;

-- =============================================================
-- Run scripts/backfill-thumbnails.ts (or .js) AFTER applying
-- this migration to generate 500px copies for existing images.
-- =============================================================
