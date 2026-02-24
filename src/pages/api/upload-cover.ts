/**
 * POST /api/upload-cover
 * Authenticated endpoint. Accepts a cover image (multipart/form-data), uploads it
 * to Cloudflare Images, then inserts a row in covers_cafe_covers.
 *
 * Form fields:
 *   file    — the JPEG image
 *   title   — album/cover title (required)
 *   artist  — artist name (required)
 *   year    — release year (optional)
 *   tags    — JSON array of tag strings (optional)
 *   phash   — perceptual hash hex string (optional, computed client-side)
 *
 * Returns: { ok: true, cover_id: string }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';
import { uploadToCf } from '../../lib/cloudflare';

const MAX_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });
  const userId = userData.user.id;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response('Invalid form data', { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return new Response('Missing file', { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return new Response('File too large (max 30 MB)', { status: 413 });

  const title = (formData.get('title') as string | null)?.trim();
  const artist = (formData.get('artist') as string | null)?.trim();
  if (!title || !artist) return new Response('title and artist are required', { status: 400 });

  const yearRaw = formData.get('year') as string | null;
  const year = yearRaw ? parseInt(yearRaw, 10) : null;
  const tagsRaw = formData.get('tags') as string | null;
  let tags: string[] = [];
  try { if (tagsRaw) tags = JSON.parse(tagsRaw) as string[]; } catch { /* ignore */ }
  const phash = (formData.get('phash') as string | null) || null;

  // Upload to Cloudflare Images
  let cfImageId: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    cfImageId = await uploadToCf(arrayBuffer, file.name || 'cover.jpg', {
      user_id: userId,
      title,
      artist,
    });
  } catch (err) {
    console.error('[upload-cover] CF upload error:', err);
    return new Response(
      JSON.stringify({ ok: false, message: err instanceof Error ? err.message : 'Upload failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const storagePath = `cf:${cfImageId}`;
  // image_url is set to empty string — media.ts derives the delivery URL from storage_path
  const { data: cover, error: insertErr } = await sb
    .from('covers_cafe_covers')
    .insert({
      user_id: userId,
      title,
      artist,
      year: Number.isFinite(year) ? year : null,
      tags,
      storage_path: storagePath,
      image_url: '',
      phash,
      is_public: true,
    })
    .select('id')
    .single();

  if (insertErr || !cover) {
    console.error('[upload-cover] DB insert error:', insertErr?.message);
    return new Response(
      JSON.stringify({ ok: false, message: 'Database insert failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, cover_id: cover.id }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
