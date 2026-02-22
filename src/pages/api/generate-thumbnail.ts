import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';
import sharp from 'sharp';

export const POST: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('API unavailable', { status: 503 });

  const { storage_path } = await request.json() as { storage_path: string };
  if (!storage_path) return new Response('Missing storage_path', { status: 400 });

  // Download the original image
  const { data: fileData, error: dlErr } = await sb.storage
    .from('covers_cafe_covers')
    .download(storage_path);

  if (dlErr || !fileData) {
    return new Response(`Download failed: ${dlErr?.message ?? 'not found'}`, { status: 404 });
  }

  // Resize to 500px on longest side, keep aspect ratio, crop to square
  const arrayBuffer = await fileData.arrayBuffer();
  const thumbBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize(500, 500, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Upload thumbnail to thumbnails/{storage_path}
  const thumbPath = `thumbnails/${storage_path}`;
  const { error: upErr } = await sb.storage
    .from('covers_cafe_covers')
    .upload(thumbPath, thumbBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (upErr) {
    return new Response(`Upload failed: ${upErr.message}`, { status: 500 });
  }

  // Update the DB record with thumbnail_path
  const { error: dbErr } = await sb
    .from('covers_cafe_covers')
    .update({ thumbnail_path: thumbPath })
    .eq('storage_path', storage_path);

  if (dbErr) {
    return new Response(`DB update failed: ${dbErr.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ thumbnail_path: thumbPath }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
