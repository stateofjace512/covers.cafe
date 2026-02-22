// @ts-check
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

module.exports = {
  onSuccess: async ({ utils }) => {
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.log('[backfill-thumbnails] Missing env vars, skipping.');
      return;
    }

    const sb = createClient(supabaseUrl, serviceKey);

    const { data: covers, error } = await sb
      .from('covers_cafe_covers')
      .select('id, storage_path')
      .is('thumbnail_path', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[backfill-thumbnails] DB error:', error.message);
      return;
    }

    if (!covers || covers.length === 0) {
      console.log('[backfill-thumbnails] All covers already have thumbnails, nothing to do.');
      return;
    }

    console.log(`[backfill-thumbnails] Processing ${covers.length} cover(s) without thumbnails...`);

    let success = 0;
    let failed = 0;

    for (const cover of covers) {
      try {
        const { data: fileData, error: dlErr } = await sb.storage
          .from('covers_cafe_covers')
          .download(cover.storage_path);

        if (dlErr || !fileData) throw new Error(dlErr?.message ?? 'download failed');

        const arrayBuffer = await fileData.arrayBuffer();
        const thumbBuffer = await sharp(Buffer.from(arrayBuffer))
          .resize(500, 500, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: 85 })
          .toBuffer();

        const thumbPath = `thumbnails/${cover.storage_path}`;

        const { error: upErr } = await sb.storage
          .from('covers_cafe_covers')
          .upload(thumbPath, thumbBuffer, { contentType: 'image/jpeg', upsert: true });

        if (upErr) throw new Error(upErr.message);

        const { error: dbErr } = await sb
          .from('covers_cafe_covers')
          .update({ thumbnail_path: thumbPath })
          .eq('id', cover.id);

        if (dbErr) throw new Error(dbErr.message);

        console.log(`  ok ${cover.storage_path}`);
        success++;
      } catch (err) {
        console.error(`  fail ${cover.storage_path}: ${err.message}`);
        failed++;
      }
    }

    console.log(`[backfill-thumbnails] Done. ${success} succeeded, ${failed} failed.`);
  },
};
