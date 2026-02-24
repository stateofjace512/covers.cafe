/**
 * POST /api/upload-cover
 * Authenticated endpoint. Accepts cover metadata + a Cloudflare image ID (the file
 * was already uploaded directly to CF via /api/cf-upload-url), then inserts a row
 * in covers_cafe_covers.
 *
 * Body (JSON):
 *   cfImageId — CF image ID returned after direct upload (required)
 *   title     — album/cover title (required)
 *   artist    — artist name (required)
 *   year      — release year (optional)
 *   tags      — array of tag strings (optional)
 *   phash     — perceptual hash hex string (optional, computed client-side)
 *
 * Returns: { ok: true, cover_id: string }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return json({ ok: false, message: 'Unauthorized' }, 401);

  const sb = getSupabaseServer();
  if (!sb) return json({ ok: false, message: 'Server misconfigured' }, 503);

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return json({ ok: false, message: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, message: 'Invalid JSON body' }, 400);
  }

  const cfImageId = typeof body.cfImageId === 'string' ? body.cfImageId.trim() : null;
  if (!cfImageId) return json({ ok: false, message: 'Missing cfImageId' }, 400);

  const title = typeof body.title === 'string' ? body.title.trim() : null;
  const artist = typeof body.artist === 'string' ? body.artist.trim() : null;
  if (!title || !artist) return json({ ok: false, message: 'title and artist are required' }, 400);

  const yearRaw = body.year;
  const year = typeof yearRaw === 'number' ? yearRaw : typeof yearRaw === 'string' ? parseInt(yearRaw, 10) : null;
  const tags = Array.isArray(body.tags) ? (body.tags as string[]).filter((t) => typeof t === 'string') : [];
  const phash = typeof body.phash === 'string' ? body.phash : null;

  const storagePath = `cf:${cfImageId}`;
  const { data: cover, error: insertErr } = await sb
    .from('covers_cafe_covers')
    .insert({
      user_id: userId,
      title,
      artist,
      year: typeof year === 'number' && Number.isFinite(year) ? year : null,
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
    return json({ ok: false, message: 'Database insert failed' }, 500);
  }

  return json({ ok: true, cover_id: cover.id }, 200);
};
