/**
 * Backfill 500px thumbnails for all existing covers that don't have one yet.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=your_key \
 *   node scripts/backfill-thumbnails.mjs
 *
 * Optional: limit how many are processed in one run
 *   BATCH_LIMIT=50 node scripts/backfill-thumbnails.mjs
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_LIMIT = parseInt(process.env.BATCH_LIMIT || '0', 10) || null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  // Fetch all covers that have no thumbnail yet
  let query = sb
    .from('covers_cafe_covers')
    .select('id, storage_path')
    .is('thumbnail_path', null)
    .order('created_at', { ascending: false });

  if (BATCH_LIMIT) query = query.limit(BATCH_LIMIT);

  const { data: covers, error } = await query;
  if (error) { console.error('DB error:', error.message); process.exit(1); }

  console.log(`Found ${covers.length} covers without thumbnails.`);
  let success = 0, failed = 0;

  for (const cover of covers) {
    try {
      // Download original
      const { data: fileData, error: dlErr } = await sb.storage
        .from('covers_cafe_covers')
        .download(cover.storage_path);

      if (dlErr || !fileData) throw new Error(dlErr?.message ?? 'download failed');

      const arrayBuffer = await fileData.arrayBuffer();
      const thumbBuffer = await sharp(Buffer.from(arrayBuffer))
        .resize(500, 500, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 85 })
        .toBuffer();

      const thumbPath = `thumbnails/${cover.storage_path}`;

      // Upload thumbnail
      const { error: upErr } = await sb.storage
        .from('covers_cafe_covers')
        .upload(thumbPath, thumbBuffer, { contentType: 'image/jpeg', upsert: true });

      if (upErr) throw new Error(upErr.message);

      // Update DB
      const { error: dbErr } = await sb
        .from('covers_cafe_covers')
        .update({ thumbnail_path: thumbPath })
        .eq('id', cover.id);

      if (dbErr) throw new Error(dbErr.message);

      console.log(`  ✓ ${cover.storage_path}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${cover.storage_path}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${success} succeeded, ${failed} failed.`);
}

run();
